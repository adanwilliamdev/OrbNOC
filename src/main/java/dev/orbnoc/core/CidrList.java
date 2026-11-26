package dev.orbnoc.core;

import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;

/** Lista de faixas CIDR (IPv4 e IPv6), usada como allowlist de alvos privados. */
public final class CidrList {

    private record Range(byte[] network, int prefix) {

        boolean contains(byte[] address) {
            if (address.length != network.length) return false;
            int full = prefix / 8;
            for (int i = 0; i < full; i++) if (address[i] != network[i]) return false;
            int rest = prefix % 8;
            if (rest == 0) return true;
            int mask = (0xff << (8 - rest)) & 0xff;
            return (address[full] & mask) == (network[full] & mask);
        }
    }

    public static final CidrList EMPTY = new CidrList(List.of());

    private final List<Range> ranges;

    private CidrList(List<Range> ranges) {
        this.ranges = ranges;
    }

    /** "10.0.0.0/8, 192.168.1.0/24, fd00::/8, 172.16.5.9"; vazio devolve {@link #EMPTY}. */
    public static CidrList parse(String text) {
        if (text == null || text.isBlank()) return EMPTY;
        List<Range> out = new ArrayList<>();
        for (String raw : text.split("[,;\\s]+")) {
            String item = raw.strip();
            if (item.isEmpty()) continue;
            int slash = item.indexOf('/');
            String host = slash < 0 ? item : item.substring(0, slash);
            InetAddress ip = NetGuard.parseIpLiteral(host);
            if (ip == null) throw new IllegalArgumentException("CIDR inválido: " + item);
            byte[] bytes = ip.getAddress();
            int max = bytes.length * 8;
            int prefix = max;
            if (slash >= 0) {
                try {
                    prefix = Integer.parseInt(item.substring(slash + 1));
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("CIDR inválido: " + item);
                }
                if (prefix < 0 || prefix > max) throw new IllegalArgumentException("CIDR inválido: " + item);
            }
            out.add(new Range(bytes, prefix));
        }
        return out.isEmpty() ? EMPTY : new CidrList(List.copyOf(out));
    }

    public boolean isEmpty() {
        return ranges.isEmpty();
    }

    public boolean contains(InetAddress ip) {
        byte[] address = ip.getAddress();
        for (Range r : ranges) if (r.contains(address)) return true;
        return false;
    }
}
