package dev.orbnoc.repo;

import dev.orbnoc.domain.MetricHourly;
import dev.orbnoc.domain.MetricHourlyId;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MetricHourlyRepository extends JpaRepository<MetricHourly, MetricHourlyId> {

    List<MetricHourly> findByDeviceIdAndHourStartGreaterThanEqualOrderByHourStartAsc(Long deviceId, Instant since);

    /** Linhas: deviceId, soma de amostras, soma de amostras ok, soma de (latência média × ok). */
    @Query("select m.deviceId, sum(m.samples), sum(m.okSamples), sum(m.avgLatency * m.okSamples) "
            + "from MetricHourly m where m.deviceId in :ids and m.hourStart >= :since group by m.deviceId")
    List<Object[]> aggregateByDevice(@Param("ids") Collection<Long> ids, @Param("since") Instant since);

    /** Linhas: hora, online, offline, amostras, amostras ok, soma de (latência média × ok). */
    @Query("select m.hourStart, "
            + "sum(case when m.okSamples > 0 then 1 else 0 end), "
            + "sum(case when m.okSamples = 0 then 1 else 0 end), "
            + "sum(m.samples), sum(m.okSamples), sum(m.avgLatency * m.okSamples) "
            + "from MetricHourly m, Device d where d.id = m.deviceId and d.userId = :userId and m.hourStart >= :since "
            + "group by m.hourStart order by m.hourStart")
    List<Object[]> uptimeSeries(@Param("userId") Long userId, @Param("since") Instant since);

    @Modifying
    @Query("delete from MetricHourly m where m.hourStart < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
