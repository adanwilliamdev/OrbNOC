from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_admin
from ..progress_calc import calcular_progresso_em_lote, calcular_progresso_serie

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _garantir_existe(db: Session, content_id: int) -> models.Content:
    content = db.query(models.Content).filter(models.Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conteúdo não encontrado")
    return content


@router.get("")
def listar(
    titulo: Optional[str] = None,
    genero: Optional[str] = None,
    ano: Optional[int] = None,
    tipo: Optional[models.ContentType] = None,
    page: int = 0,
    size: int = 15,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Content)
    if titulo and titulo.strip():
        query = query.filter(func.lower(models.Content.titulo).contains(titulo.lower()))
    if genero and genero.strip():
        query = query.filter(func.lower(models.Content.genero) == genero.lower())
    if ano is not None:
        query = query.filter(models.Content.ano == ano)
    if tipo:
        query = query.filter(models.Content.tipo == tipo)

    total_elements = query.count()
    itens = query.order_by(models.Content.id.asc()).offset(page * size).limit(size).all()

    ids = [c.id for c in itens]
    progresso_por_conteudo = calcular_progresso_em_lote(db, ids, user.id)

    content = [
        schemas.ContentSummary(
            id=c.id,
            titulo=c.titulo,
            genero=c.genero,
            ano=c.ano,
            imagem_url=c.imagem_url,
            tipo=c.tipo,
            progresso=progresso_por_conteudo.get(c.id, 0.0),
        )
        for c in itens
    ]

    return schemas.PageResponse(
        content=content,
        total_elements=total_elements,
        total_pages=max(1, math.ceil(total_elements / size)) if size else 1,
        number=page,
        size=size,
    )


def _to_season_response(db: Session, season: models.Season, user_id: int) -> schemas.SeasonItem:
    episodios = (
        db.query(models.Episode)
        .filter(models.Episode.temporada_id == season.id)
        .order_by(models.Episode.numero.asc())
        .all()
    )
    assistidos_ids = {
        p.episodio_id
        for p in db.query(models.UserProgress.episodio_id)
        .join(models.Episode, models.UserProgress.episodio_id == models.Episode.id)
        .filter(
            models.UserProgress.usuario_id == user_id,
            models.Episode.temporada_id == season.id,
            models.UserProgress.status == models.ProgressStatus.ASSISTIDO,
        )
        .all()
    }

    episode_responses = [
        schemas.EpisodeItem(
            id=ep.id,
            numero=ep.numero,
            titulo=ep.titulo,
            duracao_minutos=ep.duracao_minutos,
            assistido=ep.id in assistidos_ids,
        )
        for ep in sorted(episodios, key=lambda e: e.numero)
    ]

    progresso = 0.0 if not episodios else (100.0 * len(assistidos_ids)) / len(episodios)

    return schemas.SeasonItem(
        id=season.id, numero=season.numero, titulo=season.titulo, progresso=progresso, episodios=episode_responses
    )


@router.get("/{content_id}")
def buscar_detalhes(
    content_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    content = db.query(models.Content).filter(models.Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conteúdo não encontrado")

    base = dict(
        id=content.id,
        titulo=content.titulo,
        sinopse=content.sinopse,
        genero=content.genero,
        ano=content.ano,
        imagem_url=content.imagem_url,
        tipo=content.tipo,
    )

    if content.tipo == models.ContentType.FILME:
        progresso_row = (
            db.query(models.UserProgress)
            .filter(models.UserProgress.usuario_id == user.id, models.UserProgress.conteudo_id == content.id)
            .first()
        )
        assistido = bool(progresso_row and progresso_row.status == models.ProgressStatus.ASSISTIDO)
        return schemas.ContentDetail(**base, assistido=assistido, progresso=100.0 if assistido else 0.0)

    temporadas = (
        db.query(models.Season)
        .filter(models.Season.conteudo_id == content.id)
        .order_by(models.Season.numero.asc())
        .all()
    )
    season_responses = [_to_season_response(db, s, user.id) for s in temporadas]
    progresso = calcular_progresso_serie(db, content.id, user.id)
    return schemas.ContentDetail(**base, temporadas=season_responses, progresso=progresso)


# ---------- CRUD (Admin) ----------


@router.post("", status_code=status.HTTP_201_CREATED)
def criar(dto: schemas.ContentRequest, _admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    content = models.Content(
        titulo=dto.titulo,
        sinopse=dto.sinopse,
        genero=dto.genero,
        ano=dto.ano,
        imagem_url=dto.imagem_url,
        tipo=dto.tipo,
        assistido=False,
    )
    db.add(content)
    db.commit()
    db.refresh(content)
    return {
        "id": content.id,
        "titulo": content.titulo,
        "sinopse": content.sinopse,
        "genero": content.genero,
        "ano": content.ano,
        "imagemUrl": content.imagem_url,
        "tipo": content.tipo,
    }


@router.put("/{content_id}")
def atualizar(
    content_id: int,
    dto: schemas.ContentRequest,
    _admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    content = _garantir_existe(db, content_id)
    content.titulo = dto.titulo
    content.sinopse = dto.sinopse
    content.genero = dto.genero
    content.ano = dto.ano
    content.imagem_url = dto.imagem_url
    content.tipo = dto.tipo
    db.add(content)
    db.commit()
    db.refresh(content)
    return {
        "id": content.id,
        "titulo": content.titulo,
        "sinopse": content.sinopse,
        "genero": content.genero,
        "ano": content.ano,
        "imagemUrl": content.imagem_url,
        "tipo": content.tipo,
    }


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(content_id: int, _admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    content = _garantir_existe(db, content_id)
    # cascade="all, delete-orphan" no relacionamento cuida de remover temporadas,
    # episódios e progresso vinculados automaticamente.
    db.delete(content)
    db.commit()


@router.post("/{content_id}/temporadas", status_code=status.HTTP_201_CREATED)
def adicionar_temporada(
    content_id: int,
    dto: schemas.SeasonRequest,
    _admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _garantir_existe(db, content_id)
    season = models.Season(numero=dto.numero, titulo=dto.titulo, conteudo_id=content_id)
    db.add(season)
    db.commit()
    db.refresh(season)
    return {"id": season.id, "numero": season.numero, "titulo": season.titulo, "conteudoId": season.conteudo_id}


@router.delete("/temporadas/{temporada_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_temporada(
    temporada_id: int, _admin: models.User = Depends(require_admin), db: Session = Depends(get_db)
):
    season = db.query(models.Season).filter(models.Season.id == temporada_id).first()
    if not season:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Temporada não encontrada")
    db.delete(season)
    db.commit()


@router.post("/temporadas/{temporada_id}/episodios", status_code=status.HTTP_201_CREATED)
def adicionar_episodio(
    temporada_id: int,
    dto: schemas.EpisodeRequest,
    _admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    season = db.query(models.Season).filter(models.Season.id == temporada_id).first()
    if not season:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Temporada não encontrada")
    episode = models.Episode(
        numero=dto.numero, titulo=dto.titulo, duracao_minutos=dto.duracao_minutos, temporada_id=temporada_id
    )
    db.add(episode)
    db.commit()
    db.refresh(episode)
    return {
        "id": episode.id,
        "numero": episode.numero,
        "titulo": episode.titulo,
        "duracaoMinutos": episode.duracao_minutos,
        "temporadaId": episode.temporada_id,
    }


@router.delete("/episodios/{episodio_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_episodio(
    episodio_id: int, _admin: models.User = Depends(require_admin), db: Session = Depends(get_db)
):
    episode = db.query(models.Episode).filter(models.Episode.id == episodio_id).first()
    if not episode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episódio não encontrado")
    db.delete(episode)
    db.commit()
