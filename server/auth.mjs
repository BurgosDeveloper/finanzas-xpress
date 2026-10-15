// Sesiones: el tesorero solo puede tener una activa; el supervisor varias.
import { createHash, randomBytes } from 'node:crypto'
import { db, verifyPassword, hashPassword } from './db.mjs'

const COOKIE = 'fx_session'
const SESSION_DAYS = 14
const MAX_FAILS = 8 // intentos fallidos permitidos cada 10 minutos

// Clave falsa para que tardar lo mismo aunque el usuario no exista.
let dummyHash
const sha256 = (s) => createHash('sha256').update(s).digest('hex')

function readCookie(req, name) {
  const header = req.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

function isSecure(req) {
  const proto = req.headers.get('x-forwarded-proto')
  return proto ? proto.split(',')[0].trim() === 'https' : new URL(req.url).protocol === 'https:'
}

function cookieHeader(req, value, maxAgeSeconds) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (isSecure(req)) parts.push('Secure')
  return parts.join('; ')
}

export const clearCookie = (req) => cookieHeader(req, '', 0)

export function clientIp(req) {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'desconocida'
  )
}

/**
 * Intenta entrar. Devuelve:
 *  { status: 'ok', cookie, user }
 *  { status: 'bad' }            usuario o clave incorrectos
 *  { status: 'busy' }           el tesorero ya está en otro dispositivo
 *  { status: 'blocked' }        demasiados intentos
 */
export async function login(req, { username, password, force }) {
  const sql = db()
  const key = `${clientIp(req)}|${username.toLowerCase()}`

  const [{ n }] = await sql`
    select count(*)::int as n from login_attempts
    where key = ${key} and at > now() - interval '10 minutes'`
  if (n >= MAX_FAILS) return { status: 'blocked' }

  const rows = await sql`
    select id, username, role, password_hash from users where username = ${username.toLowerCase()}`
  const user = rows[0]
  dummyHash ??= await hashPassword('no-existe')
  const ok = await verifyPassword(password, user ? user.password_hash : dummyHash)
  if (!user || !ok) {
    await sql`insert into login_attempts (key) values (${key})`
    await sql`delete from login_attempts where at < now() - interval '1 day'`
    return { status: 'bad' }
  }
  await sql`delete from login_attempts where key = ${key}`

  const single = user.role === 'tesorero'
  if (single && !force) {
    const active = await sql`
      select 1 from sessions where user_id = ${user.id} and expires_at > now() limit 1`
    if (active.length) return { status: 'busy' }
  }

  const token = randomBytes(32).toString('base64url')
  const ua = (req.headers.get('user-agent') || '').slice(0, 200)
  try {
    await sql.transaction((t) => [
      // Cierra sesiones vencidas y, para el tesorero, cualquier otra sesión.
      t.query('delete from sessions where expires_at <= now() or (user_id = $1 and $2::boolean)', [
        user.id,
        single,
      ]),
      t.query(
        `insert into sessions (user_id, token_hash, single, user_agent, expires_at)
         values ($1, $2, $3, $4, now() + ($5 || ' days')::interval)`,
        [user.id, sha256(token), single, ua, String(SESSION_DAYS)],
      ),
    ])
  } catch (err) {
    if (err?.code === '23505') return { status: 'busy' } // dos entradas a la vez
    throw err
  }
  return {
    status: 'ok',
    cookie: cookieHeader(req, token, SESSION_DAYS * 86400),
    user: { username: user.username, role: user.role },
  }
}

/** Devuelve { id, username, role } si la sesión es válida; si no, null. */
export async function currentUser(req) {
  const token = readCookie(req, COOKIE)
  if (!token) return null
  const sql = db()
  const hash = sha256(token)
  const rows = await sql`
    select s.id as session_id, s.last_seen, u.id, u.username, u.role
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hash} and s.expires_at > now()`
  const row = rows[0]
  if (!row) return null
  if (Date.now() - new Date(row.last_seen).getTime() > 5 * 60 * 1000) {
    await sql`update sessions set last_seen = now(),
              expires_at = now() + (${String(SESSION_DAYS)} || ' days')::interval
              where id = ${row.session_id}`
  }
  return { id: row.id, username: row.username, role: row.role }
}

export async function logout(req) {
  const token = readCookie(req, COOKIE)
  if (token) await db()`delete from sessions where token_hash = ${sha256(token)}`
}
