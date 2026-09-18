import api from './axios';
import { ContentType } from '../types';

export interface TmdbSearchResult {
  tmdbId: number;
  titulo: string;
  ano: number | null;
  imagemUrl: string | null;
  sinopse: string | null;
  tipo: ContentType;
  avaliacao: number | null;
}

export interface TmdbImportResult {
  conteudoId: number;
  titulo: string;
  temporadasImportadas: number;
  episodiosImportadas: number;
}

export async function getTmdbStatus(): Promise<{ configurado: boolean }> {
  const { data } = await api.get('/tmdb/status');
  return data;
}

export async function searchTmdb(query: string, tipo: ContentType): Promise<TmdbSearchResult[]> {
  const { data } = await api.get<TmdbSearchResult[]>('/tmdb/search', { params: { query, tipo } });
  return data;
}

export async function importTmdb(tmdbId: number, tipo: ContentType): Promise<TmdbImportResult> {
  const { data } = await api.post<TmdbImportResult>('/tmdb/import', null, { params: { tmdbId, tipo } });
  return data;
}
