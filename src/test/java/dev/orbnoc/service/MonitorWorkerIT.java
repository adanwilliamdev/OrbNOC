package dev.orbnoc.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.Event;
import dev.orbnoc.domain.User;
import dev.orbnoc.repo.DeviceRepository;
import dev.orbnoc.repo.EventRepository;
import dev.orbnoc.repo.MetricRepository;
import dev.orbnoc.support.IntegrationTestBase;
import dev.orbnoc.web.api.Dto;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Ciclo completo do monitor contra o banco real: seleção de dispositivos vencidos, máquina de
 * estados, gravação de métricas e geração de eventos. O relógio é injetado em {@code runRound}.
 */
class MonitorWorkerIT extends IntegrationTestBase {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");

    @Autowired MonitorWorker worker;
    @Autowired DeviceService deviceService;
    @Autowired DeviceRepository devices;
    @Autowired MetricRepository metrics;
    @Autowired EventRepository events;

    private User dono;

    @BeforeEach
    void usuario() {
        dono = createUser("ana", SENHA, "user");
    }

    private Device novoDispositivo(String ip, int limiteDeFalhas, Integer limiteDeLatencia) {
        return deviceService.create(
                dono.getId(), new Dto.DeviceCreateIn("host " + ip, ip, null, "icmp", null, 30, limiteDeFalhas, limiteDeLatencia));
    }

    private Device recarregar(Device d) {
        return devices.findById(d.getId()).orElseThrow();
    }

    /** Tipos dos eventos do usuário, do mais recente para o mais antigo. */
    private List<String> eventos() {
        return events.findByUserIdOrderByCreatedAtDescIdDesc(dono.getId(), 50).stream()
                .map(Event::getKind)
                .toList();
    }

    @Test
    void primeiraRodadaMarcaOnlineEGravaMetricaSemAlerta() {
        probeReturns(up(15.0));
        Device d = novoDispositivo("10.0.0.1", 3, null);

        var rodada = worker.runRound(T0);

        assertEquals(1, rodada.checked());
        Device depois = recarregar(d);
        assertEquals("online", depois.getStatus());
        assertEquals(15.0, depois.getLatency());
        assertEquals(0, depois.getConsecutiveFailures());
        assertNotNull(depois.getLastCheck());
        assertEquals(1, metrics.count());
        assertEquals(List.of(), eventos());
    }

    @Test
    void sohFicaOfflineAposOLimiteDeFalhasEAlertaUmaVez() {
        probeReturns(down(), down(), down());
        Device d = novoDispositivo("10.0.0.2", 2, null);

        worker.runRound(T0);
        Device aposPrimeira = recarregar(d);
        assertEquals("unknown", aposPrimeira.getStatus(), "uma falha isolada não derruba o host");
        assertEquals(1, aposPrimeira.getConsecutiveFailures());
        assertEquals(List.of(), eventos());

        worker.runRound(T0.plusSeconds(30));
        Device aposSegunda = recarregar(d);
        assertEquals("offline", aposSegunda.getStatus());
        assertEquals("timeout", aposSegunda.getLastError());
        assertEquals(List.of("offline"), eventos());

        worker.runRound(T0.plusSeconds(60));
        assertEquals("offline", recarregar(d).getStatus());
        assertEquals(3, recarregar(d).getConsecutiveFailures());
        assertEquals(List.of("offline"), eventos(), "continuar offline não repete o alerta");
        assertEquals(3, metrics.count());
    }

    @Test
    void recuperacaoGeraEventoERezeraFalhas() {
        probeReturns(down(), down(), up(8.0));
        Device d = novoDispositivo("10.0.0.3", 2, null);

        worker.runRound(T0);
        worker.runRound(T0.plusSeconds(30));
        worker.runRound(T0.plusSeconds(60));

        Device depois = recarregar(d);
        assertEquals("online", depois.getStatus());
        assertEquals(0, depois.getConsecutiveFailures());
        assertNull(depois.getLastError());
        assertEquals(List.of("recovered", "offline"), eventos());
    }

    @Test
    void naoChecaAntesDoIntervalo() {
        probeReturns(up(10.0));
        novoDispositivo("10.0.0.4", 3, null);

        assertEquals(1, worker.runRound(T0).checked());
        assertEquals(0, worker.runRound(T0.plusSeconds(5)).checked());
        verify(prober, times(1)).probe(anyString(), anyString(), any());

        assertEquals(1, worker.runRound(T0.plusSeconds(30)).checked());
        verify(prober, times(2)).probe(anyString(), anyString(), any());
    }

    @Test
    void limiteDeLatenciaGeraEventoDeViolacaoEDeRecuperacao() {
        probeReturns(up(120.0), up(10.0));
        Device d = novoDispositivo("10.0.0.5", 3, 50);

        worker.runRound(T0);
        assertEquals(List.of("sla_breach"), eventos());
        assertEquals(true, recarregar(d).isSlaBreached());

        worker.runRound(T0.plusSeconds(30));
        assertEquals(List.of("sla_recovered", "sla_breach"), eventos());
        assertEquals(false, recarregar(d).isSlaBreached());
    }

    @Test
    void dispositivosDeUsuarioDesativadoNaoSaoMonitorados() {
        novoDispositivo("10.0.0.6", 3, null);
        jdbc.update("UPDATE users SET is_active = false WHERE id = ?", dono.getId());

        assertEquals(0, worker.runRound(T0).checked());
        verify(prober, never()).probe(anyString(), anyString(), any());
        assertEquals(0, metrics.count());
    }

    @Test
    void alvoProibidoViraFalhaSemChegarAoProber() {
        // Gravado direto no banco: a API já recusaria este host, mas o monitor também se defende.
        Device d = new Device();
        d.setUserId(dono.getId());
        d.setName("loopback");
        d.setIp("127.0.0.1");
        d = devices.save(d);

        assertEquals(1, worker.runRound(T0).checked());

        verify(prober, never()).probe(anyString(), anyString(), any());
        Device depois = recarregar(d);
        assertEquals(1, depois.getConsecutiveFailures());
        assertNotNull(depois.getLastError());
    }

    @Test
    void semDispositivosNaoHaTrabalho() {
        assertEquals(0, worker.runRound(T0).checked());
        verify(prober, never()).probe(anyString(), anyString(), any());
    }
}
