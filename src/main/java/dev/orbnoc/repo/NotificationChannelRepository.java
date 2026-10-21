package dev.orbnoc.repo;

import dev.orbnoc.domain.NotificationChannel;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationChannelRepository extends JpaRepository<NotificationChannel, Long> {

    Optional<NotificationChannel> findByUserIdAndKind(Long userId, String kind);
}
