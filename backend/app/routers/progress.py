from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..progress_calc import calcular_progresso_serie

router = APIRouter(prefix="/api/progresso", tags=["progress"])


@router.put("/episodios/{episodio_id}")
def marcar_episodio(
    episodio_id: int,
    status_param: models.ProgressStatus = Query(..., alias="status"),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    episode = db.query(models.Episode).filter(models.Episode.id == episodio_id).first()
    if not episode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episódio não encontrado")

    existente = (
        db.query(models.UserProgress)
        .filter(models.UserProgress.usuario_id == user.id, models.UserProgress.episodio_id == episodio_id)
        .first()
    )
    if existente:
        existente.status = status_param
        existente.atualizado_em = datetime.now(timezone.utc)
        db.add(existente)
    else:
        db.add(
            models.UserProgress(
                usuario_id=user.id,
                episodio_id=episodio_id,
                status=status_param,
                atualizado_em=datetime.now(timezone.utc),
            )
        )
    db.commit()

    conteudo_id = episode.temporada.conteudo_id
    temporada_id = episode.temporada_id

    total_temporada = (
        db.query(models.Episode).filter(models.Episode.temporada_id == temporada_id).count()
    )
    assistidos_temporada = (
        db.query(models.UserProgress)
        .join(models.Episode, models.UserProgress.episodio_id == models.Episode.id)
        .filter(
            models.UserProgress.usuario_id == user.id,
            models.UserProgress.status == models.ProgressStatus.ASSISTIDO,
            models.Episode.temporada_id == temporada_id,
        )
        .count()
    )
    progresso_temporada = 0.0 if total_temporada == 0 else (100.0 * assistidos_temporada) / total_temporada
    progresso_serie = calcular_progresso_serie(db, conteudo_id, user.id)

    return schemas.ProgressResult(
        episodio_id=episodio_id,
        conteudo_id=conteudo_id,
        status=status_param,
        progresso_temporada=progresso_temporada,
        progresso_serie=progresso_serie,
    )


@router.put("/conteudos/{conteudo_id}")
def marcar_filme(
    conteudo_id: int,
    status_param: models.ProgressStatus = Query(..., alias="status"),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = db.query(models.Content).filter(models.Content.id == conteudo_id).first()
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conteúdo não encontrado")

    existente = (
        db.query(models.UserProgress)
        .filter(models.UserProgress.usuario_id == user.id, models.UserProgress.conteudo_id == conteudo_id)
        .first()
    )
    if existente:
        existente.status = status_param
        existente.atualizado_em = datetime.now(timezone.utc)
        db.add(existente)
    else:
        db.add(
            models.UserProgress(
                usuario_id=user.id,
                conteudo_id=conteudo_id,
                status=status_param,
                atualizado_em=datetime.now(timezone.utc),
            )
        )
    db.commit()

    progresso = 100.0 if status_param == models.ProgressStatus.ASSISTIDO else 0.0
    return schemas.ProgressResult(
        conteudo_id=conteudo_id, status=status_param, progresso_temporada=progresso, progresso_serie=progresso
    )
