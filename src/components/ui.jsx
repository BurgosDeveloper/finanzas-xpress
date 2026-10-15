import { useEffect, useRef } from 'react'
import { IoClose, IoWarning } from 'react-icons/io5'

export function Field({ label, error, hint, htmlFor, children }) {
  return (
    <div className="field">
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="error" role="alert">
          <IoWarning aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  )
}

export function Coin({ currency }) {
  return <span className={`coin coin-${currency}`} aria-hidden />
}

/** Botones de elección rápida (en vez de listas desplegables). */
export function Segmented({ value, onChange, options, label, small }) {
  return (
    <div className={`seg ${small ? 'seg-small' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.coin && <Coin currency={o.coin} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Sheet({ title, onClose, children }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <IoClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
