import { FormEvent, useEffect, useState } from 'react';
import { Pencil, Settings2, Trash2 } from 'lucide-react';
import {
  addEpisode,
  addSeason,
  createContent,
  deleteContent,
  getContentDetail,
  listContent,
  removeEpisode,
  removeSeason,
  updateContent,
} from '../api/catalog';
import { ContentDetail, ContentFormData, ContentSummary, ContentType } from '../types';

const emptyForm: ContentFormData = {
  titulo: '',
  sinopse: '',
  genero: '',
  ano: '',
  imagemUrl: '',
  tipo: 'FILME',
};

export function Admin() {
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ContentFormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ContentDetail | null>(null);
  const [seasonForm, setSeasonForm] = useState({ numero: '', titulo: '' });
  const [episodeForm, setEpisodeForm] = useState<{ [seasonId: number]: { numero: string; titulo: string; duracao: string } }>({});
  const [message, setMessage] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    try {
      const response = await listContent({ size: 100 });
      setItems(response.content);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: ContentFormData = { ...form, ano: form.ano === '' ? '' : Number(form.ano) };
    try {
      if (editingId) {
        await updateContent(editingId, payload);
        setMessage('Conteúdo atualizado com sucesso.');
      } else {
        await createContent(payload);
        setMessage('Conteúdo criado com sucesso.');
      }
      resetForm();
      await loadItems();
    } catch {
      setMessage('Não foi possível salvar o conteúdo.');
    }
  }

  function handleEdit(item: ContentSummary) {
    setEditingId(item.id);
    setForm({
      titulo: item.titulo,
      sinopse: '',
      genero: item.genero || '',
      ano: item.ano || '',
      imagemUrl: item.imagemUrl || '',
      tipo: item.tipo,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: number) {
    if (!confirm('Tem certeza que deseja remover este conteúdo? Essa ação não pode ser desfeita.')) return;
    await deleteContent(id);
    await loadItems();
    if (selected?.id === id) setSelected(null);
  }

  async function handleManage(id: number) {
    const detail = await getContentDetail(id);
    setSelected(detail);
  }

  async function handleAddSeason(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await addSeason(selected.id, Number(seasonForm.numero), seasonForm.titulo);
    setSeasonForm({ numero: '', titulo: '' });
    await handleManage(selected.id);
  }

  async function handleRemoveSeason(seasonId: number) {
    if (!selected) return;
    if (!confirm('Remover esta temporada e todos os seus episódios?')) return;
    await removeSeason(seasonId);
    await handleManage(selected.id);
  }

  async function handleAddEpisode(seasonId: number) {
    if (!selected) return;
    const data = episodeForm[seasonId];
    if (!data?.numero) return;
    await addEpisode(seasonId, Number(data.numero), data.titulo, data.duracao ? Number(data.duracao) : undefined);
    setEpisodeForm((prev) => ({ ...prev, [seasonId]: { numero: '', titulo: '', duracao: '' } }));
    await handleManage(selected.id);
  }

  async function handleRemoveEpisode(episodeId: number) {
    if (!selected) return;
    await removeEpisode(episodeId);
    await handleManage(selected.id);
  }

  return (
    <div className="page">
      <h1>Administração</h1>

      {message && <div className="alert-info">{message}</div>}

      <div className="admin-layout">
        <form className="admin-form" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Editar conteúdo' : 'Adicionar conteúdo'}</h2>

          <label>
            Título
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              required
            />
          </label>

          <label>
            Tipo
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as ContentType })}
            >
              <option value="FILME">Filme</option>
              <option value="SERIE">Série</option>
            </select>
          </label>

          <label>
            Gênero
            <input type="text" value={form.genero} onChange={(e) => setForm({ ...form, genero: e.target.value })} />
          </label>

          <label>
            Ano
            <input
              type="number"
              value={form.ano}
              onChange={(e) => setForm({ ...form, ano: e.target.value === '' ? '' : Number(e.target.value) })}
            />
          </label>

          <label>
            URL da imagem (capa)
            <input type="text" value={form.imagemUrl} onChange={(e) => setForm({ ...form, imagemUrl: e.target.value })} />
          </label>

          <label>
            Sinopse
            <textarea
              value={form.sinopse}
              onChange={(e) => setForm({ ...form, sinopse: e.target.value })}
              rows={4}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="btn-primary">{editingId ? 'Salvar alterações' : 'Adicionar'}</button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancelar</button>}
          </div>
        </form>

        <div className="admin-table-wrapper">
          <h2>Conteúdos cadastrados</h2>
          {loading ? (
            <div className="page-loading">Carregando...</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Ano</th>
                  <th>Gênero</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.titulo}</td>
                    <td>{item.tipo === 'FILME' ? 'Filme' : 'Série'}</td>
                    <td>{item.ano || '-'}</td>
                    <td>{item.genero || '-'}</td>
                    <td className="admin-actions">
                      <button className="icon-btn" onClick={() => handleEdit(item)} title="Editar">
                        <Pencil size={15} />
                      </button>
                      {item.tipo === 'SERIE' && (
                        <button className="icon-btn" onClick={() => handleManage(item.id)} title="Gerenciar temporadas">
                          <Settings2 size={15} />
                        </button>
                      )}
                      <button className="icon-btn danger" onClick={() => handleDelete(item.id)} title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && selected.tipo === 'SERIE' && (
        <div className="admin-manage-series">
          <h2>Gerenciar temporadas: {selected.titulo}</h2>

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
              placeholder="Título da temporada (opcional)"
              value={seasonForm.titulo}
              onChange={(e) => setSeasonForm({ ...seasonForm, titulo: e.target.value })}
            />
            <button type="submit" className="btn-primary">Adicionar temporada</button>
          </form>

          {selected.temporadas?.map((season) => (
            <div key={season.id} className="admin-season-block">
              <div className="admin-season-header">
                <strong>Temporada {season.numero}{season.titulo ? `: ${season.titulo}` : ''}</strong>
                <button className="btn-link danger" onClick={() => handleRemoveSeason(season.id)}>Remover temporada</button>
              </div>

              <ul className="episode-list">
                {season.episodios.map((ep) => (
                  <li key={ep.id} className="episode-item">
                    <span>Ep. {ep.numero}{ep.titulo ? ` - ${ep.titulo}` : ''}{ep.duracaoMinutos ? ` (${ep.duracaoMinutos} min)` : ''}</span>
                    <button className="btn-link danger" onClick={() => handleRemoveEpisode(ep.id)}>Remover</button>
                  </li>
                ))}
              </ul>

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
                <button type="button" className="btn-primary" onClick={() => handleAddEpisode(season.id)}>Adicionar episódio</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
