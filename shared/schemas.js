// Validaciones compartidas: las usa la web (para avisar al instante)
// y el servidor (para no confiar nunca en lo que llega).
import { z } from 'zod'

export const CURRENCIES = ['USD', 'COP', 'VES']
export const TYPES = ['ingreso', 'egreso']
export const KINDS = ['fijo', 'variable', 'socio']

export const CURRENCY_LABELS = {
  USD: 'Dólares',
  COP: 'Pesos',
  VES: 'Bolívares',
}
export const CURRENCY_SYMBOLS = { USD: 'US$', COP: 'COP', VES: 'Bs' }
export const KIND_LABELS = { fijo: 'Fijo', variable: 'Variable', socio: 'Socio' }
export const TYPE_LABELS = { ingreso: 'Ingreso', egreso: 'Egreso' }

/** Convierte "1250,5" o "1250.5" en número. Devuelve NaN si no se entiende. */
export function parseNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return NaN
  const clean = value.trim().replace(/\s+/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(clean)) return NaN
  return Number(clean)
}

const hasMaxDecimals = (n, d) => {
  const f = 10 ** d
  return Math.abs(n * f - Math.round(n * f)) < 1e-6
}

const money = (label, decimals = 2) =>
  z.preprocess(
    (v) => (v === '' || v == null ? undefined : parseNumber(v)),
    z
      .number({ error: `Escribe ${label}` })
      .refine((n) => Number.isFinite(n), `Escribe ${label} con números`)
      .refine((n) => n > 0, `${label[0].toUpperCase() + label.slice(1)} debe ser mayor que 0`)
      .refine((n) => n <= 1e12, `${label[0].toUpperCase() + label.slice(1)} es demasiado grande`)
      .refine((n) => hasMaxDecimals(n, decimals), `Máximo ${decimals} decimales`),
  )

const isRealDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export const loginSchema = z.object({
  username: z
    .string({ error: 'Escribe tu usuario' })
    .trim()
    .min(1, 'Escribe tu usuario')
    .max(40, 'Usuario muy largo'),
  password: z
    .string({ error: 'Escribe tu clave' })
    .min(1, 'Escribe tu clave')
    .max(100, 'Clave muy larga'),
  force: z.boolean().optional(),
})

export const movementSchema = z
  .object({
    type: z.enum(TYPES, { error: 'Elige ingreso o egreso' }),
    description: z
      .string({ error: 'Escribe una descripción' })
      .trim()
      .min(2, 'Escribe una descripción')
      .max(80, 'Máximo 80 letras'),
    amount: money('el monto'),
    currency: z.enum(CURRENCIES, { error: 'Elige la moneda' }),
    kind: z.enum(KINDS, { error: 'Elige el tipo' }),
    partner: z.string().trim().max(60, 'Máximo 60 letras').nullish(),
    date: z
      .string({ error: 'Elige la fecha' })
      .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isRealDate(s), 'Fecha no válida'),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'socio' && !v.partner) {
      ctx.addIssue({ code: 'custom', path: ['partner'], message: 'Escribe el nombre del socio' })
    }
  })
  .transform((v) => ({ ...v, partner: v.kind === 'socio' ? v.partner : null }))

export const ratesSchema = z.object({
  cop: money('la tasa de pesos', 4),
  ves: money('la tasa de bolívares', 4),
})

export const idSchema = z.coerce.number().int().positive()

/** Devuelve { ok, data } o { ok:false, errors:{campo:mensaje} } */
export function check(schema, input) {
  const r = schema.safeParse(input)
  if (r.success) return { ok: true, data: r.data }
  const errors = {}
  for (const issue of r.error.issues) {
    const key = issue.path[0] ?? '_'
    if (!errors[key]) errors[key] = issue.message
  }
  return { ok: false, errors }
}
