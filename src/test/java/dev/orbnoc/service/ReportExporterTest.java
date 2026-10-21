package dev.orbnoc.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

class ReportExporterTest {

    private static SlaService.SlaRow row(String name, String location) {
        return new SlaService.SlaRow(1L, name, "10.0.0.1", location, "online", "24h", 99.95, 12.5, 120, 50);
    }

    @Test
    void csvTemBomCabecalhoELinhas() {
        String csv = new String(ReportExporter.csv(List.of(row("Roteador", null))), StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("\uFEFFDispositivo,Host,Local,Status"));
        assertTrue(csv.contains("\r\nRoteador,10.0.0.1,,online,99.95,12.5,120,50\r\n"));
    }

    @Test
    void csvEscapaAspasEVirgulas() {
        String csv = new String(ReportExporter.csv(List.of(row("Core, \"A\"", "Matriz"))), StandardCharsets.UTF_8);
        assertTrue(csv.contains("\"Core, \"\"A\"\"\""));
    }

    @Test
    void csvNeutralizaInjecaoDeFormula() {
        assertEquals("'=1+1", ReportExporter.safe("=1+1"));
        assertEquals("'@cmd", ReportExporter.safe("@cmd"));
        assertEquals("normal", ReportExporter.safe("normal"));
        String csv = new String(ReportExporter.csv(List.of(row("=HYPERLINK(\"x\")", null))), StandardCharsets.UTF_8);
        assertTrue(csv.contains("\"'=HYPERLINK(\"\"x\"\")\""));
    }
}
