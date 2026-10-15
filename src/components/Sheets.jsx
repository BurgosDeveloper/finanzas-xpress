import { useMemo, useState } from 'react'
import {
  IoTrendingUp,
  IoTrendingDown,
  IoRepeat,
  IoShuffle,
  IoPerson,
  IoTrashOutline,
  IoWarning,
  IoSwapHorizontal,
} from 'react-icons/io5'
import { api } from '../api.js'
import { check, movementSchema, ratesSchema } from '../../shared/schemas.js'
import { todayStr } from '../money.js'
import { Field, Segmented, Sheet, Coin } from './ui.jsx'

const TYPE_OPTIONS = [
  { value: 'ingreso', label: 'Ingreso', icon: <IoTrendingUp /> },
  { value: 'egreso', label: 'Egreso', icon: <IoTrendingDown /> },
]
const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'US$', coin: 'USD' },
  { value: 'COP', label: 'Pesos', coin: 'COP' },
  { value: 'VES', label: 'Bs', coin: 'VES' },
]
const KIND_OPTIONS = [
  { value: 'fijo', label: 'Fijo', icon: <IoRepeat /> },
  { value: 'variable', label: 'Variable', icon: <IoShuffle /> },
  { value: 'socio', label: 'Socio', icon: <IoPerson /> },
]
const KIND_HINTS = {
  egreso: {
    fijo: 'Se paga siempre, como alquiler o internet.',
    variable: 'Cambia cada vez, como compras o reparaciones.',
    socio: 'Gasto personal de un socio.',
  },
  ingreso: {
    fijo: 'Entra siempre, como un cliente mensual.',
    variable: 'Cambia cada vez, como una venta.',
    socio: 'Dinero que puso un socio.',
  },
}

function useForm(schema, initial) {
  const [values, setValues] = useState(initial)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const result = useMemo(() => check(schema, values), [schema, values])

  const shown = (k) => (submitted || touched[k]) && ((!result.ok && result.errors[k]) || serverErrors[k])
  const errors = {}
  const keys = new Set([...(result.ok ? [] : Object.keys(result.errors)), ...Object.keys(serverErrors)])
  for (const k of keys) {
    const message = shown(k)
    if (message) errors[k] = message
  }

  return {
    values,
    result,
    errors,
    submitted,
    setSubmitted,
    setServerErrors,
    set: (k) => (v) => {
      setValues((s) => ({ ...s, [k]: v }))
      setServerErrors((s) => ({ ...s, [k]: undefined }))
    },
    input: (k) => ({
      value: values[k],
      onChange: (e) => {
        setValues((s) => ({ ...s, [k]: e.target.value }))
        setServerErrors((s) => ({ ...s, [k]: undefined }))
      },
      onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
    }),
  }
}

