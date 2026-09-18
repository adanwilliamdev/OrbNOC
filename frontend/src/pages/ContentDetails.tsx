import { FormEvent, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addEpisode,
  addSeason,
  deleteContent,
  getContentDetail,
  removeEpisode,
  removeSeason,
} from '../api/catalog';
import { markEpisode, markMovie } from '../api/progress';
import { useAuth } from '../context/AuthContext';
import { ContentDetail } from '../types';

export function ContentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());

  const [seasonForm, setSeasonForm] = useState({ numero: '', titulo: '' });
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [episodeForm, setEpisodeForm] = useState<{ [seasonId: number]: { numero: string; titulo: string; duracao: string } }>({});
  const [openEpisodeForm, setOpenEpisodeForm] = useState<number | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getContentDetail(Number(id));
      setContent(data);
      if (data.temporadas && data.temporadas.length > 0) {
        setExpandedSeasons((prev) => (prev.size > 0 ? prev : new Set([data.temporadas![0].id])));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function toggleSeason(seasonId: number) {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(seasonId)) next.delete(seasonId);
      else next.add(seasonId);
      return next;
    });
  }

  async function handleToggleEpisode(episodeId: number, assistido: boolean) {
    try {
      await markEpisode(episodeId, assistido ? 'PENDENTE' : 'ASSISTIDO');
      await load();
    } catch {
      setActionError('Não foi possível atualizar o progresso deste episódio.');
    }
  }

  async function handleToggleMovie() {
    if (!content) return;
    try {
      await markMovie(content.id, content.assistido ? 'PENDENTE' : 'ASSISTIDO');
      await load();
    } catch {
      setActionError('Não foi possível atualizar o progresso deste título.');
    }
  }

  async function handleAddSeason(e: FormEvent) {
    e.preventDefault();
    if (!content || !seasonForm.numero) return;
    try {
      await addSeason(content.id, Number(seasonForm.numero), seasonForm.titulo);
      setSeasonForm({ numero: '', titulo: '' });
      setShowSeasonForm(false);
      await load();
    } catch {
      setActionError('Não foi possível adicionar a temporada.');
    }
  }

  async function handleRemoveSeason(seasonId: number) {
    if (!confirm('Remover esta temporada e todos os seus episódios?')) return;
    try {
      await removeSeason(seasonId);
      await load();
    } catch {
      setActionError('Não foi possível remover a temporada.');
    }
  }

  async function handleAddEpisode(seasonId: number) {
    const data = episodeForm[seasonId];
    if (!data?.numero) return;
    try {
      await addEpisode(seasonId, Number(data.numero), data.titulo, data.duracao ? Number(data.duracao) : undefined);
      setEpisodeForm((prev) => ({ ...prev, [seasonId]: { numero: '', titulo: '', duracao: '' } }));
      setOpenEpisodeForm(null);
      await load();
    } catch {
      setActionError('Não foi possível adicionar o episódio.');
    }
  }

  async function handleRemoveEpisode(episodeId: number) {
    try {
      await removeEpisode(episodeId);
      await load();
    } catch {
      setActionError('Não foi possível remover o episódio.');
    }
  }

  async function handleDeleteContent() {
    if (!content) return;
    if (!confirm(`Tem certeza que deseja excluir "${content.titulo}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteContent(content.id);
      navigate('/catalogo');
    } catch {
      setActionError('Não foi possível excluir este título.');
    }
  }

  if (loading) return <div className="page-loading">Carregando...</div>;
  if (!content) return <p className="empty-state">Conteúdo não encontrado.</p>;

  return (
    <div className="page">
      {actionError && <div className="alert-error">{actionError}</div>}
      <div className="details-header">
        <div
          className="details-poster"
          style={{ backgroundImage: content.imagemUrl ? `url(${content.imagemUrl})` : undefined }}
        >
          {!content.imagemUrl && (
            <div className="poster-fallback-bg">
              <span className="poster-fallback">{content.titulo}</span>
            </div>
          )}
        </div>
        <div className="details-info">
          <div className="details-title-row">
            <h1>{content.titulo}</h1>
            {isAdmin && (
              <button className="icon-btn danger" onClick={handleDeleteContent} title="Excluir título">
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <span className="catalog-meta">
            <span className={`badge ${content.tipo === 'FILME' ? 'filme' : 'serie'}`}>
              {content.tipo === 'FILME' ? 'Filme' : 'Série'}
            </span>
            {content.ano ? `· ${content.ano}` : ''} {content.genero ? `· ${content.genero}` : ''}
          </span>
          <p className="details-synopsis">{content.sinopse || 'Sem sinopse cadastrada.'}</p>

          <div className="progress-overall">
            <div className="progress-overall-header">
              <span>Progresso</span>
              <span>{content.progresso.toFixed(0)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${content.progresso}%` }} />
            </div>
          </div>

          {content.tipo === 'FILME' && (
            <button className="btn-primary" onClick={handleToggleMovie}>
              {content.assistido ? 'Marcar como não assistido' : 'Marcar como assistido'}
            </button>
          )}
        </div>
      </div>

      {content.tipo === 'SERIE' && (
        <>
          <div className="seasons-toolbar">
            <h2>Temporadas</h2>
            {isAdmin && (
              <button className="btn-secondary" onClick={() => setShowSeasonForm((v) => !v)}>
                {showSeasonForm ? 'Cancelar' : '+ Adicionar temporada'}
              </button>
            )}
          </div>

          {isAdmin && showSeasonForm && (
            <form className="inline-form" onSubmit={handleAddSeason}>
              <input
                type="number"
                placeholder="Nº da temporada"
                value={seasonForm.numero}
                onChange={(e) => setSeasonForm({ ...seasonForm, numero: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Título (opcional)"
                value={seasonForm.titulo}
                onChange={(e) => setSeasonForm({ ...seasonForm, titulo: e.target.value })}
              />
              <button type="submit" className="btn-primary">Salvar</button>
            </form>
          )}

          {isAdmin && content.temporadas && content.temporadas.length === 0 && !showSeasonForm && (
            <p className="empty-state">Esta série ainda não tem temporadas cadastradas. Clique em "Adicionar temporada" para começar.</p>
          )}
          {!isAdmin && content.temporadas && content.temporadas.length === 0 && (
            <p className="empty-state">Esta série ainda não tem temporadas cadastradas.</p>
          )}

          <div className="seasons-list">
            {content.temporadas?.map((season) => (
              <div key={season.id} className="season-block">
                <div className="season-header-row">
                  <button className="season-header" onClick={() => toggleSeason(season.id)}>
                    <span>Temporada {season.numero}{season.titulo ? `: ${season.titulo}` : ''}</span>
                    <span>{season.progresso.toFixed(0)}%</span>
                  </button>
                  {isAdmin && (
                    <button className="btn-link danger" onClick={() => handleRemoveSeason(season.id)}>Remover</button>
                  )}
                </div>
                <div className="progress-bar small">
                  <div className="progress-bar-fill" style={{ width: `${season.progresso}%` }} />
                </div>

                {expandedSeasons.has(season.id) && (
                  <>
                    <ul className="episode-list">
                      {season.episodios.map((ep) => (
                        <li key={ep.id} className="episode-item">
                          <label>
                            <input
                              type="checkbox"
                              checked={ep.assistido}
                              onChange={() => handleToggleEpisode(ep.id, ep.assistido)}
                            />
                            <span>
                              Ep. {ep.numero}{ep.titulo ? ` - ${ep.titulo}` : ''}
                              {ep.duracaoMinutos ? ` (${ep.duracaoMinutos} min)` : ''}
                            </span>
                          </label>
                          {isAdmin && (
                            <button className="btn-link danger" onClick={() => handleRemoveEpisode(ep.id)}>Remover</button>
                          )}
                        </li>
                      ))}
                      {season.episodios.length === 0 && (
                        <li className="empty-state" style={{ padding: '0.5rem 0' }}>
                          Nenhum episódio cadastrado nesta temporada ainda.
                        </li>
                      )}
                    </ul>

                    {isAdmin && (openEpisodeForm === season.id ? (
                      <div className="inline-form">
                        <input
                          type="number"
                          placeholder="Nº do episódio"
                          value={episodeForm[season.id]?.numero || ''}
                          onChange={(e) =>
                            setEpisodeForm((prev) => ({
                              ...prev,
                              [season.id]: { ...prev[season.id], numero: e.target.value, titulo: prev[season.id]?.titulo || '', duracao: prev[season.id]?.duracao || '' },
                            }))
                          }
                        />
                        <input
                          type="text"
                          placeholder="Título do episódio"
                          value={episodeForm[season.id]?.titulo || ''}
                          onChange={(e) =>
                            setEpisodeForm((prev) => ({
                              ...prev,
                              [season.id]: { ...prev[season.id], titulo: e.target.value, numero: prev[season.id]?.numero || '', duracao: prev[season.id]?.duracao || '' },
                            }))
                          }
                        />
                        <input
                          type="number"
                          placeholder="Duração (min)"
                          value={episodeForm[season.id]?.duracao || ''}
                          onChange={(e) =>
                            setEpisodeForm((prev) => ({
                              ...prev,
                              [season.id]: { ...prev[season.id], duracao: e.target.value, numero: prev[season.id]?.numero || '', titulo: prev[season.id]?.titulo || '' },
                            }))
                          }
                        />
                        <button type="button" className="btn-primary" onClick={() => handleAddEpisode(season.id)}>Salvar</button>
                        <button type="button" className="btn-secondary" onClick={() => setOpenEpisodeForm(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <button className="btn-link" onClick={() => setOpenEpisodeForm(season.id)}>+ Adicionar episódio</button>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
