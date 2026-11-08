/**
 * Autenticazione tramite Cloudflare Access (codice via email).
 * Access mette davanti al sito una pagina di login: l'utente inserisce
 * l'email, riceve un codice, e Access inoltra ogni richiesta con un JWT
 * firmato (header Cf-Access-Jwt-Assertion). Qui verifichiamo la firma
 * e poi controlliamo che l'email sia nella tabella `people`.
 */

let certCache = { keys: null, fetchedAt: 0 };

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function getKeys(teamDomain) {
  const now = Date.now();
  if (certCache.keys && now - certCache.fetchedAt < 3600_000) return certCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Impossibile scaricare le chiavi di Access');
  const { keys } = await res.json();
  certCache = { keys, fetchedAt: now };
  return keys;
}

async function verifyAccessJwt(token, env) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('JWT malformato');
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));

  const keys = await getKeys(env.ACCESS_TEAM_DOMAIN);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Chiave JWT sconosciuta');

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new Error('Firma JWT non valida');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('Sessione scaduta');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw new Error('AUD non valido');
  if (payload.iss && payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) throw new Error('Issuer non valido');
  return String(payload.email || '').toLowerCase();
}

/** Ritorna l'email autenticata o lancia un errore. */
export async function getEmail(request, env) {
  // Sviluppo locale: email finta da .dev.vars (header x-dev-user per simulare altri utenti)
  if (env.DEV_USER_EMAIL) {
    return (request.headers.get('x-dev-user') || env.DEV_USER_EMAIL).toLowerCase();
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new Error('Cloudflare Access non configurato (ACCESS_TEAM_DOMAIN / ACCESS_AUD)');
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new Error('Accesso non autenticato');
  return verifyAccessJwt(token, env);
}

export function adminEmails(env) {
  return String(env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Trova la persona collegata all'email. Gli admin definiti in
 * ADMIN_EMAILS vengono creati automaticamente al primo accesso.
 */
export async function getCurrentUser(request, env) {
  const email = await getEmail(request, env);
  let user = await env.DB.prepare('SELECT * FROM people WHERE email = ?').bind(email).first();
  const isEnvAdmin = adminEmails(env).includes(email);
  if (!user && isEnvAdmin) {
    const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    user = await env.DB.prepare('INSERT INTO people (email, name, is_admin) VALUES (?, ?, 1) RETURNING *')
      .bind(email, name).first();
  } else if (user && isEnvAdmin && !user.is_admin) {
    await env.DB.prepare('UPDATE people SET is_admin = 1 WHERE id = ?').bind(user.id).run();
    user.is_admin = 1;
  }
  return { email, user };
}
