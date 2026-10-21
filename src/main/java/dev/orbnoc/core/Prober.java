package dev.orbnoc.core;

import java.io.IOException;
import java.net.ConnectException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Sondas de disponibilidade: ICMP (binário {@code ping} do sistema, sem shell) com fallback
 * automático para conexão TCP quando o ambiente bloqueia ICMP.
 */
public final class Prober {

    private static final Logger log = LoggerFactory.getLogger(Prober.class);
    private static final int[] FALLBACK_PORTS = {443, 80, 22, 53, 8080, 8443};
    private static final Pattern RTT =
            Pattern.compile("(?:time|tempo|tiempo|zeit)\\s*([=<])\\s*([\\d.,]+)\\s*ms", Pattern.CASE_INSENSITIVE);

    private final double timeoutSeconds;
    private volatile String icmpMode; // "system" | null (= só TCP)

    public Prober(double timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public String icmpMode() {
        return icmpMode;
    }

    /** Testa ICMP contra o loopback. Sem resposta = ambiente bloqueia ICMP. */
    public String detect() {
        ProbeResult result = systemPing("127.0.0.1", 1.0);
        if (result.ok()) {
            icmpMode = "system";
            log.info("ICMP disponível (binário ping do sistema)");
        } else {
            icmpMode = null;
            log.warn("ICMP indisponível neste ambiente; usando conexão TCP como fallback");
        }
        return icmpMode;
    }

    public ProbeResult probe(String address, String checkType, Integer port) {
        if ("tcp".equals(checkType) && port != null && port > 0) {
            return tcpProbe(address, port, timeoutSeconds, false);
        }
        if (icmpMode == null) return tcpProbeAny(address, timeoutSeconds);
        return systemPing(address, timeoutSeconds);
    }

    /** Série de pings para o diagnóstico (mesma lógica de escolha ICMP/TCP). */
    public List<ProbeResult> pingSeries(String address, int count, long intervalMillis) {
        List<ProbeResult> results = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            results.add(probe(address, "icmp", null));
            if (i < count - 1) {
                try {
                    Thread.sleep(intervalMillis);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        return results;
    }

    // ---- TCP -----------------------------------------------------------------------------

    /** Conecta em {@code address:port}. {@code refusedIsAlive}: um RST prova que o host existe (fallback). */
    public static ProbeResult tcpProbe(String address, int port, double timeoutSeconds, boolean refusedIsAlive) {
        long start = System.nanoTime();
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(address, port), (int) Math.max(1, timeoutSeconds * 1000));
            return new ProbeResult(true, elapsedMs(start), "tcp", port, null);
        } catch (SocketTimeoutException e) {
            return ProbeResult.fail("tcp", port, "timeout");
        } catch (ConnectException e) {
            String message = String.valueOf(e.getMessage()).toLowerCase(Locale.ROOT);
            if (message.contains("refused")) {
                if (refusedIsAlive) return new ProbeResult(true, elapsedMs(start), "tcp", port, null);
                return ProbeResult.fail("tcp", port, "conexão recusada");
            }
            return ProbeResult.fail("tcp", port, shorten(e.getMessage(), "erro de rede"));
        } catch (IOException e) {
            return ProbeResult.fail("tcp", port, shorten(e.getMessage(), "erro de rede"));
        }
    }

    /** Fallback do ICMP: tenta portas comuns em paralelo e devolve a resposta mais rápida. */
    public static ProbeResult tcpProbeAny(String address, double timeoutSeconds) {
        List<Future<ProbeResult>> futures = new ArrayList<>();
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int port : FALLBACK_PORTS) {
                futures.add(executor.submit(() -> tcpProbe(address, port, timeoutSeconds, true)));
            }
        }
        ProbeResult best = null;
        for (Future<ProbeResult> future : futures) {
            try {
                ProbeResult r = future.get(1, TimeUnit.SECONDS);
                if (r.ok() && (best == null || r.latencyMs() < best.latencyMs())) best = r;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (ExecutionException | java.util.concurrent.TimeoutException e) {
                // porta sem resposta útil: ignora
            }
        }
        return best != null ? best : ProbeResult.fail("tcp", null, "sem resposta");
    }

    // ---- ICMP via ping do sistema -----------------------------------------------------------

    ProbeResult systemPing(String address, double timeout) {
        List<String> command = pingCommand(address, timeout);
        try {
            Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
            long limit = (long) Math.ceil(timeout) + 3;
            if (!process.waitFor(limit, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                return ProbeResult.fail("icmp", null, "sem resposta");
            }
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            Double rtt = parseRtt(output);
            if (process.exitValue() == 0 && rtt != null) return new ProbeResult(true, rtt, "icmp", null, null);
            return ProbeResult.fail("icmp", null, "sem resposta");
        } catch (IOException e) {
            return ProbeResult.fail("icmp", null, "ping indisponível neste servidor");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ProbeResult.fail("icmp", null, "interrompido");
        }
    }

    static List<String> pingCommand(String address, double timeout) {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        boolean v6 = address.indexOf(':') >= 0;
        int millis = (int) Math.max(1000, timeout * 1000);
        if (os.contains("win")) {
            return List.of("ping", v6 ? "-6" : "-4", "-n", "1", "-w", String.valueOf(millis), address);
        }
        if (os.contains("mac")) {
            return List.of(v6 ? "ping6" : "ping", "-c", "1", "-W", String.valueOf(millis), address);
        }
        int seconds = Math.max(1, (int) Math.ceil(timeout));
        return v6
                ? List.of("ping", "-6", "-n", "-c", "1", "-W", String.valueOf(seconds), address)
                : List.of("ping", "-n", "-c", "1", "-W", String.valueOf(seconds), address);
    }

    /** Extrai o tempo de resposta (ms) da saída do ping, ou {@code null} se não houve resposta. */
    static Double parseRtt(String output) {
        Matcher m = RTT.matcher(output);
        if (!m.find()) return null;
        try {
            double value = Double.parseDouble(m.group(2).replace(',', '.'));
            if ("<".equals(m.group(1))) value = value / 2; // Windows: "time<1ms"
            return Stats.round(value, 2);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static double elapsedMs(long startNanos) {
        return Stats.round((System.nanoTime() - startNanos) / 1_000_000.0, 2);
    }

    private static String shorten(String message, String fallback) {
        if (message == null || message.isBlank()) return fallback;
        return message.length() > 200 ? message.substring(0, 200) : message;
    }
}
