package dev.orbnoc.core;

import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/** Rate limit em memória, janela fixa por chave. */
public final class RateLimiter {

    private record Window(int count, long expiresAt) {}

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final LongSupplier clock;

    public RateLimiter() {
        this(System::currentTimeMillis);
    }

    RateLimiter(LongSupplier clock) {
        this.clock = clock;
    }

    public boolean isBlocked(String key, int limit) {
        Window w = windows.get(key);
        return w != null && w.expiresAt() > clock.getAsLong() && w.count() >= limit;
    }

    /** Conta uma ocorrência na janela fixa e devolve o total. */
    public int hit(String key, int windowSeconds) {
        long now = clock.getAsLong();
        if (windows.size() > 10_000) windows.values().removeIf(w -> w.expiresAt() <= now);
        return windows.compute(key, (k, w) -> w == null || w.expiresAt() <= now
                        ? new Window(1, now + windowSeconds * 1000L)
                        : new Window(w.count() + 1, w.expiresAt()))
                .count();
    }

    public void clear(String key) {
        windows.remove(key);
    }
}
