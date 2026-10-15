import { IoAdd, IoPencil, IoTrendingDown, IoTrendingUp, IoWarning } from 'react-icons/io5'
import { formatMoney, formatRate, convert, dayLabel } from '../money.js'
import { Coin, Segmented } from './ui.jsx'

const DISPLAY_OPTIONS = [
  { value: 'USD', label: 'US$', coin: 'USD' },
  { value: 'COP', label: 'Pesos', coin: 'COP' },
  { value: 'VES', label: 'Bs', coin: 'VES' },
]
export { DISPLAY_OPTIONS }

export function Hero({ summary, display, onDisplay, title }) {
  const { ingresos, egresos, balance, missing } = summary
  const positive = balance >= 0
  const total = ingresos + egresos
  const pct = total > 0 ? Math.round((ingresos / total) * 100) : 50

  return (
    <section className={`hero ${positive ? 'is-pos' : 'is-neg'}`} aria-live="polite">
      <div className="hero-top">
        <span className="hero-title">
          {positive ? <IoTrendingUp aria-hidden /> : <IoTrendingDown aria-hidden />}
          {positive ? 'Ganancia' : 'Pérdida'} · {title}
        </span>
        <Segmented small value={display} onChange={onDisplay} options={DISPLAY_OPTIONS} label="Ver en" />
      </div>

      <p className="hero-amount">{formatMoney(balance, display, { sign: true })}</p>

      <div className="bar" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>

      <div className="hero-split">
        <div>
          <span className="tag tag-in">
            <IoTrendingUp aria-hidden /> Ingresos
          </span>
          <strong>{formatMoney(ingresos, display)}</strong>
        </div>
        <div>
          <span className="tag tag-out">
            <IoTrendingDown aria-hidden /> Egresos
          </span>
          <strong>{formatMoney(egresos, display)}</strong>
        </div>
      </div>

      {missing > 0 && (
        <p className="warn">
          <IoWarning aria-hidden /> Falta poner la tasa: {missing} {missing === 1 ? 'monto no se suma' : 'montos no se suman'}.
        </p>
      )}
    </section>
  )
}

export function Rates({ rates, canEdit, onEdit }) {
  const missing = !(rates.cop > 0) || !(rates.ves > 0)
  return (
    <section className={`card rates ${missing ? 'rates-missing' : ''}`}>
      <div className="rates-head">
        <h3>Tasas de hoy</h3>
        {canEdit && (
          <button type="button" className="chip-btn" onClick={onEdit}>
            <IoPencil aria-hidden /> {missing ? 'Poner' : 'Cambiar'}
          </button>
        )}
      </div>
      <div className="rates-grid">
        <div>
          <span className="muted small">
            <Coin currency="COP" /> 1 US$ en pesos
          </span>
          <strong>{rates.cop > 0 ? formatRate(rates.cop) : '—'}</strong>
        </div>
        <div>
          <span className="muted small">
            <Coin currency="VES" /> 1 US$ en Bs
          </span>
          <strong>{rates.ves > 0 ? formatRate(rates.ves) : '—'}</strong>
        </div>
      </div>
      {missing && (
        <p className="muted small rates-note">
          {canEdit ? 'Pon las tasas para que se sumen todas las monedas.' : 'El tesorero aún no puso las tasas.'}
        </p>
      )}
    </section>
  )
}

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ingreso', label: 'Ingresos' },
  { value: 'egreso', label: 'Egresos' },
]

export function MovementList({ items, display, rates, canEdit, onOpen, filter, onFilter, empty }) {
  return (
    <section className="list-section">
      <div className="list-head">
        <h3>Movimientos</h3>
        <Segmented small value={filter} onChange={onFilter} options={FILTERS} label="Filtrar" />
      </div>

      {items.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ul className="list">
          {items.map((m) => (
            <Row key={m.id} m={m} display={display} rates={rates} canEdit={canEdit} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({ m, display, rates, canEdit, onOpen }) {
  const isIn = m.type === 'ingreso'
  const approx = m.currency !== display ? convert(m.amount, m.currency, display, rates) : null
  const kindText = m.kind === 'socio' ? `Socio${m.partner ? `: ${m.partner}` : ''}` : m.kind === 'fijo' ? 'Fijo' : 'Variable'
  const inner = (
    <>
      <span className={`row-icon ${isIn ? 'in' : 'out'}`}>{isIn ? <IoTrendingUp aria-hidden /> : <IoTrendingDown aria-hidden />}</span>
      <span className="row-main">
        <span className="row-title">{m.description}</span>
        <span className="row-sub">
          {kindText} · {dayLabel(m.date)}
        </span>
      </span>
      <span className="row-amount">
        <strong className={isIn ? 'in' : 'out'}>{formatMoney(isIn ? m.amount : -m.amount, m.currency)}</strong>
        {m.currency !== display && (
          <span className="muted small">{approx == null ? 'sin tasa' : `≈ ${formatMoney(approx, display)}`}</span>
        )}
      </span>
    </>
  )
  return (
    <li>
      {canEdit ? (
        <button type="button" className="row" onClick={() => onOpen(m)} aria-label={`Editar ${m.description}`}>
          {inner}
        </button>
      ) : (
        <div className="row">{inner}</div>
      )}
    </li>
  )
}

export function AddButton({ onClick }) {
  return (
    <button type="button" className="fab" onClick={onClick}>
      <IoAdd aria-hidden /> Agregar
    </button>
  )
}
