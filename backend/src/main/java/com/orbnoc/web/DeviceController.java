package com.orbnoc.web;

import com.orbnoc.domain.Device;
import com.orbnoc.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DeviceController {

    private final DeviceRepository deviceRepository;

    @GetMapping
    public List<Device> getAll() {
        return deviceRepository.findAll();
    }

    @PostMapping
    public Device create(@RequestBody Device device) {
        return deviceRepository.save(device);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        deviceRepository.deleteById(id);
    }
}