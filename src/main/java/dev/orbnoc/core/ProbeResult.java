package dev.orbnoc.core;

/** Resultado de uma sonda de disponibilidade. {@code method}: icmp | tcp. */
public record ProbeResult(boolean ok, Double latencyMs, String method, Integer port, String error) {

    public static ProbeResult fail(String method, Integer port, String error) {
        return new ProbeResult(false, null, method, port, error);
    }
}
