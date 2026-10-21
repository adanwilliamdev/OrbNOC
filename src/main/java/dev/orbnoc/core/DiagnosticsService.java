package dev.orbnoc.core;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Hashtable;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.naming.Context;
import javax.naming.NameNotFoundException;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;

/** Ferramentas de diagnóstico: ping, traceroute real, DNS e teste de porta. Sem shell. */
public final class DiagnosticsService {

    public static final Set<String> RECORD_TYPES = Set.of("A", "AAAA", "MX", "TXT", "CNAME", "NS", "SOA", "PTR");
    private static final Pattern HOP = Pattern.compile("^\\s*(\\d+)\\s+(.*)$");
    private static final Pattern IP = Pattern.compile("(\\d{1,3}(?:\\.\\d{1,3}){3}|[0-9a-fA-F:]{3,39})");
    private static final Pattern RTT = Pattern.compile("([\\d.]+)\\s*ms");

    private final Prober prober;

    public DiagnosticsService(Prober prober) {
        this.prober = prober;
    }

    public Map<String, Object> runPing(String address, int count) {
        List<ProbeResult> results = prober.pingSeries(address, count, 500);
        List<Double> latencies = new ArrayList<>();
        for (ProbeResult r : results) if (r.ok() && r.latencyMs() != null) latencies.add(r.latencyMs());
        int ok = latencies.size();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", ok > 0 ? "online" : "offline");
        out.put("method", results.get(0).method());
        out.put("packet_loss", Math.round((double) (count - ok) / count * 100));
        out.put("avg_latency", ok > 0 ? Stats.round(latencies.stream().mapToDouble(d -> d).sum() / ok, 2) : null);
        out.put("min_latency", ok > 0 ? latencies.stream().mapToDouble(d -> d).min().getAsDouble() : null);
        out.put("max_latency", ok > 0 ? latencies.stream().mapToDouble(d -> d).max().getAsDouble() : null);
        out.put("success_count", ok);
        out.put("total_count", count);
        return out;
    }

    /** Interpreta a saída de {@code traceroute -n -q 1}. Salto sem resposta vira ip=null. */
    public static List<Map<String, Object>> parseTraceroute(String output) {
        List<Map<String, Object>> hops = new ArrayList<>();
        for (String line : output.split("\\R")) {
            Matcher m = HOP.matcher(line);
            if (!m.matches()) continue;
            int hop = Integer.parseInt(m.group(1));
            String rest = m.group(2);
            Matcher ip = IP.matcher(rest);
            Matcher rtt = RTT.matcher(rest);
            boolean silent = rest.strip().startsWith("*");
            boolean hasIp = ip.find();
            boolean hasRtt = rtt.find();
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("hop", hop);
            entry.put("ip", hasIp && !silent ? ip.group(1) : null);
            entry.put("latency", hasRtt && !silent ? Double.parseDouble(rtt.group(1)) : null);
            hops.add(entry);
        }
        return hops;
    }

    /** Traceroute real via binário do sistema, com argumentos em lista (sem shell). */
    public List<Map<String, Object>> runTraceroute(String address, int maxHops, int timeoutSeconds) {
        List<String> command = List.of(
                "traceroute", "-n", "-q", "1", "-w", "2", "-m", String.valueOf(maxHops), "--", address);
        try {
            Process process = new ProcessBuilder(command).redirectErrorStream(false).start();
            process.getErrorStream().close();
            if (!process.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IllegalStateException("traceroute excedeu o tempo limite");
            }
            return parseTraceroute(new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException("traceroute não está instalado neste servidor");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("traceroute interrompido");
        }
    }

    public Map<String, Object> lookupDns(String domain, String recordType) {
        String host = NetGuard.parseHost(domain);
        String type = recordType.toUpperCase();
        if (!RECORD_TYPES.contains(type)) throw new HostRejectedException("Tipo de registro não suportado");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("domain", host);
        out.put("record_type", type);
        Hashtable<String, String> env = new Hashtable<>();
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.dns.DnsContextFactory");
        env.put(Context.PROVIDER_URL, "dns:");
        env.put("com.sun.jndi.dns.timeout.initial", "2000");
        env.put("com.sun.jndi.dns.timeout.retries", "2");
        DirContext ctx = null;
        try {
            ctx = new InitialDirContext(env);
            Attributes attrs = ctx.getAttributes(host, new String[] {type});
            Attribute attr = attrs.get(type);
            if (attr == null || attr.size() == 0) return failedDns(out, "NoAnswer");
            List<Map<String, String>> records = new ArrayList<>();
            NamingEnumeration<?> values = attr.getAll();
            while (values.hasMore()) {
                records.add(Map.of("value", dnsValue(type, String.valueOf(values.next()))));
            }
            out.put("records", records);
            out.put("success", true);
            return out;
        } catch (NameNotFoundException e) {
            return failedDns(out, "NXDOMAIN");
        } catch (NamingException e) {
            return failedDns(out, e.getClass().getSimpleName().replace("Exception", ""));
        } finally {
            if (ctx != null) {
                try {
                    ctx.close();
                } catch (NamingException ignored) {
                    // nada a fazer
                }
            }
        }
    }

    private static Map<String, Object> failedDns(Map<String, Object> out, String error) {
        out.put("records", List.of());
        out.put("success", false);
        out.put("error", error);
        return out;
    }

    static String dnsValue(String type, String raw) {
        String value = raw.strip();
        switch (type) {
            case "MX": {
                String[] parts = value.split("\\s+", 2);
                if (parts.length == 2) return stripDot(parts[1]) + " (priority " + parts[0] + ")";
                return value;
            }
            case "TXT":
                return value.replaceAll("^\"|\"$", "").replace("\" \"", "");
            case "SOA":
                return value;
            default:
                return stripDot(value);
        }
    }

    private static String stripDot(String value) {
        return value.endsWith(".") ? value.substring(0, value.length() - 1) : value;
    }

    public List<Map<String, Object>> checkPorts(String address, List<Integer> ports, double timeoutSeconds) {
        List<Future<Map<String, Object>>> futures = new ArrayList<>();
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int port : ports) {
                futures.add(executor.submit(() -> {
                    long started = System.nanoTime();
                    ProbeResult r = Prober.tcpProbe(address, port, timeoutSeconds, false);
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("port", port);
                    entry.put("open", r.ok());
                    entry.put("latency", r.latencyMs());
                    entry.put("duration_ms", Stats.round((System.nanoTime() - started) / 1_000_000.0, 1));
                    return entry;
                }));
            }
        }
        List<Map<String, Object>> results = new ArrayList<>();
        for (Future<Map<String, Object>> future : futures) {
            try {
                results.add(future.get());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (ExecutionException e) {
                throw new IllegalStateException("falha ao testar portas");
            }
        }
        return results;
    }
}
