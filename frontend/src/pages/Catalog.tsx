import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, SearchX, Trash2 } from 'lucide-react';
import { deleteContent, listContent } from '../api/catalog';
import { AddContentModal } from '../components/AddContentModal';
import { useAuth } from '../context/AuthContext';
import { ContentSummary, ContentType } from '../types';

export function Catalog() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [titulo, setTitulo] = useState('');
  const [genero, setGenero] = useState('');
  const [ano, setAno] = useState('');
  const [tipo, setTipo] = useState<ContentType | ''>('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function fetchData(currentPage = page) {
    setLoading(true);
    try {
      const response = await listContent({
        titulo: titulo || undefined,
        genero: genero || undefined,
        ano: ano ? Number(ano) : undefined,
        tipo: tipo || undefined,
        page: currentPage,
        size: 15,
      });
      setItems(response.content);
      setTotalPages(response.totalPages);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(0);
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    fetchData(0);
  }

  function goToPage(newPage: number) {
    setPage(newPage);
    fetchData(newPage);
  }

  async function handleDelete(e: React.MouseEvent, id: number, titulo: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Tem certeza que deseja excluir "${titulo}"? Essa ação não pode ser desfeita.`)) return;
    setDeleteError(null);
    try {
      await deleteContent(id);
      await fetchData(page);
    } catch {
      setDeleteError(`Não foi possível excluir "${titulo}".`);
    }
  }

  return (
    <div className="page">
      <div className="catalog-header">
        <h1>Catálogo</h1>
      </div>

      <form className="filters-bar" onSubmit={handleFilterSubmit}>
        <input
          type="text"
          placeholder="Buscar por título..."
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <div className="filters-bar-right">
          <input
            type="text"
            placeholder="Gênero"
            value={genero}
            onChange={(e) => setGenero(e.target.value)}
          />
          <input
            type="number"
            placeholder="Ano"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
          />
          <select value={tipo} onChange={(e) => setTipo(e.target.value as ContentType | '')}>
            <option value="">Todos</option>
            <option value="FILME">Filmes</option>
            <option value="SERIE">Séries</option>
          </select>
          <button type="submit" className="btn-primary">Filtrar</button>
        </div>
      </form>

      {deleteError && <div className="alert-error">{deleteError}</div>}

      {loading ? (
        <div className="page-loading">Carregando catálogo...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-illustration"><SearchX size={40} strokeWidth={1.25} /></div>
          Nada encontrado
        </div>
      ) : (
        <>
          <div className="catalog-grid">
            {items.map((item) => (
              <Link to={`/catalogo/${item.id}`} key={item.id} className="catalog-card">
                <div
                  className="catalog-poster"
                  style={{ backgroundImage: item.imagemUrl ? `url(${item.imagemUrl})` : undefined }}
                >
                  {!item.imagemUrl && (
                    <div className="poster-fallback-bg">
                      <span className="poster-fallback">{item.titulo}</span>
                    </div>
                  )}
                  <div className="catalog-poster-overlay">
                    <span className="catalog-poster-play"><Play size={18} fill="currentColor" /></span>
                  </div>
                  {isAdmin && (
                    <button
                      className="catalog-card-delete"
                      onClick={(e) => handleDelete(e, item.id, item.titulo)}
                      title="Excluir título"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="catalog-card-body">
                  <strong>{item.titulo}</strong>
                  <span className="catalog-meta">
                    <span className={`badge ${item.tipo === 'FILME' ? 'filme' : 'serie'}`}>
                      {item.tipo === 'FILME' ? 'Filme' : 'Série'}
                    </span>
                    {item.ano ? `· ${item.ano}` : ''}
                  </span>
                  <div className="progress-bar small">
                    <div className="progress-bar-fill" style={{ width: `${item.progresso}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 0} onClick={() => goToPage(page - 1)}>Anterior</button>
              <span>Página {page + 1} de {totalPages}</span>
              <button disabled={page + 1 >= totalPages} onClick={() => goToPage(page + 1)}>Próxima</button>
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <AddContentModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => fetchData(page)}
        />
      )}

      <button className="fab-add" onClick={() => setShowAddModal(true)} title="Adicionar título">
        <Plus size={24} />
      </button>
    </div>
  );
}
