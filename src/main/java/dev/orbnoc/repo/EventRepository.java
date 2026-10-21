package dev.orbnoc.repo;

import dev.orbnoc.domain.Event;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, Pageable pageable);

    List<Event> findByUserIdAndAcknowledgedAtIsNullOrderByCreatedAtDescIdDesc(Long userId, Pageable pageable);

    Optional<Event> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndAcknowledgedAtIsNull(Long userId);

    @Modifying
    @Query("update Event e set e.acknowledgedAt = :now where e.userId = :userId and e.acknowledgedAt is null")
    int acknowledgeAll(@Param("userId") Long userId, @Param("now") Instant now);

    @Modifying
    @Query("delete from Event e where e.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
