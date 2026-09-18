export type ContentType = 'FILME' | 'SERIE';
export type ProgressStatus = 'ASSISTIDO' | 'PENDENTE';

export interface AuthResponse {
  // O access token não é mais devolvido no corpo da resposta: ele viaja apenas
  // em um cookie httpOnly, que o JavaScript do frontend não consegue ler.
  id: number;
  nome: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface UserProfile {
  id: number;
  nome: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface ContentSummary {
  id: number;
  titulo: string;
  genero: string | null;
  ano: number | null;
  imagemUrl: string | null;
  tipo: ContentType;
  progresso: number;
}

export interface EpisodeItem {
  id: number;
  numero: number;
  titulo: string | null;
  duracaoMinutos: number | null;
  assistido: boolean;
}

export interface SeasonItem {
  id: number;
  numero: number;
  titulo: string | null;
  progresso: number;
  episodios: EpisodeItem[];
}

export interface ContentDetail {
  id: number;
  titulo: string;
  sinopse: string | null;
  genero: string | null;
  ano: number | null;
  imagemUrl: string | null;
  tipo: ContentType;
  progresso: number;
  assistido: boolean | null;
  temporadas: SeasonItem[] | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface GeneroStat {
  genero: string;
  quantidade: number;
}

export interface ContinuarAssistindoItem {
  conteudoId: number;
  tituloConteudo: string;
  imagemUrl: string | null;
  episodioId: number;
  numeroEpisodio: number;
  numeroTemporada: number;
  progressoSerie: number;
}

export interface DashboardData {
  totalFilmes: number;
  totalSeries: number;
  episodiosAssistidos: number;
  filmesAssistidos: number;
  progressoGeral: number;
  totalHorasAssistidas: number;
  seriesConcluidas: number;
  seriesEmProgresso: number;
  seriesNaoIniciadas: number;
  distribuicaoPorGenero: GeneroStat[];
  continuarAssistindo: ContinuarAssistindoItem[];
}

export interface ContentFormData {
  titulo: string;
  sinopse: string;
  genero: string;
  ano: number | '';
  imagemUrl: string;
  tipo: ContentType;
}
