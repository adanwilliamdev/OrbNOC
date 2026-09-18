"""
Schemas Pydantic. Os nomes de campo usam camelCase para manter compatibilidade
byte-a-byte com o contrato JSON já consumido pelo frontend React.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import ContentType, ProgressStatus, Role


def to_camel(field_name: str) -> str:
    parts = field_name.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ---------------- Auth ----------------


class RegisterRequest(CamelModel):
    nome: str = Field(min_length=1, description="Nome é obrigatório")
    email: EmailStr
    senha: str = Field(min_length=6, description="Senha deve ter ao menos 6 caracteres")

    @field_validator("nome")
    @classmethod
    def nome_nao_vazio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Nome é obrigatório")
        return v


class LoginRequest(CamelModel):
    email: EmailStr
    senha: str = Field(min_length=1, description="Senha é obrigatória")


class AuthResponse(CamelModel):
    id: int
    nome: str
    email: str
    role: Role


class UserProfile(CamelModel):
    id: int
    nome: str
    email: str
    role: Role


class UpdateProfileRequest(CamelModel):
    nome: str = Field(min_length=1, description="Nome é obrigatório")

    @field_validator("nome")
    @classmethod
    def nome_nao_vazio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Nome é obrigatório")
        return v


# ---------------- Catalog ----------------


class ContentRequest(CamelModel):
    titulo: str = Field(min_length=1, description="Título é obrigatório")
    sinopse: Optional[str] = None
    genero: Optional[str] = None
    ano: Optional[int] = None
    imagem_url: Optional[str] = None
    tipo: ContentType


class SeasonRequest(CamelModel):
    numero: int
    titulo: Optional[str] = None


class EpisodeRequest(CamelModel):
    numero: int
    titulo: Optional[str] = None
    duracao_minutos: Optional[int] = None


class ContentSummary(CamelModel):
    id: int
    titulo: str
    genero: Optional[str]
    ano: Optional[int]
    imagem_url: Optional[str]
    tipo: ContentType
    progresso: float


class EpisodeItem(CamelModel):
    id: int
    numero: int
    titulo: Optional[str]
    duracao_minutos: Optional[int]
    assistido: bool


class SeasonItem(CamelModel):
    id: int
    numero: int
    titulo: Optional[str]
    progresso: float
    episodios: List[EpisodeItem]


class ContentDetail(CamelModel):
    id: int
    titulo: str
    sinopse: Optional[str]
    genero: Optional[str]
    ano: Optional[int]
    imagem_url: Optional[str]
    tipo: ContentType
    progresso: float
    assistido: Optional[bool] = None
    temporadas: Optional[List[SeasonItem]] = None


class PageResponse(CamelModel):
    content: List[ContentSummary]
    total_elements: int
    total_pages: int
    number: int
    size: int


# ---------------- Progress ----------------


class ProgressResult(CamelModel):
    episodio_id: Optional[int] = None
    conteudo_id: int
    status: ProgressStatus
    progresso_temporada: float
    progresso_serie: float


# ---------------- Dashboard ----------------


class GeneroStat(CamelModel):
    genero: str
    quantidade: int


class ContinuarAssistindoItem(CamelModel):
    conteudo_id: int
    titulo_conteudo: str
    imagem_url: Optional[str]
    episodio_id: int
    numero_episodio: int
    numero_temporada: int
    progresso_serie: float


class DashboardData(CamelModel):
    total_filmes: int
    total_series: int
    episodios_assistidos: int
    filmes_assistidos: int
    progresso_geral: float
    total_horas_assistidas: float
    series_concluidas: int
    series_em_progresso: int
    series_nao_iniciadas: int
    distribuicao_por_genero: List[GeneroStat]
    continuar_assistindo: List[ContinuarAssistindoItem]


# ---------------- TMDB ----------------


class TmdbSearchResult(CamelModel):
    tmdb_id: int
    titulo: str
    ano: Optional[int]
    imagem_url: Optional[str]
    sinopse: Optional[str]
    tipo: ContentType
    avaliacao: Optional[float]


class TmdbImportResult(CamelModel):
    conteudo_id: int
    titulo: str
    temporadas_importadas: int
    episodios_importadas: int