export function MovementSheet({ movement, onClose, onSaved }) {
  const editing = Boolean(movement)
  const form = useForm(
    movementSchema,
    movement
      ? {
          type: movement.type,
          description: movement.description,
          amount: String(movement.amount).replace('.', ','),
          currency: movement.currency,
          kind: movement.kind,
          partner: movement.partner || '',
          date: movement.date,
        }
      : { type: 'egreso', description: '', amount: '', currency: 'USD', kind: 'variable', partner: '', date: todayStr() },
  )
  const { values, errors } = form
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save(e) {
    e.preventDefault()
    form.setSubmitted(true)
    if (!form.result.ok) return
    setBusy(true)
    setFormError('')
    try {
      if (editing) await api.updateMovement(movement.id, form.result.data)
      else await api.addMovement(form.result.data)
      await onSaved(editing ? 'Cambios guardados' : 'Guardado')
    } catch (err) {
      if (err.data?.fields) form.setServerErrors(err.data.fields)
      else setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setFormError('')
    try {
      await api.deleteMovement(movement.id)
      await onSaved('Eliminado')
    } catch (err) {
      setFormError(err.message)
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={editing ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose}>
      <form onSubmit={save} noValidate className="form">
        <Segmented value={values.type} onChange={form.set('type')} options={TYPE_OPTIONS} label="Tipo de movimiento" />

        <Field label="¿Qué fue?" htmlFor="description" error={errors.description}>
          <input id="description" placeholder="Ej: Pago de internet" maxLength={80} autoComplete="off" {...form.input('description')} />
        </Field>

        <div className="two">
          <Field label="Monto" htmlFor="amount" error={errors.amount}>
            <input id="amount" inputMode="decimal" placeholder="0,00" autoComplete="off" {...form.input('amount')} />
          </Field>
          <Field label="Fecha" htmlFor="date" error={errors.date}>
            <input id="date" type="date" {...form.input('date')} />
          </Field>
        </div>

        <Field label="Moneda" error={errors.currency}>
          <Segmented value={values.currency} onChange={form.set('currency')} options={CURRENCY_OPTIONS} label="Moneda" />
        </Field>

        <Field label="Clase" error={errors.kind} hint={KIND_HINTS[values.type][values.kind]}>
          <Segmented value={values.kind} onChange={form.set('kind')} options={KIND_OPTIONS} label="Clase" />
        </Field>

        {values.kind === 'socio' && (
          <Field label="¿Qué socio?" htmlFor="partner" error={errors.partner}>
            <input id="partner" placeholder="Nombre del socio" maxLength={60} autoComplete="off" {...form.input('partner')} />
          </Field>
        )}

        {formError && (
          <p className="error form-error" role="alert">
            <IoWarning aria-hidden /> {formError}
          </p>
        )}

        <button type="submit" className="btn btn-gold" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>

        {editing &&
          (confirmDelete ? (
            <div className="confirm">
              <span>¿Eliminar este movimiento?</span>
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
                Sí, eliminar
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost danger-text" onClick={() => setConfirmDelete(true)}>
              <IoTrashOutline aria-hidden /> Eliminar
            </button>
          ))}
      </form>
    </Sheet>
  )
}

export function RatesSheet({ rates, onClose, onSaved }) {
  const fmt = (n) => (n > 0 ? String(n).replace('.', ',') : '')
  const form = useForm(ratesSchema, { cop: fmt(rates.cop), ves: fmt(rates.ves) })
  const { errors } = form
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  async function save(e) {
    e.preventDefault()
    form.setSubmitted(true)
    if (!form.result.ok) return
    setBusy(true)
    setFormError('')
    try {
      await api.saveRates(form.result.data)
      await onSaved('Tasas guardadas')
    } catch (err) {
      if (err.data?.fields) form.setServerErrors(err.data.fields)
      else setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Tasas del dólar" onClose={onClose}>
      <form onSubmit={save} noValidate className="form">
        <p className="muted small rates-help">
          <IoSwapHorizontal aria-hidden /> Escribe cuánto vale 1 dólar. Con esto se suman todas las monedas.
        </p>
        <Field
          label={
            <>
              <Coin currency="COP" /> 1 dólar = ¿cuántos pesos?
            </>
          }
          htmlFor="cop"
          error={errors.cop}
        >
          <input id="cop" inputMode="decimal" placeholder="Ej: 4000" autoComplete="off" {...form.input('cop')} />
        </Field>
        <Field
          label={
            <>
              <Coin currency="VES" /> 1 dólar = ¿cuántos Bs?
            </>
          }
          htmlFor="ves"
          error={errors.ves}
        >
          <input id="ves" inputMode="decimal" placeholder="Ej: 40,50" autoComplete="off" {...form.input('ves')} />
        </Field>

        {formError && (
          <p className="error form-error" role="alert">
            <IoWarning aria-hidden /> {formError}
          </p>
        )}

        <button type="submit" className="btn btn-gold" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar tasas'}
        </button>
      </form>
    </Sheet>
  )
}
