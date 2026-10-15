// Conexión a Neon (Postgres) y creación automática de las tablas.
import { neon } from '@neondatabase/serverless'
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'

function connectionString() {
  const env = process.env
  const url = env.DATABASE_URL || env.NETLIFY_DATABASE_URL
  if (url) return url
  const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = env
  if (PGHOST && PGDATABASE && PGUSER && PGPASSWORD) {
    return `postgresql://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}/${PGDATABASE}?sslmode=require`
  }
  throw new Error('Falta configurar la base de datos (variables de entorno)')
}

let _sql
export function db() {
  if (!_sql) _sql = neon(connectionString())
  return _sql
}

// ---- Claves ---------------------------------------------------------------
const scryptAsync = (password, salt) =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))),
  )

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  const [alg, saltB64, keyB64] = String(stored).split('$')
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// ---- Tablas ---------------------------------------------------------------
const SCHEMA = [
  `create table if not exists users (
    id serial primary key,
    username text unique not null,
    password_hash text not null,
    role text not null check (role in ('tesorero','supervisor'))
  )`,
  `create table if not exists sessions (
    id bigserial primary key,
    user_id int not null references users(id) on delete cascade,
    token_hash text unique not null,
    single boolean not null default false,
    user_agent text,
    created_at timestamptz not null default now(),
    last_seen timestamptz not null default now(),
    expires_at timestamptz not null
  )`,
  // Garantiza que el tesorero tenga como máximo UNA sesión activa.
  `create unique index if not exists sessions_one_active_per_user on sessions (user_id) where single`,
  `create table if not exists movements (
    id bigserial primary key,
    type text not null check (type in ('ingreso','egreso')),
    description text not null,
    amount numeric(18,2) not null check (amount > 0),
    currency text not null check (currency in ('USD','COP','VES')),
    kind text not null check (kind in ('fijo','variable','socio')),
    partner text,
    occurred_on date not null,
    created_by int references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists movements_date_idx on movements (occurred_on desc, id desc)`,
  `create table if not exists settings (
    id int primary key default 1 check (id = 1),
    rate_cop numeric(18,4),
    rate_ves numeric(18,4),
    version bigint not null default 1,
    updated_at timestamptz not null default now()
  )`,
  `insert into settings (id) values (1) on conflict do nothing`,
  `create table if not exists login_attempts (
    id bigserial primary key,
    key text not null,
    at timestamptz not null default now()
  )`,
  `create index if not exists login_attempts_key_idx on login_attempts (key, at)`,
]

const DEFAULT_USERS = [
  { username: 'tesorero', role: 'tesorero', envKey: 'TESORERO_PASSWORD', fallback: 'tesorero1' },
  { username: 'supervisor', role: 'supervisor', envKey: 'SUPERVISOR_PASSWORD', fallback: 'supervisor1' },
]

let ready

/** Crea tablas y usuarios si faltan. Se ejecuta una vez por instancia. */
export function ensureReady() {
  if (!ready) {
    ready = setup().catch((err) => {
      ready = undefined // permite reintentar en la próxima petición
      throw err
    })
  }
  return ready
}

async function setup() {
  const sql = db()
  await sql.transaction((t) => [
    t`select pg_advisory_xact_lock(724001)`,
    ...SCHEMA.map((q) => t.query(q)),
  ])
  const existing = await sql`select username from users`
  const have = new Set(existing.map((r) => r.username))
  for (const u of DEFAULT_USERS) {
    if (have.has(u.username)) continue
    const hash = await hashPassword(process.env[u.envKey] || u.fallback)
    await sql`insert into users (username, password_hash, role)
              values (${u.username}, ${hash}, ${u.role}) on conflict (username) do nothing`
  }
}
