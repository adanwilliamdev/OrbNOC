package dev.orbnoc.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/** Exporta o relatório de SLA em CSV (UTF-8 com BOM, abre direto no Excel) ou XLSX. */
public final class ReportExporter {

    public static final List<String> HEADERS = List.of(
            "Dispositivo", "Host", "Local", "Status", "Disponibilidade (%)", "Latência média (ms)", "Amostras",
            "Limite de latência (ms)");

    private ReportExporter() {}

    private static List<Object> cells(SlaService.SlaRow r) {
        return java.util.Arrays.asList(
                r.name(), r.ip(), r.location(), r.status(), r.uptimePct(), r.avgLatency(), r.sampleCount(), r.slaThresholdMs());
    }

    /** Evita injeção de fórmulas: texto iniciado por = + - @ vira texto literal. */
    static String safe(String value) {
        if (value == null || value.isEmpty()) return "";
        char c = value.charAt(0);
        return (c == '=' || c == '+' || c == '-' || c == '@' || c == '\t' || c == '\r') ? "'" + value : value;
    }

    static String csvField(String value) {
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    public static byte[] csv(List<SlaService.SlaRow> rows) {
        StringBuilder sb = new StringBuilder("\uFEFF");
        sb.append(String.join(",", HEADERS.stream().map(ReportExporter::csvField).toList())).append("\r\n");
        for (SlaService.SlaRow row : rows) {
            boolean first = true;
            for (Object cell : cells(row)) {
                if (!first) sb.append(',');
                first = false;
                if (cell == null) continue;
                sb.append(csvField(cell instanceof String s ? safe(s) : String.valueOf(cell)));
            }
            sb.append("\r\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    public static byte[] xlsx(List<SlaService.SlaRow> rows, String window) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("SLA " + window);
            Font bold = workbook.createFont();
            bold.setBold(true);
            CellStyle header = workbook.createCellStyle();
            header.setFont(bold);

            int[] widths = new int[HEADERS.size()];
            Row head = sheet.createRow(0);
            for (int i = 0; i < HEADERS.size(); i++) {
                Cell cell = head.createCell(i);
                cell.setCellValue(HEADERS.get(i));
                cell.setCellStyle(header);
                widths[i] = HEADERS.get(i).length();
            }
            int rowIndex = 1;
            for (SlaService.SlaRow row : rows) {
                Row r = sheet.createRow(rowIndex++);
                int col = 0;
                for (Object value : cells(row)) {
                    Cell cell = r.createCell(col);
                    if (value instanceof Number n) {
                        cell.setCellValue(n.doubleValue());
                        widths[col] = Math.max(widths[col], String.valueOf(value).length());
                    } else if (value != null) {
                        String text = safe(String.valueOf(value));
                        cell.setCellValue(text);
                        widths[col] = Math.max(widths[col], text.length());
                    }
                    col++;
                }
            }
            for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, Math.min(60, widths[i] + 2) * 256);
            sheet.createFreezePane(0, 1);
            workbook.write(out);
            return out.toByteArray();
        }
    }
}
