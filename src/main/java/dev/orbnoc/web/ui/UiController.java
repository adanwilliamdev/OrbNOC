package dev.orbnoc.web.ui;

import dev.orbnoc.core.HostRejectedException;
import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.Event;
import dev.orbnoc.domain.User;
import dev.orbnoc.service.AuthService;
import dev.orbnoc.service.DeviceService;
import dev.orbnoc.service.DiagnosticFacade;
import dev.orbnoc.service.EventService;
import dev.orbnoc.service.SlaService;
import dev.orbnoc.service.UserService;
import dev.orbnoc.web.api.ApiException;
import dev.orbnoc.web.api.Dto;
import dev.orbnoc.web.api.ReportController;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/** Páginas HTML (Thymeleaf) e fragmentos que o navegador recarrega em tempo real. */
@Controller
public class UiController {

    public record BarRow(String name, String fullName, String valueText, int pct, String cls) {}

    public record AlertRow(Dto.EventOut event, String deviceName) {}

    public record ActivityBar(int count, int pct, String iso) {}

    private final AuthService auth;
    private final DeviceService devices;
    private final EventService events;
    private final SlaService sla;
    private final UserService users;
    private final DiagnosticFacade diagnostics;
    private final ViewHelper fmt;

    public UiController(
            AuthService auth,
            DeviceService devices,
            EventService events,
            SlaService sla,
            UserService users,
            DiagnosticFacade diagnostics,
            ViewHelper fmt) {
        this.auth = auth;
        this.devices = devices;
        this.events = events;
        this.sla = sla;
        this.users = users;
        this.diagnostics = diagnostics;
        this.fmt = fmt;
    }

    // ---- infraestrutura ------------------------------------------------------------------------------

    /** Usuário logado para páginas; {@code null} → o chamador redireciona para /login. */
    private User pageUser(HttpServletRequest request) {
        return auth.currentUserOrNull(request);
    }

    /** Usuário logado para fragmentos; sem sessão devolve 401 (o navegador manda para /login). */
    private User fragmentUser(HttpServletRequest request) {
        return auth.requireUser(request);
    }

    private void base(Model model, User user, String nav) {
        model.addAttribute("user", user);
        model.addAttribute("isAdmin", "admin".equals(user.getRole()));
        model.addAttribute("nav", nav);
        model.addAttribute("unread", events.unreadCount(user.getId()));
    }

    private List<Dto.DeviceOut> deviceViews(User user) {
        return devices.list(user.getId()).stream().map(Dto.DeviceOut::from).toList();
    }

    private static DeviceQuery.Params params(String q, String status, String min, String max, String sort, String dir) {
        return DeviceQuery.Params.of(q, status, min, max, sort, dir);
    }

    // ---- login ------------------------------------------------------------------------------------------

    @GetMapping("/login")
    String login(HttpServletRequest request) {
        return pageUser(request) != null ? "redirect:/" : "login";
    }

    // ---- painel ------------------------------------------------------------------------------------------

