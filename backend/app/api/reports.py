import csv
import io
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Query
from fastapi.responses import Response
from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import func, select

from app.api.deps import CurrentUser, SessionDep
from app.db.models import Device, MetricHourly
from app.services.sla import hour_floor, sla_report

router = APIRouter(prefix="/api", tags=["reports"])

Window = Literal["24h", "7d", "30d"]
COLUMNS = [
    "Dispositivo",
    "Host",
    "Localização",
    "Status",
    "Uptime (%)",
    "Latência média (ms)",
    "Amostras",
    "Limite SLA (ms)",
]


def _safe(value):
    """Neutraliza injeção de fórmula em planilhas (=, +, -, @ no início da célula)."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


def _rows(report: list[dict]) -> list[list]:
    return [
        [
            _safe(r["name"]),
            _safe(r["ip"]),
            _safe(r["location"] or ""),
            r["status"],
            r["uptime_pct"],
            r["avg_latency"],
            r["sample_count"],
            r["sla_threshold_ms"],
        ]
        for r in report
    ]


@router.get("/sla")
async def sla_overview(user: CurrentUser, session: SessionDep, window: Window = "24h") -> dict:
    return {"window": window, "devices": await sla_report(session, user.id, window)}


@router.get("/uptime-series")
async def uptime_series(
    user: CurrentUser, session: SessionDep, hours: int = Query(24, ge=1, le=720)
) -> list[dict]:
    """Série por hora (uptime, latência, online/offline) — substitui o histórico do localStorage."""
    since = hour_floor(datetime.now(UTC) - timedelta(hours=hours))
    rows = await session.execute(
        select(
            MetricHourly.hour,
            func.count().filter(MetricHourly.ok_samples > 0),
            func.count().filter(MetricHourly.ok_samples == 0),
            func.sum(MetricHourly.samples),
            func.sum(MetricHourly.ok_samples),
            func.sum(MetricHourly.avg_latency * MetricHourly.ok_samples),
        )
        .join(Device, Device.id == MetricHourly.device_id)
        .where(Device.user_id == user.id, MetricHourly.hour >= since)
        .group_by(MetricHourly.hour)
        .order_by(MetricHourly.hour)
    )
    series = []
    for hour, online, offline, samples, ok, weighted in rows:
        samples, ok = int(samples or 0), int(ok or 0)
        series.append(
            {
                "timestamp": hour.isoformat(),
                "online": online,
                "offline": offline,
                "total": online + offline,
                "uptime": round(ok / samples * 100, 2) if samples else 0,
                "avgLatency": round(float(weighted) / ok, 2) if ok and weighted else 0,
            }
        )
    return series


@router.get("/reports/summary")
async def report_summary(user: CurrentUser, session: SessionDep, window: Window = "24h") -> dict:
    report = await sla_report(session, user.id, window)
    measured = [r["uptime_pct"] for r in report if r["uptime_pct"] is not None]
    return {
        "window": window,
        "generated_at": datetime.now(UTC).isoformat(),
        "devices": report,
        "average_uptime_pct": round(sum(measured) / len(measured), 3) if measured else None,
        "total_devices": len(report),
    }


@router.get("/reports/export")
async def export_report(
    user: CurrentUser,
    session: SessionDep,
    format: Literal["csv", "xlsx"] = "csv",
    window: Window = "24h",
) -> Response:
    rows = _rows(await sla_report(session, user.id, window))
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M")
    filename = f"orbnoc-sla-{window}-{stamp}.{format}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(COLUMNS)
        writer.writerows(rows)
        return Response(
            "\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8", headers=headers
        )
    wb = Workbook()
    ws = wb.active
    ws.title = f"SLA {window}"
    ws.append(COLUMNS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row in rows:
        ws.append(row)
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = (
            max(len(str(c.value or "")) for c in col) + 2
        )
    out = io.BytesIO()
    wb.save(out)
    return Response(
        out.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
