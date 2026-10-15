import { useMemo, useState } from 'react'
import { IoCash, IoEye, IoEyeOff, IoLockClosed, IoPerson, IoInformationCircle, IoWarning } from 'react-icons/io5'
import { api } from '../api.js'
import { check, loginSchema } from '../../shared/schemas.js'
import { Field } from './ui.jsx'

export default function Login({ notice, onDone }) {
  const [values, setValues] = useState({ username: '', password: '' })
  const [show, setShow] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [busyAccount, setBusyAccount] = useState(false) // cuenta abierta en otro dispositivo

  const result = useMemo(() => check(loginSchema, values), [values])
  const errors = submitted && !result.ok ? result.errors : {}

  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    setFormError('')
    setBusyAccount(false)
  }

  async function submit(e, force = false) {
    e?.preventDefault()
    setSubmitted(true)
    if (!result.ok) return
    setBusy(true)
    setFormError('')
    try {
      await api.login({ ...result.data, force })
      await onDone()
    } catch (err) {
      if (err.data?.code === 'SESSION_ACTIVE') setBusyAccount(true)
      else setFormError(err.data?.fields ? 'Revisa los datos' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="logo-coin">
          <IoCash aria-hidden />
        </div>
        <h1>Finanzas Xpress</h1>
        <p className="muted">Ingresos y egresos de la empresa</p>

        {notice && (
          <p className="notice">
            <IoInformationCircle aria-hidden /> {notice}
          </p>
        )}

        <form onSubmit={submit} noValidate>
          <Field label="Usuario" htmlFor="username" error={errors.username}>
            <div className="input-wrap">
              <IoPerson aria-hidden />
              <input
                id="username"
                value={values.username}
                onChange={set('username')}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Tu usuario"
              />
            </div>
          </Field>

          <Field label="Clave" htmlFor="password" error={errors.password}>
            <div className="input-wrap">
              <IoLockClosed aria-hidden />
              <input
                id="password"
                type={show ? 'text' : 'password'}
                value={values.password}
                onChange={set('password')}
                autoComplete="current-password"
                placeholder="Tu clave"
              />
              <button
                type="button"
                className="eye"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Ocultar clave' : 'Mostrar clave'}
              >
                {show ? <IoEyeOff /> : <IoEye />}
              </button>
            </div>
          </Field>

          {formError && (
            <p className="error form-error" role="alert">
              <IoWarning aria-hidden /> {formError}
            </p>
          )}

          {busyAccount ? (
            <div className="takeover">
              <p>
                <IoInformationCircle aria-hidden /> Esta cuenta está abierta en otro teléfono o computadora.
              </p>
              <button type="button" className="btn btn-gold" disabled={busy} onClick={() => submit(null, true)}>
                {busy ? 'Entrando…' : 'Cerrar la otra y entrar aquí'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setBusyAccount(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="submit" className="btn btn-gold" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          )}
        </form>
      </div>
    </main>
  )
}
