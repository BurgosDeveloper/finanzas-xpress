// Cálculos y formatos de dinero. Todo se pasa por dólares como moneda base.
import { CURRENCY_SYMBOLS } from '../shared/schemas.js'

const rateOf = (cur, rates) => (cur === 'COP' ? rates?.cop : cur === 'VES' ? rates?.ves : 1)

/** Convierte entre monedas. Devuelve null si falta la tasa necesaria. */
export function convert(amount, from, to, rates) {
  if (from === to) return amount
  const rFrom = rateOf(from, rates)
  const rTo = rateOf(to, rates)
  if (!(rFrom > 0) || !(rTo > 0)) return null
  return (amount / rFrom) * rTo
}

const nf = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
})

export function formatMoney(n, cur, { sign = false } = {}) {
  const abs = nf.format(Math.abs(n))
  const s = n < 0 ? '-' : sign && n > 0 ? '+' : ''
  return `${s}${CURRENCY_SYMBOLS[cur]} ${abs}`
}

export function formatRate(n) {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4, useGrouping: 'always' }).format(n)
}

/** Suma ingresos y egresos en la moneda elegida. */
export function summarize(movements, rates, display) {
  let ingresos = 0
  let egresos = 0
  let missing = 0
  for (const m of movements) {
    const v = convert(m.amount, m.currency, display, rates)
    if (v == null) {
      missing += 1
      continue
    }
    if (m.type === 'ingreso') ingresos += v
    else egresos += v
  }
  return { ingresos, egresos, balance: ingresos - egresos, missing }
}

// ---- Fechas (en hora local del teléfono) ----------------------------------
const pad = (n) => String(n).padStart(2, '0')
export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const currentMonth = () => todayStr().slice(0, 7)

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  const text = new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}
