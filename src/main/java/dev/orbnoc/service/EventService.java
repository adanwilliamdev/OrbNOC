package dev.orbnoc.service;

import dev.orbnoc.domain.Event;
import dev.orbnoc.repo.EventRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventService {

    private final EventRepository events;

    public EventService(EventRepository events) {
        this.events = events;
    }

    /** Deve rodar dentro de uma transação do chamador. */
    public Event record(Long userId, Long deviceId, String kind, String severity, String message) {
        Event e = new Event();
        e.setUserId(userId);
        e.setDeviceId(deviceId);
        e.setKind(kind);
        e.setSeverity(severity);
        e.setMessage(message);
        return events.save(e);
    }

    public List<Event> list(Long userId, boolean unreadOnly, int limit) {
        PageRequest page = PageRequest.of(0, limit);
        return unreadOnly
                ? events.findByUserIdAndAcknowledgedAtIsNullOrderByCreatedAtDescIdDesc(userId, page)
                : events.findByUserIdOrderByCreatedAtDescIdDesc(userId, page);
    }

    public long unreadCount(Long userId) {
        return events.countByUserIdAndAcknowledgedAtIsNull(userId);
    }

    @Transactional
    public boolean acknowledge(Long userId, Long eventId) {
        return events.findByIdAndUserId(eventId, userId).map(e -> {
            if (e.getAcknowledgedAt() == null) e.setAcknowledgedAt(Instant.now());
            events.save(e);
            return true;
        }).orElse(false);
    }

    @Transactional
    public int acknowledgeAll(Long userId) {
        return events.acknowledgeAll(userId, Instant.now());
    }
}
