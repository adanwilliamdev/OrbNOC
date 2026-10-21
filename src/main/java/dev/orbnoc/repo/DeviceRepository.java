package dev.orbnoc.repo;

import dev.orbnoc.domain.Device;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DeviceRepository extends JpaRepository<Device, Long> {

    List<Device> findByUserIdOrderByIdAsc(Long userId);

    Optional<Device> findByIdAndUserId(Long id, Long userId);

    List<Device> findByIdInOrderByIdAsc(Collection<Long> ids);

    /** Dispositivos de usuários ativos (os de usuários desativados deixam de ser monitorados). */
    @Query("select d from Device d, User u where u.id = d.userId and u.active = true order by d.id")
    List<Device> findMonitorable();
}
