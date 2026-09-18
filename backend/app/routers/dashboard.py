from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..progress_calc import calcular_progresso_serie

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user.id

    total_filmes = db.query(models.Content).filter(models.Content.tipo == models.ContentType.FILME).count()
    total_series = db.query(models.Content).filter(models.Content.tipo == models.ContentType.SERIE).count()

    episodios_assistidos = (
        db.query(models.UserProgress)
        .filter(
            models.UserProgress.usuario_id == user_id,
            models.UserProgress.status == models.ProgressStatus.ASSISTIDO,
            models.UserProgress.episodio_id.isnot(None),
        )
        .count()
    )
    filmes_assistidos = (
        db.query(models.UserProgress)
        .filter(
            models.UserProgress.usuario_id == user_id,
            models.UserProgress.status == models.ProgressStatus.ASSISTIDO,
            models.UserProgress.conteudo_id.isnot(None),
        )
        .count()
    )

    minutos_assistidos = (
        db.query(func.coalesce(func.sum(models.Episode.duracao_minutos), 0))
        .join(models.UserProgress, models.UserProgress.episodio_id == models.Episode.id)
        .filter(
            models.UserProgress.usuario_id == user_id,
            models.UserProgress.status == models.ProgressStatus.ASSISTIDO,
        )
        .scalar()
        or 0
    )
    horas_assistidas = minutos_assistidos / 60.0

    series = db.query(models.Content).filter(models.Content.tipo == models.ContentType.SERIE).all()
    concluidas = em_progresso = nao_iniciadas = 0
    for serie in series:
        progresso = calcular_progresso_serie(db, serie.id, user_id)
        if progresso >= 100.0:
            concluidas += 1
        elif progresso > 0.0:
            em_progresso += 1
        else:
            nao_iniciadas += 1

    total_itens = total_filmes + total_series
    progresso_geral = 0.0
    if total_itens > 0:
        acumulador = 0.0
        filmes = db.query(models.Content).filter(models.Content.tipo == models.ContentType.FILME).all()
        for filme in filmes:
            acumulador += calcular_progresso_serie(db, filme.id, user_id)
        for serie in series:
            acumulador += calcular_progresso_serie(db, serie.id, user_id)
        progresso_geral = acumulador / total_itens

    generos_agrupados = (
        db.query(models.Content.genero, func.count(models.Content.id))
        .filter(models.Content.genero.isnot(None))
        .group_by(models.Content.genero)
        .all()
    )
    distribuicao_por_genero = [
        schemas.GeneroStat(genero=genero, quantidade=quantidade) for genero, quantidade in generos_agrupados
    ]

    ultimos_assistidos = (
        db.query(models.UserProgress)
        .filter(
            models.UserProgress.usuario_id == user_id,
            models.UserProgress.status == models.ProgressStatus.ASSISTIDO,
            models.UserProgress.episodio_id.isnot(None),
        )
        .order_by(models.UserProgress.atualizado_em.desc())
        .limit(10)
        .all()
    )

    continuar_assistindo = []
    for p in ultimos_assistidos:
        if len(continuar_assistindo) >= 5:
            break
        if not p.episodio:
            continue
        conteudo = p.episodio.temporada.conteudo
        continuar_assistindo.append(
            schemas.ContinuarAssistindoItem(
                conteudo_id=conteudo.id,
                titulo_conteudo=conteudo.titulo,
                imagem_url=conteudo.imagem_url,
                episodio_id=p.episodio.id,
                numero_episodio=p.episodio.numero,
                numero_temporada=p.episodio.temporada.numero,
                progresso_serie=calcular_progresso_serie(db, conteudo.id, user_id),
            )
        )

    return schemas.DashboardData(
        total_filmes=total_filmes,
        total_series=total_series,
        episodios_assistidos=episodios_assistidos,
        filmes_assistidos=filmes_assistidos,
        progresso_geral=progresso_geral,
        total_horas_assistidas=horas_assistidas,
        series_concluidas=concluidas,
        series_em_progresso=em_progresso,
        series_nao_iniciadas=nao_iniciadas,
        distribuicao_por_genero=distribuicao_por_genero,
        continuar_assistindo=continuar_assistindo,
    )
