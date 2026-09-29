from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_session
from app.services import reports

router = APIRouter(prefix="/reports", tags=["reports"])
Period = Literal["24h", "7d", "30d"]


@router.get("/summary")
async def summary(
    period: Period = "24h",
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await reports.build_report(session, user.id, period)


@router.get("/export.csv")
async def export_csv(
    period: Period = Query("24h"),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    data = reports.to_csv(await reports.build_report(session, user.id, period))
    return Response(
        data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="orbnoc-{period}.csv"'},
    )


@router.get("/export.xlsx")
async def export_xlsx(
    period: Period = Query("24h"),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    data = reports.to_xlsx(await reports.build_report(session, user.id, period))
    return Response(
        data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="orbnoc-{period}.xlsx"'},
    )
