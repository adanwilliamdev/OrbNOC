"""
Funções de cálculo de progresso reutilizadas pelos routers de catalog, progress
e dashboard. Equivalente aos métodos calcularProgresso* de catalog.service.ts.
"""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models


def calcular_progresso_serie(db: Session, conteudo_id: int, user_id: int) -> float:
    total_episodios = (
        db.query(func.count(models.Episode.id))
        .join(models.Season, models.Episode.temporada_id == models.Season.id)
        .filter(models.Season.conteudo_id == conteudo_id)
        .scalar()
        or 0
    )
    if total_episodios == 0:
        # pode ser filme
        progresso = (
            db.query(models.UserProgress)
            .filter(models.UserProgress.usuario_id == user_id, models.UserProgress.conteudo_id == conteudo_id)
            .first()
        )
        return 100.0 if progresso and progresso.status == models.ProgressStatus.ASSISTIDO else 0.0

    assistidos = (
        db.query(func.count(models.UserProgress.id))
        .join(models.Episode, models.UserProgress.episodio_id == models.Episode.id)
        .join(models.Season, models.Episode.temporada_id == models.Season.id)
        .filter(
            models.UserProgress.usuario_id == user_id,
            models.UserProgress.status == models.ProgressStatus.ASSISTIDO,
            models.Season.conteudo_id == conteudo_id,
        )
        .scalar()
        or 0
    )
    return (100.0 * assistidos) / total_episodios


def calcular_progresso_em_lote(db: Session, conteudo_ids: list[int], user_id: int) -> dict[int, float]:
    """Calcula o progresso (0-100) de uma lista de conteúdos para um usuário."""
    resultado: dict[int, float] = {}
    if not conteudo_ids:
        return resultado

    episodios = (
        db.query(models.Episode.id, models.Season.conteudo_id)
        .join(models.Season, models.Episode.temporada_id == models.Season.id)
        .filter(models.Season.conteudo_id.in_(conteudo_ids))
        .all()
    )
    total_episodios_por_conteudo: dict[int, int] = {}
    for _ep_id, c_id in episodios:
        total_episodios_por_conteudo[c_id] = total_episodios_por_conteudo.get(c_id, 0) + 1

    progressos_series = (
        db.query(models.Season.conteudo_id)
        .join(models.Episode, models.Episode.temporada_id == models.Season.id)
        .join(models.UserProgress, models.UserProgress.episodio_id == models.Episode.id)
        .filter(
            models.UserProgress.usuario_id == user_id,
            models.UserProgress.status == models.ProgressStatus.ASSISTIDO,
            models.Season.conteudo_id.in_(conteudo_ids),
        )
        .all()
    )
    assistidos_por_conteudo: dict[int, int] = {}
    for (c_id,) in progressos_series:
        assistidos_por_conteudo[c_id] = assistidos_por_conteudo.get(c_id, 0) + 1

    progressos_filmes = (
        db.query(models.UserProgress.conteudo_id, models.UserProgress.status)
        .filter(models.UserProgress.usuario_id == user_id, models.UserProgress.conteudo_id.in_(conteudo_ids))
        .all()
    )
    status_filmes_por_conteudo: dict[int, models.ProgressStatus] = {}
    for c_id, s in progressos_filmes:
        if c_id is not None and c_id not in status_filmes_por_conteudo:
            status_filmes_por_conteudo[c_id] = s

    for conteudo_id in conteudo_ids:
        total_episodios = total_episodios_por_conteudo.get(conteudo_id)
        if total_episodios:
            assistidos = assistidos_por_conteudo.get(conteudo_id, 0)
            resultado[conteudo_id] = (100.0 * assistidos) / total_episodios
        else:
            s = status_filmes_por_conteudo.get(conteudo_id)
            resultado[conteudo_id] = 100.0 if s == models.ProgressStatus.ASSISTIDO else 0.0

    return resultado
