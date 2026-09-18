from __future__ import annotations

import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import get_settings
from ..database import get_db
from ..deps import require_admin

router = APIRouter(prefix="/api/tmdb", tags=["tmdb"])
settings = get_settings()

_CACHE_TTL_SECONDS = 10 * 60  # 10 minutos
_search_cache: dict[str, tuple[float, list[schemas.TmdbSearchResult]]] = {}


def _is_configured() -> bool:
    return bool(settings.tmdb_api_key and settings.tmdb_api_key.strip())


def _extrair_ano(data_lancamento: Optional[str]) -> Optional[int]:
    if data_lancamento and len(data_lancamento) >= 4:
        try:
            return int(data_lancamento[:4])
        except ValueError:
            return None
    return None


def _to_search_result(node: dict[str, Any], tipo: models.ContentType) -> schemas.TmdbSearchResult:
    titulo = node.get("title") if tipo == models.ContentType.FILME else node.get("name")
    data_lancamento = node.get("release_date") if tipo == models.ContentType.FILME else node.get("first_air_date")
    poster_path = node.get("poster_path")
    return schemas.TmdbSearchResult(
        tmdb_id=node["id"],
        titulo=titulo or "Sem título",
        ano=_extrair_ano(data_lancamento),
        imagem_url=(settings.tmdb_image_base_url + poster_path) if poster_path else None,
        sinopse=node.get("overview") or None,
        tipo=tipo,
        avaliacao=node.get("vote_average") if isinstance(node.get("vote_average"), (int, float)) else None,
    )


@router.get("/status")
def tmdb_status():
    return {"configurado": _is_configured()}


@router.get("/search")
def buscar(query: str, tipo: models.ContentType):
    if not _is_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integração com o TMDB não configurada. Defina a variável de ambiente TMDB_API_KEY.",
        )

    chave_cache = f"{tipo}-{query.lower()}"
    cached = _search_cache.get(chave_cache)
    if cached and cached[0] > time.time():
        return cached[1]

    path = "/search/movie" if tipo == models.ContentType.FILME else "/search/tv"
    with httpx.Client(timeout=8.0) as client:
        response = client.get(
            f"{settings.tmdb_base_url}{path}",
            params={"api_key": settings.tmdb_api_key, "language": "pt-BR", "query": query, "include_adult": False},
        )
        response.raise_for_status()
        data = response.json()

    resultados = [_to_search_result(node, tipo) for node in (data.get("results") or [])[:20]]
    _search_cache[chave_cache] = (time.time() + _CACHE_TTL_SECONDS, resultados)
    return resultados


@router.post("/import")
def importar(
    tmdb_id: int = Query(..., alias="tmdbId"),
    tipo: models.ContentType = Query(...),
    _admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not _is_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integração com o TMDB não configurada. Defina a variável de ambiente TMDB_API_KEY.",
        )

    path = f"/movie/{tmdb_id}" if tipo == models.ContentType.FILME else f"/tv/{tmdb_id}"
    details: Optional[dict[str, Any]] = None
    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                f"{settings.tmdb_base_url}{path}", params={"api_key": settings.tmdb_api_key, "language": "pt-BR"}
            )
            response.raise_for_status()
            details = response.json()
    except httpx.HTTPError:
        details = None

    if not details:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não foi possível encontrar este título no TMDB")

    titulo = details.get("title") if tipo == models.ContentType.FILME else details.get("name")
    data_lancamento = details.get("release_date") if tipo == models.ContentType.FILME else details.get("first_air_date")
    ano = _extrair_ano(data_lancamento)

    genero = None
    generos = details.get("genres")
    if isinstance(generos, list):
        genero = ", ".join(g["name"] for g in generos if "name" in g)

    poster_path = details.get("poster_path")
    imagem_url = (settings.tmdb_image_base_url + poster_path) if poster_path else None

    content = models.Content(
        titulo=titulo or "Sem título",
        sinopse=details.get("overview") or None,
        genero=genero,
        ano=ano,
        imagem_url=imagem_url,
        tipo=tipo,
        assistido=False,
    )
    db.add(content)
    db.commit()
    db.refresh(content)

    temporadas_importadas = 0
    episodios_importadas = 0

    if tipo == models.ContentType.SERIE and isinstance(details.get("seasons"), list):
        for season_node in details["seasons"]:
            season_number = season_node.get("season_number")
            season = models.Season(numero=season_number, titulo=season_node.get("name") or None, conteudo_id=content.id)
            db.add(season)
            db.commit()
            db.refresh(season)
            temporadas_importadas += 1
            episodios_importadas += _importar_episodios(tmdb_id, season_number, season.id, db)

    return schemas.TmdbImportResult(
        conteudo_id=content.id,
        titulo=content.titulo,
        temporadas_importadas=temporadas_importadas,
        episodios_importadas=episodios_importadas,
    )


def _importar_episodios(tmdb_id: int, season_number: int, season_id: int, db: Session) -> int:
    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                f"{settings.tmdb_base_url}/tv/{tmdb_id}/season/{season_number}",
                params={"api_key": settings.tmdb_api_key, "language": "pt-BR"},
            )
            response.raise_for_status()
            season_details = response.json()
    except httpx.HTTPError:
        return 0

    episodes = season_details.get("episodes") if season_details else None
    if not isinstance(episodes, list):
        return 0

    count = 0
    for episode_node in episodes:
        runtime = episode_node.get("runtime")
        db.add(
            models.Episode(
                numero=episode_node.get("episode_number"),
                titulo=episode_node.get("name") or None,
                duracao_minutos=runtime if isinstance(runtime, (int, float)) else None,
                temporada_id=season_id,
            )
        )
        count += 1
    db.commit()
    return count
