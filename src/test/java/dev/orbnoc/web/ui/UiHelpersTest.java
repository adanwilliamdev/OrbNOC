package dev.orbnoc.web.ui;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.orbnoc.web.api.Dto;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class UiHelpersTest {

    private static Dto.DeviceOut device(long id, String name, String ip, String status, Double latency) {
        return new Dto.DeviceOut(id, name, ip, null, "icmp", null, 30, 3, null, false, status, latency,
                null, null, null, null, null, null, null, null, null);
    }

    private static final List<Dto.DeviceOut> DEVICES = List.of(
            device(1, "Zeta", "10.0.0.10", "online", 12.0),
            device(2, "alfa", "10.0.0.2", "offline", null),
            device(3, "Beta", "10.0.0.9", "online", 80.0));

    private static List<String> names(DeviceQuery.Params p) {
        return DeviceQuery.apply(DEVICES, p).stream().map(Dto.DeviceOut::name).toList();
    }

    @Test
    void ordenaNomesSemDiferenciarMaiusculas() {
        assertEquals(List.of("alfa", "Beta", "Zeta"), names(DeviceQuery.Params.of("", "all", "", "", "name", "asc")));
    }

    @Test
    void ordenaIpsDeFormaNatural() {
        List<String> ips = DeviceQuery.apply(DEVICES, DeviceQuery.Params.of("", "all", "", "", "ip", "asc"))
                .stream().map(Dto.DeviceOut::ip).toList();
        assertEquals(List.of("10.0.0.2", "10.0.0.9", "10.0.0.10"), ips);
    }

    @Test
    void latenciaVaziaFicaSempreNoFim() {
        assertEquals("alfa", names(DeviceQuery.Params.of("", "all", "", "", "latency", "asc")).get(2));
        assertEquals("alfa", names(DeviceQuery.Params.of("", "all", "", "", "latency", "desc")).get(2));
    }

    @Test
    void filtraPorStatusBuscaELatencia() {
        assertEquals(List.of("Beta", "Zeta"), names(DeviceQuery.Params.of("", "online", "", "", "name", "asc")));
        assertEquals(List.of("Beta"), names(DeviceQuery.Params.of("", "all", "20", "", "name", "asc")));
        assertEquals(List.of("Zeta"), names(DeviceQuery.Params.of("zet", "all", "", "", "name", "asc")));
    }

    @Test
    void parametrosInvalidosCaemNoPadrao() {
        DeviceQuery.Params p = DeviceQuery.Params.of(null, "xx", null, null, "foo", "up");
        assertEquals("all", p.status());
        assertEquals("name", p.sort());
        assertEquals("asc", p.dir());
    }

    @Test
    void estatisticasDaFrota() {
        DeviceQuery.Stats s = DeviceQuery.stats(DEVICES);
        assertEquals(3, s.total());
        assertEquals(2, s.online());
        assertEquals(1, s.offline());
        assertEquals(67, s.availability());
        assertEquals(46.0, s.avgLatency());
    }

    @Test
    void linhaDoGraficoQuebraNosVazios() {
        Charts.Line line = Charts.line(List.of("a", "b", "c", "d"), Arrays.asList(1.0, 2.0, null, 4.0), 0, 5,
                v -> String.format("%.0f", v), true);
        assertEquals(2, line.path().split("M").length - 1);
        assertEquals(5, line.yTicks().size());
        assertTrue(Charts.line(List.of(), List.of(), 0, 1, v -> "", true).empty());
    }

    @Test
    void anelSomaOTotal() {
        Charts.Donut donut = Charts.donut(List.of(
                new Charts.Segment("a", 3, "x", "", ""), new Charts.Segment("b", 0, "y", "", ""), new Charts.Segment("c", 1, "z", "", "")));
        assertEquals(4, donut.total());
        assertEquals(2, donut.segments().size());
        assertEquals(0, Charts.donut(List.of(new Charts.Segment("a", 0, "x", "", ""))).segments().size());
    }

    @Test
    void layoutDoMapaTemNucleoEUmaArestaPorDispositivo() {
        for (String mode : List.of("hierarchical", "radial", "grid")) {
            NetworkLayout.Layout layout = NetworkLayout.build(DEVICES, mode, "Núcleo", "x", new ViewHelper());
            assertEquals(DEVICES.size() + 1, layout.nodes().size());
            assertEquals(DEVICES.size(), layout.edges().size());
            assertTrue(layout.width() > 0 && layout.height() > 0);
        }
        assertEquals("hierarchical", NetworkLayout.normalizeMode("qualquer"));
    }
}
