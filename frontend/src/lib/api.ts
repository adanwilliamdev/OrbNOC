// Cliente HTTP. Mesma origem (Caddy encaminha /api e /ws): sem CORS e sem URL embutida no build.
// A sessão é um cookie httpOnly — o JavaScript nunca vê o token.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Extrai uma mensagem legível do erro do FastAPI (`detail` string ou lista de validação). */
function messageFrom(payload: unknown, status: number): string {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    const field = first.loc?.filter((p) => p !== 'body').join('.');
    const msg = (first.msg ?? '').replace(/^Value error, /, '');
    return field ? `${field}: ${msg}` : msg;
  }
  return status >= 500 ? 'Erro interno do servidor' : `Erro ${status}`;
}

export async function apiFetch<T>(path: string, { method = 'GET', body, signal }: ApiOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Não foi possível conectar ao servidor', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(messageFrom(payload, response.status), response.status);
  return payload as T;
}

export const errorMessage = (error: unknown, fallback = 'Erro inesperado'): string =>
  error instanceof Error ? error.message : fallback;
