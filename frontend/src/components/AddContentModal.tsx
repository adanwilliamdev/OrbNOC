import { FormEvent, useState } from 'react';
import { createContent } from '../api/catalog';
import { getTmdbStatus, importTmdb, searchTmdb, TmdbSearchResult } from '../api/tmdb';
import { ContentFormData, ContentType } from '../types';

const emptyForm: ContentFormData = {
  titulo: '',
  sinopse: '',
  genero: '',
  ano: '',
  imagemUrl: '',
  tipo: 'FILME',
};

export function AddContentModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [tab, setTab] = useState<'tmdb' | 'manual'>('tmdb');

  // --- Busca TMDB ---
  const [query, setQuery] = useState('');
  const [tmdbTipo, setTmdbTipo] = useState<ContentType>('FILME');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [tmdbError, setTmdbError] = useState<string | null>(null);

  // --- Formulário manual ---
  const [form, setForm] = useState<ContentFormData>(emptyForm);
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setTmdbError(null);
    try {
      const status = await getTmdbStatus();
      if (!status.configurado) {
        setTmdbError('A integração com o TMDB não está configurada (defina TMDB_API_KEY no servidor). Use o cadastro manual.');
        setResults([]);
        return;
      }
      const data = await searchTmdb(query, tmdbTipo);
      setResults(data);
      if (data.length === 0) {
        setTmdbError('Nenhum resultado encontrado para essa busca.');
      }
    } catch {
      setTmdbError('Não foi possível buscar no TMDB agora.');
    } finally {
      setSearching(false);
    }
  }

  async function handleImport(item: TmdbSearchResult) {
    setImportingId(item.tmdbId);
    setTmdbError(null);
    try {
      await importTmdb(item.tmdbId, item.tipo);
      onAdded();
      onClose();
    } catch {
      setTmdbError(`Não foi possível importar "${item.titulo}".`);
    } finally {
      setImportingId(null);
    }
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingManual(true);
    setManualError(null);
    try {
      await createContent({ ...form, ano: form.ano === '' ? '' : Number(form.ano) });
      onAdded();
      onClose();
    } catch {
      setManualError('Não foi possível adicionar este conteúdo.');
    } finally {
      setSavingManual(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Adicionar filme ou série</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button className={tab === 'tmdb' ? 'active' : ''} onClick={() => setTab('tmdb')}>
            Buscar no TMDB
          </button>
          <button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
            Cadastro manual
          </button>
        </div>

        {tab === 'tmdb' ? (
          <div className="modal-body">
            <form className="tmdb-search-bar" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Buscar título..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <select value={tmdbTipo} onChange={(e) => setTmdbTipo(e.target.value as ContentType)}>
                <option value="FILME">Filme</option>
                <option value="SERIE">Série</option>
              </select>
              <button type="submit" className="btn-primary" disabled={searching}>
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            {tmdbError && <div className="alert-error">{tmdbError}</div>}

            <div className="tmdb-results">
              {results.map((item) => (
                <div key={item.tmdbId} className="tmdb-result-card">
                  <div
                    className="tmdb-result-poster"
                    style={{ backgroundImage: item.imagemUrl ? `url(${item.imagemUrl})` : undefined }}
                  >
                    {!item.imagemUrl && <span className="poster-fallback">{item.titulo[0]}</span>}
                  </div>
                  <div className="tmdb-result-info">
                    <strong>{item.titulo}</strong>
                    <span className="catalog-meta">
                      {item.ano || 'Ano desconhecido'} {item.avaliacao ? `· ⭐ ${item.avaliacao.toFixed(1)}` : ''}
                    </span>
                    {item.sinopse && <p className="tmdb-result-synopsis">{item.sinopse}</p>}
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => handleImport(item)}
                    disabled={importingId === item.tmdbId}
                  >
                    {importingId === item.tmdbId ? 'Importando...' : 'Importar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form className="modal-body" onSubmit={handleManualSubmit}>
            {manualError && <div className="alert-error">{manualError}</div>}

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
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as ContentType })}>
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
              <textarea value={form.sinopse} onChange={(e) => setForm({ ...form, sinopse: e.target.value })} rows={3} />
            </label>

            {form.tipo === 'SERIE' && (
              <p className="modal-hint">
                Depois de adicionar, use "Gerenciar" para cadastrar as temporadas e episódios desta série.
              </p>
            )}

            <button type="submit" className="btn-primary" disabled={savingManual}>
              {savingManual ? 'Adicionando...' : 'Adicionar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
