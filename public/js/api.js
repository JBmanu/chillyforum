// Chiamate al server (/api/*) con una piccola cache in memoria
export class ApiError extends Error {
  constructor(status, data) { super(data?.error || `Errore ${status}`); this.status = status; this.data = data; }
}

const cache = new Map();

async function req(method, path, data) {
  const headers = { accept: 'application/json' };
  // Solo in sviluppo locale: simula un altro utente (?) — il server lo ignora in produzione
  try { const dev = localStorage.getItem('chilly.devUser'); if (dev) headers['x-dev-user'] = dev; } catch {}
  if (data !== undefined) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: data !== undefined ? JSON.stringify(data) : undefined, redirect: 'manual', credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, { error: 'Connessione assente. Controlla la rete e riprova.' });
  }
  // Sessione di Cloudflare Access scaduta → ricarica per rifare il login
  if (res.type === 'opaqueredirect' || res.status === 401) { location.reload(); throw new ApiError(401, { error: 'Sessione scaduta' }); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export const api = {
  get: async (path, { fresh = false } = {}) => {
    if (!fresh && cache.has(path)) return cache.get(path);
    const data = await req('GET', path);
    cache.set(path, data);
    return data;
  },
  peek: (path) => cache.get(path),
  post: (p, d) => req('POST', p, d ?? {}),
  put: (p, d) => req('PUT', p, d ?? {}),
  patch: (p, d) => req('PATCH', p, d ?? {}),
  del: (p) => req('DELETE', p),
  set: (path, data) => cache.set(path, data),
  invalidate: (...prefixes) => { for (const k of [...cache.keys()]) if (prefixes.some((p) => k.startsWith(p))) cache.delete(k); },
};
