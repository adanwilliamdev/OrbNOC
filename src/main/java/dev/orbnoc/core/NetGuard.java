package dev.orbnoc.core;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Validação de hosts alvo (diagnóstico e monitor).
 *
 * <p>Sempre bloqueados: loopback, link-local (inclui 169.254.169.254), não especificado,
 * multicast, reservado e endereços de metadata de nuvem. Redes privadas ficam liberadas por
 * padrão ({@code ALLOW_PRIVATE_NETWORKS}), porque monitorar a LAN é o objetivo do produto.
 */
public final class NetGuard {

    private static final String LABEL = "[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?";
    private static final Pattern HOSTNAME =
            Pattern.compile("(?=.{1,253}\\z)" + LABEL + "(?:\\." + LABEL + ")*");
    private static final Pattern IPV4 = Pattern.compile("(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})");
    private static final Pattern IPV6_CHARS = Pattern.compile("[0-9A-Fa-f:.]+");

    private static final Set<InetAddress> METADATA = Set.of(
            literal("169.254.169.254"), // AWS, GCP, Azure, DigitalOcean...
            literal("fd00:ec2::254"), // AWS IPv6
            literal("100.100.100.200"), // Alibaba Cloud
            literal("192.0.0.192")); // Oracle Cloud

    private static final ExecutorService RESOLVER = Executors.newVirtualThreadPerTaskExecutor();

    private NetGuard() {}

    private static InetAddress literal(String text) {
        InetAddress ip = parseIpLiteral(text);
        if (ip == null) throw new IllegalStateException("literal inválido: " + text);
        return ip;
    }

    /** Valida a sintaxe (IP ou hostname) e devolve o valor normalizado. Não resolve DNS. */
    public static String parseHost(String value) {
        String host = value == null ? "" : value.strip();
        while (host.endsWith(".")) host = host.substring(0, host.length() - 1);
        if (host.startsWith("[") && host.endsWith("]")) host = host.substring(1, host.length() - 1);
        if (host.isEmpty()) throw new HostRejectedException("Host é obrigatório");
        if (host.startsWith("-")) throw new HostRejectedException("Host inválido");
        InetAddress ip = parseIpLiteral(host);
        if (ip != null) return format(ip);
        if (!HOSTNAME.matcher(host).matches()) throw new HostRejectedException("Host inválido");
        return host.toLowerCase();
    }

    /** Interpreta um IP literal (v4 ou v6) sem nunca consultar DNS. {@code null} se não for IP. */
    public static InetAddress parseIpLiteral(String host) {
        Matcher m = IPV4.matcher(host);
        if (m.matches()) {
            byte[] bytes = new byte[4];
            for (int i = 0; i < 4; i++) {
                String part = m.group(i + 1);
                if (part.length() > 1 && part.startsWith("0")) return null;
                int v = Integer.parseInt(part);
                if (v > 255) return null;
                bytes[i] = (byte) v;
            }
            try {
                return InetAddress.getByAddress(bytes);
            } catch (UnknownHostException e) {
                return null;
            }
        }
        if (host.indexOf(':') >= 0 && IPV6_CHARS.matcher(host).matches()) {
            try {
                return InetAddress.getByName(host); // literal: não consulta DNS
            } catch (UnknownHostException e) {
                return null;
            }
        }
        return null;
    }