    @GetMapping("/")
    String dashboard(
            HttpServletRequest request,
            Model model,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "") String min,
            @RequestParam(defaultValue = "") String max,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "asc") String dir) {
        User user = pageUser(request);
        if (user == null) return "redirect:/login";
        base(model, user, "dashboard");
        model.addAttribute("p", params(q, status, min, max, sort, dir));
        fillTop(model, user);
        fillTable(model, user, params(q, status, min, max, sort, dir));
        return "dashboard";
    }

    @GetMapping("/ui/fragments/dashboard-top")
    String dashboardTop(HttpServletRequest request, Model model) {
        fillTop(model, fragmentUser(request));
        return "fragments/dashboard :: top";
    }

    @GetMapping("/ui/fragments/dashboard-table")
    String dashboardTable(
            HttpServletRequest request,
            Model model,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "") String min,
            @RequestParam(defaultValue = "") String max,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "asc") String dir) {
        fillTable(model, fragmentUser(request), params(q, status, min, max, sort, dir));
        return "fragments/dashboard :: table";
    }

    @GetMapping("/ui/fragments/alert-badge")
    String alertBadge(HttpServletRequest request, Model model) {
        model.addAttribute("unread", events.unreadCount(fragmentUser(request).getId()));
        return "fragments/layout :: badge";
    }

    private void fillTop(Model model, User user) {
        List<Dto.DeviceOut> all = deviceViews(user);
        DeviceQuery.Stats stats = DeviceQuery.stats(all);
        model.addAttribute("stats", stats);
        model.addAttribute("fleet", all.stream().sorted(Comparator.comparing(Dto.DeviceOut::name, String.CASE_INSENSITIVE_ORDER)).toList());

        // barras de latência (online com medida, maiores primeiro)
        List<Dto.DeviceOut> measured = all.stream()
                .filter(d -> "online".equals(d.status()) && d.latency() != null)
                .sorted(Comparator.comparing(Dto.DeviceOut::latency).reversed())
                .limit(15)
                .toList();
        double peak = measured.stream().mapToDouble(Dto.DeviceOut::latency).max().orElse(1);
        List<BarRow> bars = new ArrayList<>();
        for (Dto.DeviceOut d : measured) {
            String shortName = d.name().length() > 18 ? d.name().substring(0, 15) + "..." : d.name();
            bars.add(new BarRow(shortName, d.name(), fmt.ms(d.latency()),
                    (int) Math.max(4, Math.round(Math.sqrt(d.latency() / peak) * 100)), fmt.latencyClass(d.latency())));
        }
        model.addAttribute("bars", bars);

        // anel de status
        model.addAttribute("donut", Charts.donut(List.of(
                new Charts.Segment("Online", stats.online(), "seg-ok", "", ""),
                new Charts.Segment("Offline", stats.offline(), "seg-bad", "", ""),
                new Charts.Segment("Aguardando", stats.unknown(), "seg-idle", "", ""))));

        // histórico de disponibilidade (24 h)
        List<Map<String, Object>> series = sla.uptimeSeries(user.getId(), 24);
        List<Double> values = new ArrayList<>();
        List<String> isos = new ArrayList<>();
        for (Map<String, Object> point : series) {
            values.add((Double) point.get("uptime"));
            isos.add(String.valueOf(point.get("hour")));
        }
        double lo = values.stream().filter(v -> v != null).mapToDouble(v -> v).min().orElse(95);
        lo = Math.max(0, Math.min(Math.floor(lo - 2), 95));
        model.addAttribute("uptimeLine", Charts.line(isos, values, lo, 100, v -> String.format("%.0f", v), false));
        model.addAttribute("uptimeNow", values.stream().filter(v -> v != null).reduce((a, b) -> b).orElse(null));
        model.addAttribute("uptimeMin", lo);

        // últimos alertas
        model.addAttribute("recent", alertRows(user.getId(), false, 6, all));
        model.addAttribute("unread", events.unreadCount(user.getId()));
    }

    private void fillTable(Model model, User user, DeviceQuery.Params p) {
        List<Dto.DeviceOut> all = deviceViews(user);
        model.addAttribute("p", p);
        model.addAttribute("total", all.size());
        model.addAttribute("devices", DeviceQuery.apply(all, p));
    }

    private List<AlertRow> alertRows(Long userId, boolean unreadOnly, int limit, List<Dto.DeviceOut> all) {
        Map<Long, String> names = new HashMap<>();
        for (Dto.DeviceOut d : all) names.put(d.id(), d.name());
        List<AlertRow> rows = new ArrayList<>();
        for (Event e : events.list(userId, unreadOnly, limit)) {
            rows.add(new AlertRow(Dto.EventOut.from(e), e.getDeviceId() == null ? "Dispositivo removido" : names.getOrDefault(e.getDeviceId(), "Dispositivo removido")));
        }
        return rows;
    }

    // ---- alertas ---------------------------------------------------------------------------------------------

    @GetMapping("/alerts")
    String alerts(HttpServletRequest request, Model model, @RequestParam(defaultValue = "all") String f) {
        User user = pageUser(request);
        if (user == null) return "redirect:/login";
        base(model, user, "alerts");
        fillAlerts(model, user, f);
        return "alerts";
    }

    @GetMapping("/ui/fragments/alerts")
    String alertsFragment(HttpServletRequest request, Model model, @RequestParam(defaultValue = "all") String f) {
        fillAlerts(model, fragmentUser(request), f);
        return "fragments/alerts :: list";
    }

    private void fillAlerts(Model model, User user, String filter) {
        String f = List.of("all", "unread", "error", "warning").contains(filter) ? filter : "all";
        List<AlertRow> all = alertRows(user.getId(), false, 200, deviceViews(user));
        long unread = all.stream().filter(r -> r.event().acknowledgedAt() == null).count();
        long errors = all.stream().filter(r -> "error".equals(r.event().severity())).count();
        long warnings = all.stream().filter(r -> "warning".equals(r.event().severity())).count();
        List<AlertRow> shown = all.stream().filter(r -> switch (f) {
            case "unread" -> r.event().acknowledgedAt() == null;
            case "error" -> "error".equals(r.event().severity());
            case "warning" -> "warning".equals(r.event().severity());
            default -> true;
        }).limit(100).toList();

        // atividade por hora nas últimas 24 h
        Instant now = Instant.now().truncatedTo(ChronoUnit.HOURS);
        int[] buckets = new int[24];
        for (AlertRow r : all) {
            long hoursAgo = Duration.between(r.event().createdAt().truncatedTo(ChronoUnit.HOURS), now).toHours();
            if (hoursAgo >= 0 && hoursAgo < 24) buckets[(int) (23 - hoursAgo)]++;
        }
        int top = Math.max(1, java.util.Arrays.stream(buckets).max().orElse(1));
        List<ActivityBar> activity = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            activity.add(new ActivityBar(buckets[i], buckets[i] == 0 ? 0 : Math.max(8, buckets[i] * 100 / top), now.minus(Duration.ofHours(23 - i)).toString()));
        }
        model.addAttribute("f", f);
        model.addAttribute("rows", shown);
        model.addAttribute("countAll", all.size());
        model.addAttribute("countUnread", unread);
        model.addAttribute("countErrors", errors);
        model.addAttribute("countWarnings", warnings);
        model.addAttribute("activity", activity);
    }

    // ---- mapa de rede -----------------------------------------------------------------------------------------

    @GetMapping("/network-map")
    String networkMap(HttpServletRequest request, Model model, @RequestParam(defaultValue = "hierarchical") String mode) {
        User user = pageUser(request);
        if (user == null) return "redirect:/login";
        base(model, user, "network-map");
        fillMap(model, user, mode);
        return "network-map";
    }

    @GetMapping("/ui/fragments/network-map")
    String networkMapFragment(HttpServletRequest request, Model model, @RequestParam(defaultValue = "hierarchical") String mode) {
        fillMap(model, fragmentUser(request), mode);
        return "fragments/network-map :: map";
    }

    private void fillMap(Model model, User user, String modeParam) {
        String mode = NetworkLayout.normalizeMode(modeParam);
        List<Dto.DeviceOut> all = deviceViews(user);
        model.addAttribute("mode", mode);
        model.addAttribute("stats", DeviceQuery.stats(all));
        model.addAttribute("layout", NetworkLayout.build(all, mode, "OrbNOC", "Núcleo de monitoramento", fmt));
    }

    // ---- relatórios -------------------------------------------------------------------------------------------

    @GetMapping("/reports")
    String reports(HttpServletRequest request, Model model, @RequestParam(defaultValue = "24h") String window) {
        User user = pageUser(request);
        if (user == null) return "redirect:/login";
        base(model, user, "reports");
        fillReport(model, user, window, true);
        return "reports";
    }

    @GetMapping("/reports/print")
    String reportPrint(HttpServletRequest request, Model model, @RequestParam(defaultValue = "24h") String window) {
        User user = pageUser(request);
        if (user == null) return "redirect:/login";
        model.addAttribute("user", user);
        fillReport(model, user, window, false);
        model.addAttribute("generatedAt", Instant.now());
        return "report-print";
    }

    private void fillReport(Model model, User user, String windowParam, boolean charts) {
        String window = SlaService.WINDOWS.containsKey(windowParam) ? windowParam : "24h";
        List<Device> list = devices.list(user.getId());
        List<SlaService.SlaRow> rows = sla.report(list, window);
        model.addAttribute("window", window);
        model.addAttribute("rows", rows);
        model.addAttribute("totals", ReportController.totals(list, rows));
        if (!charts) return;
        int hours = (int) SlaService.WINDOWS.get(window).toHours();
        List<Map<String, Object>> series = sla.uptimeSeries(user.getId(), hours);
        List<String> isos = new ArrayList<>();
        List<Double> uptime = new ArrayList<>();
        List<Double> latency = new ArrayList<>();
        for (Map<String, Object> point : series) {
            isos.add(String.valueOf(point.get("hour")));
            uptime.add((Double) point.get("uptime"));
            latency.add((Double) point.get("avgLatency"));
        }
        double lo = uptime.stream().filter(v -> v != null).mapToDouble(v -> v).min().orElse(90);
        lo = Math.max(0, Math.min(Math.floor(lo - 2), 95));
        double peak = latency.stream().filter(v -> v != null).mapToDouble(v -> v).max().orElse(10);
        model.addAttribute("uptimeChart", Charts.line(isos, uptime, lo, 100, v -> String.format("%.0f%%", v), true));
        model.addAttribute("latencyChart", Charts.line(isos, latency, 0, Math.max(10, Math.ceil(peak * 1.15)), v -> String.format("%.0f ms", v), true));
        model.addAttribute("xMode", hours <= 24 ? "hm" : "dmh");
    }

    // ---- diagnóstico ---------------------------------------------------------------------------------------------

    @GetMapping("/diagnostic")
    String diagnostic(HttpServletRequest request, Model model, @RequestParam(defaultValue = "full") String tool) {
        User user = pageUser(request);
        if (user == null) return "redirect:/login";
        base(model, user, "diagnostic");
        model.addAttribute("tool", List.of("full", "ping", "traceroute", "dns", "ports").contains(tool) ? tool : "full");
        return "diagnostic";
    }

    @PostMapping("/ui/diagnostic/run")
    String runDiagnostic(
            HttpServletRequest request,
            Model model,
            @RequestParam String tool,
            @RequestParam(defaultValue = "") String host,
            @RequestParam(name = "record_type", defaultValue = "A") String recordType,
            @RequestParam(defaultValue = "") String ports,
            @RequestParam(defaultValue = "4") int count,
            @RequestParam(name = "max_hops", defaultValue = "20") int maxHops) {
        User user = fragmentUser(request);
        model.addAttribute("tool", tool);
        try {
            List<Integer> portList = parsePorts(ports);
            Map<String, Object> result = switch (tool) {
                case "ping" -> diagnostics.ping(user.getId(), host, count);
                case "traceroute" -> diagnostics.traceroute(user.getId(), host, maxHops);
                case "dns" -> diagnostics.dns(user.getId(), host, recordType);
                case "ports" -> diagnostics.ports(user.getId(), host, portList);
                default -> diagnostics.full(user.getId(), host, portList);
            };
            model.addAttribute("r", result);
        } catch (ApiException e) {
            model.addAttribute("error", e.getMessage());
        } catch (HostRejectedException e) {
            model.addAttribute("error", e.getMessage());
        }
        return "fragments/diagnostic :: result";
    }

    private static List<Integer> parsePorts(String text) {
        List<Integer> ports = new ArrayList<>();
        for (String part : text.split("[,\\s;]+")) {
            if (part.isBlank()) continue;
            try {
                ports.add(Integer.parseInt(part.strip()));
            } catch (NumberFormatException e) {
                throw ApiException.unprocessable("Porta inválida: " + part);
            }
        }
        return ports;
    }

    // ---- usuários ----------------------------------------------------------------------------------------------------

    @GetMapping("/users")
    String users(HttpServletRequest request, Model model) {
        User user = pageUser(request);
        if (user == null) return "redirect:/login";
        if (!"admin".equals(user.getRole())) return "redirect:/";
        base(model, user, "users");
        model.addAttribute("list", users.list().stream().map(Dto.UserAdminOut::from).toList());
        return "users";
    }

    // ---- wallboard (tela cheia) -----------------------------------------------------------------------------------------

    @GetMapping("/wallboard")
    String wallboard(HttpServletRequest request, Model model) {
        User user = pageUser(request);
        if (user == null) return "redirect:/login";
        model.addAttribute("user", user);
        fillWall(model, user);
        return "wallboard";
    }

    @GetMapping("/ui/fragments/wallboard")
    String wallboardFragment(HttpServletRequest request, Model model) {
        fillWall(model, fragmentUser(request));
        return "fragments/wallboard :: board";
    }

    private void fillWall(Model model, User user) {
        List<Dto.DeviceOut> all = deviceViews(user);
        model.addAttribute("stats", DeviceQuery.stats(all));
        model.addAttribute("tiles", all.stream()
                .sorted(Comparator.comparingInt((Dto.DeviceOut d) -> "offline".equals(d.status()) ? 0 : "unknown".equals(d.status()) ? 1 : 2)
                        .thenComparing(Dto.DeviceOut::name, String.CASE_INSENSITIVE_ORDER))
                .toList());
    }
}
