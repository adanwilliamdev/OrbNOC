import api from './axios';
import { ProgressStatus } from '../types';

export async function markEpisode(episodeId: number, status: ProgressStatus) {
  const { data } = await api.put(`/progresso/episodios/${episodeId}`, null, { params: { status } });
  return data;
}

export async function markMovie(contentId: number, status: ProgressStatus) {
  const { data } = await api.put(`/progresso/conteudos/${contentId}`, null, { params: { status } });
  return data;
}