    /** Texto canônico do endereço (IPv6 comprimido, conforme a RFC 5952). */
    public static String format(InetAddress ip) {
        byte[] a = ip.getAddress();
        if (ip instanceof Inet4Address) {
            return (a[0] & 0xff) + "." + (a[1] & 0xff) + "." + (a[2] & 0xff) + "." + (a[3] & 0xff);
        }
        int[] g = new int[8];
        for (int i = 0; i < 8; i++) g[i] = ((a[2 * i] & 0xff) << 8) | (a[2 * i + 1] & 0xff);
        int bestStart = -1;
        int bestLen = 0;
        for (int i = 0; i < 8; ) {
            if (g[i] == 0) {
                int j = i;
                while (j < 8 && g[j] == 0) j++;
                if (j - i > bestLen) {
                    bestLen = j - i;
                    bestStart = i;
                }
                i = j;
            } else {
                i++;
            }
        }
        if (bestLen < 2) bestStart = -1;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            if (i == bestStart) {
                sb.append("::");
                i += bestLen - 1;
                continue;
            }
            if (sb.length() > 0 && sb.charAt(sb.length() - 1) != ':') sb.append(':');
            sb.append(Integer.toHexString(g[i]));
        }
        return sb.toString();
    }

    public static void checkAddress(InetAddress ip, boolean allowPrivate) {
        checkAddress(ip, allowPrivate, CidrList.EMPTY);
    }

    /**
     * Como {@link #checkAddress(InetAddress, boolean)}, mas, se {@code privateAllowlist} não estiver
     * vazia, endereços privados só passam quando estão dentro dela (política para usuários comuns).
     */
    public static void checkAddress(InetAddress ip, boolean allowPrivate, CidrList privateAllowlist) {
        InetAddress embedded = embeddedIpv4(ip);
        if (embedded != null) {
            // NAT64 / 6to4: o tráfego sai para o IPv4 embutido, então ele segue as mesmas regras.
            checkAddress(embedded, allowPrivate, privateAllowlist);
        }
        if (isTeredo(ip)) throw new HostRejectedException("Endereço de túnel Teredo bloqueado");
        if (isLocalNat64(ip)) throw new HostRejectedException("Endereço NAT64 local bloqueado");
        if (METADATA.contains(ip)) throw new HostRejectedException("Endereço de metadata de nuvem bloqueado");
        if (ip.isLoopbackAddress()) throw new HostRejectedException("Endereço de loopback bloqueado");
        if (ip.isLinkLocalAddress()) throw new HostRejectedException("Endereço link-local bloqueado");
        if (ip.isAnyLocalAddress() || ip.isMulticastAddress() || isReserved(ip)) {
            throw new HostRejectedException("Endereço reservado bloqueado");
        }
        if (!isGlobal(ip)) {
            if (!allowPrivate) throw new HostRejectedException("Redes privadas estão desativadas neste servidor");
            if (!privateAllowlist.isEmpty() && !privateAllowlist.contains(ip)) {
                throw new HostRejectedException("Este endereço privado não está liberado para o seu perfil");
            }
        }
    }

    /**
     * IPv4 embutido em endereços de tradução/túnel: NAT64 {@code 64:ff9b::/96} (RFC 6052, últimos
     * 32 bits) e 6to4 {@code 2002::/16} (RFC 3056, bytes 2 a 5). {@code null} nos demais.
     */
    static InetAddress embeddedIpv4(InetAddress ip) {
        if (!(ip instanceof Inet6Address)) return null;
        byte[] a = ip.getAddress();
        byte[] v4 = null;
        if (a[0] == 0x00 && a[1] == 0x64 && (a[2] & 0xff) == 0xff && (a[3] & 0xff) == 0x9b && onlyZero(a, 4, 12)) {
            v4 = new byte[] {a[12], a[13], a[14], a[15]};
        } else if ((a[0] & 0xff) == 0x20 && a[1] == 0x02) {
            v4 = new byte[] {a[2], a[3], a[4], a[5]};
        }
        try {
            return v4 == null ? null : InetAddress.getByAddress(v4);
        } catch (UnknownHostException e) {
            return null;
        }
    }

    private static boolean onlyZero(byte[] a, int from, int to) {
        for (int i = from; i < to; i++) if (a[i] != 0) return false;
        return true;
    }

    /** Teredo {@code 2001:0::/32} (RFC 4380): túnel que esconde o IPv4 do cliente; sempre bloqueado. */
    private static boolean isTeredo(InetAddress ip) {
        if (!(ip instanceof Inet6Address)) return false;
        byte[] a = ip.getAddress();
        return a[0] == 0x20 && a[1] == 0x01 && a[2] == 0 && a[3] == 0;
    }

    /** NAT64 de uso local {@code 64:ff9b:1::/48} (RFC 8215): não tem destino público definido. */
    private static boolean isLocalNat64(InetAddress ip) {
        if (!(ip instanceof Inet6Address)) return false;
        byte[] a = ip.getAddress();
        return a[0] == 0x00 && a[1] == 0x64 && (a[2] & 0xff) == 0xff && (a[3] & 0xff) == 0x9b && a[4] == 0 && a[5] == 1;
    }

    private static boolean isReserved(InetAddress ip) {
        byte[] a = ip.getAddress();
        if (ip instanceof Inet4Address) return (a[0] & 0xff) >= 240; // 240.0.0.0/4 (inclui broadcast)
        if (embeddedIpv4(ip) != null && a[0] == 0) return false; // NAT64: o IPv4 embutido já foi validado
        return (a[0] & 0xff) == 0; // ::/8
    }

    private static boolean isGlobal(InetAddress ip) {
        byte[] a = ip.getAddress();
        int b0 = a[0] & 0xff;
        int b1 = a[1] & 0xff;
        int b2 = a[2] & 0xff;
        if (ip instanceof Inet4Address) {
            if (b0 == 0 || b0 == 10) return false;
            if (b0 == 172 && b1 >= 16 && b1 <= 31) return false;
            if (b0 == 192 && b1 == 168) return false;
            if (b0 == 100 && b1 >= 64 && b1 <= 127) return false; // CGNAT 100.64.0.0/10
            if (b0 == 192 && b1 == 0 && (b2 == 0 || b2 == 2)) return false;
            if (b0 == 198 && (b1 == 18 || b1 == 19)) return false;
            if (b0 == 198 && b1 == 51 && b2 == 100) return false;
            return !(b0 == 203 && b1 == 0 && b2 == 113);
        }
        if ((b0 & 0xfe) == 0xfc) return false; // fc00::/7
        if (b0 == 0xfe && (b1 & 0xc0) == 0xc0) return false; // fec0::/10 (site-local, obsoleto)
        return !(b0 == 0x20 && b1 == 0x01 && b2 == 0x0d && (a[3] & 0xff) == 0xb8); // 2001:db8::/32
    }

    /** Resolve o host e valida TODOS os endereços. Devolve os IPs (use-os para conectar). */
    public static List<String> resolveAndCheck(String host, boolean allowPrivate, long timeoutMillis) {
        return resolveAndCheck(host, allowPrivate, CidrList.EMPTY, timeoutMillis);
    }

    public static List<String> resolveAndCheck(
            String host, boolean allowPrivate, CidrList privateAllowlist, long timeoutMillis) {
        String parsed = parseHost(host);
        Set<InetAddress> addresses = new LinkedHashSet<>();
        InetAddress literal = parseIpLiteral(parsed);
        if (literal != null) {
            addresses.add(literal);
        } else {
            Future<InetAddress[]> future = RESOLVER.submit(() -> InetAddress.getAllByName(parsed));
            try {
                addresses.addAll(List.of(future.get(timeoutMillis, TimeUnit.MILLISECONDS)));
            } catch (TimeoutException | ExecutionException e) {
                future.cancel(true);
                throw new HostRejectedException("Não foi possível resolver o host");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new HostRejectedException("Não foi possível resolver o host");
            }
        }
        if (addresses.isEmpty()) throw new HostRejectedException("Não foi possível resolver o host");
        for (InetAddress ip : addresses) checkAddress(ip, allowPrivate, privateAllowlist);
        List<InetAddress> ordered = new ArrayList<>(addresses);
        ordered.sort((x, y) -> Integer.compare(x instanceof Inet6Address ? 6 : 4, y instanceof Inet6Address ? 6 : 4));
        return ordered.stream().map(NetGuard::format).toList();
    }
}
