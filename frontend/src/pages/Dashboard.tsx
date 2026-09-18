import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Clapperboard, Clock, Film, ListChecks, Tv, TrendingUp } from 'lucide-react';
import { getDashboard } from '../api/dashboard';
import { DashboardData } from '../types';

const STATUS_COLORS = ['var(--success)', 'var(--info)', 'var(--border)'];
const GENRE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="recharts-tooltip-dark">
      {label && <div style={{ marginBottom: 4, color: 'var(--text-muted)' }}>{label}</div>}
      {payload.map((item: any, i: number) => (
        <div key={i}>
          {item.name}: <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setError('Não foi possível carregar o dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Carregando dashboard...</div>;
  if (error) return <div className="alert-error">{error}</div>;
  if (!data) return null;

  const statusSeriesData = [
    { name: 'Concluídas', value: data.seriesConcluidas },
    { name: 'Em progresso', value: data.seriesEmProgresso },
    { name: 'Não iniciadas', value: data.seriesNaoIniciadas },
  ].filter((item) => item.value > 0);

  const temSeries = data.totalSeries > 0 && statusSeriesData.length > 0;
  const temGeneros = data.distribuicaoPorGenero.length > 0;

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon amber"><Film size={18} /></div>
          <div className="stat-text">
            <span className="stat-value">{data.totalFilmes}</span>
            <span className="stat-label">Filmes no catálogo</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Tv size={18} /></div>
          <div className="stat-text">
            <span className="stat-value">{data.totalSeries}</span>
            <span className="stat-label">Séries no catálogo</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><ListChecks size={18} /></div>
          <div className="stat-text">
            <div className="stat-value-row">
              <span className="stat-value">{data.episodiosAssistidos}</span>
              {data.episodiosAssistidos > 0 && (
                <span className="stat-trend"><TrendingUp size={11} /> Ativo</span>
              )}
            </div>
            <span className="stat-label">Episódios assistidos</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon rose"><Clock size={18} /></div>
          <div className="stat-text">
            <span className="stat-value">{data.totalHorasAssistidas.toFixed(1)}h</span>
            <span className="stat-label">Total de horas assistidas</span>
          </div>
        </div>
      </div>

      <div className="progress-overall">
        <div className="progress-overall-header">
          <span>Progresso geral</span>
          <span>{data.progressoGeral.toFixed(0)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${data.progressoGeral}%` }} />
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Séries: concluídas x em progresso</h3>
          {temSeries ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusSeriesData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    cornerRadius={8}
                    paddingAngle={statusSeriesData.length > 1 ? 3 : 0}
                    stroke="none"
                  >
                    {statusSeriesData.map((_, index) => (
                      <Cell key={index} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                {statusSeriesData.map((item, i) => (
                  <div className="chart-legend-item" key={item.name}>
                    <span className="chart-legend-dot" style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                    {item.name} ({item.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">Adicione séries ao catálogo para ver esse gráfico.</p>
          )}
        </div>

        <div className="chart-card">
          <h3>Distribuição por gênero</h3>
          {temGeneros ? (
            <div className="genre-list">
              {(() => {
                const max = Math.max(...data.distribuicaoPorGenero.map((g) => g.quantidade));
                return data.distribuicaoPorGenero.map((item, index) => (
                  <div className="genre-row" key={item.genero}>
                    <span className="genre-row-label">{item.genero}</span>
                    <div className="genre-row-track">
                      <div
                        className="genre-row-fill"
                        style={{
                          width: `${max > 0 ? (item.quantidade / max) * 100 : 0}%`,
                          background: GENRE_COLORS[index % GENRE_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="genre-row-value">{item.quantidade}</span>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p className="empty-state">Nenhum gênero cadastrado ainda.</p>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2 style={{ marginBottom: 0 }}>Continuar assistindo</h2>
        </div>
        {data.continuarAssistindo.length === 0 ? (
          <p className="empty-state">
            <Clapperboard size={20} style={{ marginBottom: 6, opacity: 0.6 }} />
            <br />
            Você ainda não começou a assistir nada. Explore o catálogo!
          </p>
        ) : (
          <div className="continue-grid">
            {data.continuarAssistindo.map((item) => (
              <Link to={`/catalogo/${item.conteudoId}`} key={item.episodioId} className="continue-card">
                <div
                  className="continue-poster"
                  style={{ backgroundImage: item.imagemUrl ? `url(${item.imagemUrl})` : undefined }}
                />
                <div className="continue-info">
                  <strong>{item.tituloConteudo}</strong>
                  <span>T{item.numeroTemporada} · E{item.numeroEpisodio}</span>
                  <div className="progress-bar small">
                    <div className="progress-bar-fill" style={{ width: `${item.progressoSerie}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
