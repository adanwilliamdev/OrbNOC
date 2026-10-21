package dev.orbnoc.core;

/** Host inválido ou proibido. */
public class HostRejectedException extends RuntimeException {
    public HostRejectedException(String message) {
        super(message);
    }
}
