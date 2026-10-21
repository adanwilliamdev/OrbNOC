package dev.orbnoc.repo;

import dev.orbnoc.domain.Metric;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MetricRepository extends JpaRepository<Metric, Long> {

    List<Metric> findByDeviceIdOrderByRecordedAtDesc(Long deviceId, Pageable pageable);

    List<Metric> findByDeviceIdAndRecordedAtGreaterThanEqualOrderByRecordedAtAsc(
            Long deviceId, Instant since, Pageable pageable);

    @Modifying
    @Query("delete from Metric m where m.recordedAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
