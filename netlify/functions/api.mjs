// API de Finanzas Xpress (Netlify Function). Todas las rutas empiezan con /api
import { db, ensureReady } from '../../server/db.mjs'
import { login, logout, currentUser, clearCookie } from '../../server/auth.mjs'
import { check, loginSchema, movementSchema, ratesSchema, idSchema } from '../../shared/schemas.js'

export const config = { path: '/api/*' }

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })

const fail = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status)

async function readBody(req) {
  const text = await req.text()
  if (text.length > 10_000) throw Object.assign(new Error('grande'), { http: 413 })
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw Object.assign(new Error('json'), { http: 400 })
  }
}

// Evita que otra página pueda enviar acciones a nombre del usuario.
function sameOrigin(req) {
  const origin = req.headers.get('origin')
  if (!origin) return false
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

// ---- Rutas ----------------------------------------------------------------
async function getState(req, user) {
  const sql = db()
  const sinceRaw = new URL(req.url).searchParams.get('v')
  const [meta] = await sql`select version::int as version from settings where id = 1`
  if (sinceRaw !== null && Number(sinceRaw) === meta.version) {
    return json({ changed: false, version: meta.version })
  }
  const [settings, movements] = await sql.transaction(
    (t) => [
      t`select version::int as version, rate_cop::float8 as cop, rate_ves::float8 as ves
        from settings where id = 1`,
      t`select id::int as id, type, description, amount::float8 as amount, currency, kind, partner,
               to_char(occurred_on, 'YYYY-MM-DD') as date
        from movements order by occurred_on desc, id desc limit 5000`,
    ],
    { isolationLevel: 'RepeatableRead', readOnly: true },
  )
  const s = settings[0]
  return json({
    changed: true,
    version: s.version,
    user: { username: user.username, role: user.role },
    rates: { cop: s.cop, ves: s.ves },
    movements,
  })
}

const bump = (t) => t.query('update settings set version = version + 1, updated_at = now() where id = 1')

async function createMovement(req, user) {
  const parsed = check(movementSchema, await readBody(req))
  if (!parsed.ok) return fail('Revisa los datos', 400, { fields: parsed.errors })
  const m = parsed.data
  await db().transaction((t) => [
    t.query(
      `insert into movements (type, description, amount, currency, kind, partner, occurred_on, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [m.type, m.description, m.amount, m.currency, m.kind, m.partner, m.date, user.id],
    ),
    bump(t),
  ])
  return json({ ok: true }, 201)
}

async function updateMovement(req, idRaw) {
  const id = idSchema.safeParse(idRaw)
  if (!id.success) return fail('No se encontró', 404)
  const parsed = check(movementSchema, await readBody(req))
  if (!parsed.ok) return fail('Revisa los datos', 400, { fields: parsed.errors })
  const m = parsed.data
  await db().transaction((t) => [
    t.query(
      `update movements set type=$1, description=$2, amount=$3, currency=$4, kind=$5,
              partner=$6, occurred_on=$7, updated_at=now() where id=$8`,
      [m.type, m.description, m.amount, m.currency, m.kind, m.partner, m.date, id.data],
    ),
    bump(t),
  ])
  return json({ ok: true })
}

async function deleteMovement(idRaw) {
  const id = idSchema.safeParse(idRaw)
  if (!id.success) return fail('No se encontró', 404)
  await db().transaction((t) => [t.query('delete from movements where id = $1', [id.data]), bump(t)])
  return json({ ok: true })
}

async function saveRates(req) {
  const parsed = check(ratesSchema, await readBody(req))
  if (!parsed.ok) return fail('Revisa los datos', 400, { fields: parsed.errors })
  const { cop, ves } = parsed.data
  await db().transaction((t) => [
    t.query('update settings set rate_cop = $1, rate_ves = $2, version = version + 1, updated_at = now() where id = 1', [cop, ves]),
  ])
  return json({ ok: true })
}

// ---- Entrada --------------------------------------------------------------
export default async function handler(req) {
  try {
    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '')
    const [resource, id] = path.split('/')
    const method = req.method

    if (method !== 'GET' && !sameOrigin(req)) return fail('Solicitud no permitida', 403)

    await ensureReady()

    if (resource === 'login' && method === 'POST') {
      const parsed = check(loginSchema, await readBody(req))
      if (!parsed.ok) return fail('Revisa los datos', 400, { fields: parsed.errors })
      const r = await login(req, parsed.data)
      if (r.status === 'blocked') return fail('Muchos intentos. Espera unos minutos.', 429)
      if (r.status === 'bad') return fail('Usuario o clave incorrectos', 401)
      if (r.status === 'busy') {
        return fail('Esta cuenta ya está abierta en otro dispositivo', 409, { code: 'SESSION_ACTIVE' })
      }
      return json({ ok: true, user: r.user }, 200, { 'set-cookie': r.cookie })
    }

    if (resource === 'logout' && method === 'POST') {
      await logout(req)
      return json({ ok: true }, 200, { 'set-cookie': clearCookie(req) })
    }

    const user = await currentUser(req)
    if (!user) return fail('Sesión cerrada', 401, { code: 'NO_SESSION' })

    if (resource === 'state' && method === 'GET') return await getState(req, user)

    // Desde aquí solo el tesorero puede cambiar datos.
    const writes = ['movements', 'rates']
    if (writes.includes(resource) && method !== 'GET') {
      if (user.role !== 'tesorero') return fail('Solo el tesorero puede hacer cambios', 403)
      if (resource === 'movements' && method === 'POST' && !id) return await createMovement(req, user)
      if (resource === 'movements' && method === 'PUT' && id) return await updateMovement(req, id)
      if (resource === 'movements' && method === 'DELETE' && id) return await deleteMovement(id)
      if (resource === 'rates' && method === 'PUT') return await saveRates(req)
    }

    return fail('No encontrado', 404)
  } catch (err) {
    if (err?.http) return fail('Solicitud no válida', err.http)
    console.error('Error en la API:', err)
    return fail('Algo salió mal. Intenta de nuevo.', 500)
  }
}
