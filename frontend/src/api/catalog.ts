import api from './axios';
import { ContentDetail, ContentFormData, ContentSummary, PageResponse } from '../types';

export interface CatalogFilters {
  titulo?: string;
  genero?: string;
  ano?: number;
  tipo?: 'FILME' | 'SERIE';
  page?: number;
  size?: number;
}

export async function listContent(filters: CatalogFilters): Promise<PageResponse<ContentSummary>> {
  const { data } = await api.get<PageResponse<ContentSummary>>('/catalog', { params: filters });
  return data;
}

export async function getContentDetail(id: number): Promise<ContentDetail> {
  const { data } = await api.get<ContentDetail>(`/catalog/${id}`);
  return data;
}

export async function createContent(payload: ContentFormData) {
  const { data } = await api.post('/catalog', payload);
  return data;
}

export async function updateContent(id: number, payload: ContentFormData) {
  const { data } = await api.put(`/catalog/${id}`, payload);
  return data;
}

export async function deleteContent(id: number) {
  await api.delete(`/catalog/${id}`);
}

export async function addSeason(contentId: number, numero: number, titulo: string) {
  const { data } = await api.post(`/catalog/${contentId}/temporadas`, { numero, titulo });
  return data;
}

export async function removeSeason(seasonId: number) {
  await api.delete(`/catalog/temporadas/${seasonId}`);
}

export async function addEpisode(seasonId: number, numero: number, titulo: string, duracaoMinutos?: number) {
  const { data } = await api.post(`/catalog/temporadas/${seasonId}/episodios`, {
    numero,
    titulo,
    duracaoMinutos,
  });
  return data;
}

export async function removeEpisode(episodeId: number) {
  await api.delete(`/catalog/episodios/${episodeId}`);
}
