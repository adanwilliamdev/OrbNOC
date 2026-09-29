"""Relatório de disponibilidade por período (JSON, CSV e XLSX)."""

import csv
import io
from datetime import UTC, datetime

from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Device, Event
from app.services.sla import WINDOWS, compute_sla

HEADERS = [
    "Nome",
    "Host",
    "Local",
    "Verificação",
    "Status atual",
    "Disponibilidade (%)",
    "Latência média (ms)",
    "Amostras",
    "Incidentes",
]
_CSV_DANGEROUS = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value):
    """Impede injeção de fórmulas: nomes vindos do usuário nunca podem começar como fórmula no Excel."""
    if isinstance(value, str) and value.startswith(_CSV_DANGEROUS):
        return "'" + value
    return value


async def build_report(session: AsyncSession, owner_id: int, period: str) -> dict:
    delta = WINDOWS[period]
    now = datetime.now(UTC)
    since = now - delta
    devices = list(
        await session.scalars(
            select(Device).where(Device.owner_id == owner_id).order_by(Device.name, Device.id)
        )
    )
    stats = await compute_sla(session, [d.id for d in devices], since, now)
    incidents = dict(
        (
            await session.execute(
                select(Event.device_id, func.count())
                .where(
                    Event.owner_id == owner_id,
                    Event.kind == "down",
                    Event.created_at >= since,
                    Event.device_id.is_not(None),
                )
                .group_by(Event.device_id)
            )
        ).all()
    )
    rows = [
        {
            "id": d.id,
            "name": d.name,
            "ip": d.ip,
            "location": d.location,
            "check_type": d.check_type,
            "status": d.status,
            "uptime_pct": stats[d.id].uptime_pct,
            "avg_latency_ms": stats[d.id].avg_latency,
            "samples": stats[d.id].samples,
            "incidents": incidents.get(d.id, 0),
        }
        for d in devices
    ]
    measured = [r["uptime_pct"] for r in rows if r["uptime_pct"] is not None]
    return {
        "period": period,
        "generated_at": now,
        "since": since,
        "summary": {
            "devices": len(rows),
            "avg_uptime_pct": round(sum(measured) / len(measured), 3) if measured else None,
            "incidents": sum(r["incidents"] for r in rows),
        },
        "devices": rows,
    }


def _table(report: dict) -> list[list]:
    return [
        [
            safe_cell(r["name"]),
            safe_cell(r["ip"]),
            safe_cell(r["location"] or ""),
            r["check_type"],
            r["status"],
            r["uptime_pct"],
            r["avg_latency_ms"],
            r["samples"],
            r["incidents"],
        ]
        for r in report["devices"]
    ]


def to_csv(report: dict) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(HEADERS)
    writer.writerows(_table(report))
    return ("\ufeff" + buf.getvalue()).encode("utf-8")  # BOM: o Excel abre acentos corretamente


def to_xlsx(report: dict) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = f"Disponibilidade {report['period']}"
    ws.append(HEADERS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row in _table(report):
        ws.append(row)
    for column, width in zip("ABCDEFGHI", (28, 26, 22, 12, 12, 20, 20, 10, 11), strict=True):
        ws.column_dimensions[column].width = width
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
