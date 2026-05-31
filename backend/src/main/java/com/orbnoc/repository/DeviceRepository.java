package com.orbnoc.repository;

import com.orbnoc.domain.Device;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DeviceRepository extends JpaRepository<Device, Long> {
    List<Device> findByActiveTrue();
}