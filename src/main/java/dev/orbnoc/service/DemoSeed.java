package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.domain.User;
import dev.orbnoc.repo.DeviceRepository;
import dev.orbnoc.repo.UserRepository;
import dev.orbnoc.web.api.ApiException;
import dev.orbnoc.web.api.Dto;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Semeia 20 hosts de demonstração para o admin quando {@code orbnoc.demo.seed=true}
 * ({@code ORBNOC_DEMO_SEED=true}; {@code SEED_DEMO_HOSTS} continua aceito). Sem a propriedade, o bean nem é
 * criado. É idempotente: hosts que já existem (mesmo usuário e IP) são ignorados, sem tentar inserir, então pode ficar ligado entre reinicializações.
 *
 * <p>Usa só IPs literais (sem DNS). Os 14 primeiros são resolvedores/serviços públicos conhecidos
 * (ficam online); os 6 últimos são IPs de rede privada que normalmente ficam offline, o que
 * demonstra alertas e eventos. Com {@code ALLOW_PRIVATE_NETWORKS=false} os privados são rejeitados
 * e apenas os públicos são criados.
 *
 * <p>Atenção: os offline disparam alertas no Telegram se o canal estiver configurado.
 */
@Component
@ConditionalOnProperty(name = "orbnoc.demo.seed", havingValue = "true")
@Order(2) // depois do AdminBootstrap (@Order(1)), que cria o usuário alvo
public class DemoSeed implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoSeed.class);

    private record Host(String name, String ip, String location, String checkType, Integer port, Integer sla) {}

    private static final List<Host> HOSTS = List.of(
            new Host("Google DNS 1", "8.8.8.8", "Mountain View, EUA", "icmp", null, 80),
            new Host("Google DNS 2", "8.8.4.4", "Mountain View, EUA", "icmp", null, 80),
            new Host("Cloudflare DNS 1", "1.1.1.1", "Anycast", "icmp", null, 60),
            new Host("Cloudflare DNS 2", "1.0.0.1", "Anycast", "icmp", null, 60),
            new Host("Quad9 DNS", "9.9.9.9", "Anycast", "icmp", null, 100),
            new Host("Quad9 DNS (sec.)", "149.112.112.112", "Anycast", "icmp", null, 100),
            new Host("OpenDNS 1", "208.67.222.222", "San Francisco, EUA", "icmp", null, 120),
            new Host("OpenDNS 2", "208.67.220.220", "San Francisco, EUA", "icmp", null, 120),
            new Host("AdGuard DNS", "94.140.14.14", "Anycast", "icmp", null, 150),
            new Host("Verisign DNS", "64.6.64.6", "Reston, EUA", "icmp", null, 150),
            new Host("CleanBrowsing DNS (TCP 53)", "185.228.168.9", "Anycast", "tcp", 53, null),
            new Host("Cloudflare.com (HTTPS)", "104.16.132.229", "Anycast", "tcp", 443, 200),
            new Host("Level3 DNS", "4.2.2.1", "EUA", "icmp", null, 150),
            new Host("Comodo DNS", "8.26.56.26", "EUA", "icmp", null, 200),
            new Host("Roteador de Borda", "192.168.10.1", "POP Central", "icmp", null, 5),
            new Host("Switch Core", "192.168.10.2", "POP Central", "icmp", null, 5),
            new Host("OLT Bairro Norte", "10.10.1.10", "Bairro Norte", "icmp", null, 20),
            new Host("OLT Bairro Sul", "10.10.2.10", "Bairro Sul", "icmp", null, 20),
            new Host("Servidor RADIUS", "10.0.0.5", "Datacenter", "tcp", 1812, 30),
            new Host("Câmera Torre 1", "10.20.0.31", "Torre 1", "tcp", 554, null));

    private final OrbNocProperties props;
    private final UserRepository users;
    private final DeviceRepository deviceRepo;
    private final DeviceService devices;

    public DemoSeed(OrbNocProperties props, UserRepository users, DeviceRepository deviceRepo, DeviceService devices) {
        this.props = props;
        this.users = users;
        this.deviceRepo = deviceRepo;
        this.devices = devices;
    }

    @Override
    public void run(ApplicationArguments args) {
        User admin = users.findFirstByUsernameOrEmail(props.adminUsername(), props.adminEmail().strip().toLowerCase()).orElse(null);
        if (admin == null) {
            log.warn("orbnoc.demo.seed ligado, mas o usuário '{}' não existe (defina ADMIN_PASSWORD); nada semeado",
                    props.adminUsername());
            return;
        }
        // O índice único é (usuário, IP): cada host precisa de um IP diferente.
        int created = 0;
        int skipped = 0;
        for (Host h : HOSTS) {
            if (deviceRepo.existsByUserIdAndIp(admin.getId(), h.ip())) {
                skipped++;
                continue;
            }
            try {
                devices.create(admin.getId(), new Dto.DeviceCreateIn(
                        h.name(), h.ip(), h.location(), h.checkType(), h.port(), 30, 3, h.sla()));
                created++;
            } catch (ApiException e) {
                skipped++;
                log.debug("Seed: '{}' ({}) ignorado: {}", h.name(), h.ip(), e.getMessage());
            }
        }
        log.info("Seed de demonstração: {} hosts criados, {} ignorados (já existiam ou rejeitados)", created, skipped);
    }
}
