import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IoCash,
  IoChevronBack,
  IoChevronForward,
  IoCheckmarkCircle,
  IoCloudOffline,
  IoLogOutOutline,
  IoShieldCheckmark,
  IoWallet,
} from 'react-icons/io5'
import { api, setUnauthorizedHandler } from './api.js'
import { currentMonth, monthLabel, shiftMonth, summarize } from './money.js'
import Login from './components/Login.jsx'
import { AddButton, Hero, MovementList, Rates } from './components/Dashboard.jsx'
import { MovementSheet, RatesSheet } from './components/Sheets.jsx'

const POLL_MS = 5000
const LOST_NOTICE = 'Tu sesión se cerró. Entra de nuevo para continuar.'

export default function App() {
  const [phase, setPhase] = useState('loading') // loading | login | app
  const [data, setData] = useState(null)
  const [notice, setNotice] = useState('')
  const [online, setOnline] = useState(true)
  const [toast, setToast] = useState('')

  const [display, setDisplay] = useState(() => localStorage.getItem('fx_display') || 'USD')
  const [month, setMonth] = useState(currentMonth()) // 'YYYY-MM' o 'all'
  const [filter, setFilter] = useState('todos')
  const [sheet, setSheet] = useState(null) // { type: 'movement', movement? } | { type: 'rates' }

  const phaseRef = useRef('loading')
  const versionRef = useRef(null)
  const busyRef = useRef(false)

  const go = (p) => {
    phaseRef.current = p
    setPhase(p)
  }

  const refresh = useCallback(async (force = false) => {
    if (busyRef.current && !force) return
    busyRef.current = true
    try {
      const res = await api.state(force ? null : versionRef.current)
      setOnline(true)
      if (res.changed) {
        versionRef.current = res.version
        setData(res)
        go('app')
      }
    } catch (err) {
      if (err.status === 401) return // lo maneja el aviso de sesión cerrada
      if (phaseRef.current === 'loading') go('login')
      setOnline(false)
    } finally {
      busyRef.current = false
    }
  }, [])

  // Si el servidor dice que la sesión ya no sirve, volvemos a la entrada.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      const wasIn = phaseRef.current === 'app'
      versionRef.current = null
      setData(null)
      setSheet(null)
      setNotice(wasIn ? LOST_NOTICE : '')
      go('login')
    })
  }, [])

  useEffect(() => {
    refresh(true)
  }, [refresh])

  // "Tiempo real": consulta cada pocos segundos mientras la pantalla está visible.
  useEffect(() => {
    if (phase !== 'app') return
    const tick = () => document.visibilityState === 'visible' && refresh()
    const id = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('online', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('online', tick)
    }
  }, [phase, refresh])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(id)
  }, [toast])

  const changeDisplay = (v) => {
    setDisplay(v)
    localStorage.setItem('fx_display', v)
  }

  const rates = data?.rates ?? { cop: null, ves: null }
  const movements = data?.movements ?? []

  const inMonth = useMemo(
    () => (month === 'all' ? movements : movements.filter((m) => m.date.startsWith(month))),
    [movements, month],
  )
  const summary = useMemo(() => summarize(inMonth, rates, display), [inMonth, rates, display])
  const visible = useMemo(
    () => (filter === 'todos' ? inMonth : inMonth.filter((m) => m.type === filter)),
    [inMonth, filter],
  )

  async function afterSave(message) {
    setSheet(null)
    setToast(message)
    await refresh(true)
  }

  async function logout() {
    try {
      await api.logout()
    } catch {
      /* igual salimos */
    }
    versionRef.current = null
    setData(null)
    setNotice('')
    go('login')
  }

  if (phase === 'loading') {
    return (
      <div className="splash" aria-label="Cargando">
        <div className="logo-coin spin">
          <IoCash aria-hidden />
        </div>
      </div>
    )
  }

  if (phase === 'login') {
    return (
      <Login
        notice={notice}
        onDone={async () => {
          setNotice('')
          await refresh(true)
        }}
      />
    )
  }

  const isTreasurer = data.user.role === 'tesorero'
  const title = month === 'all' ? 'Todo' : monthLabel(month).split(' ')[0]
  const isCurrent = month === currentMonth()

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-coin">
            <IoCash aria-hidden />
          </span>
          <div>
            <strong>Finanzas Xpress</strong>
            <span className={`live ${online ? '' : 'off'}`}>
              {online ? (
                <>
                  <i /> En vivo
                </>
              ) : (
                <>
                  <IoCloudOffline aria-hidden /> Sin conexión
                </>
              )}
            </span>
          </div>
        </div>
        <div className="who">
          <span className="role">
            {isTreasurer ? <IoWallet aria-hidden /> : <IoShieldCheckmark aria-hidden />}
            {isTreasurer ? 'Tesorero' : 'Supervisor'}
          </span>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Salir">
            <IoLogOutOutline />
          </button>
        </div>
      </header>

      <main className="content">
        <nav className="months" aria-label="Mes">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonth((m) => shiftMonth(m === 'all' ? currentMonth() : m, -1))}
            aria-label="Mes anterior"
          >
            <IoChevronBack />
          </button>
          <strong>{month === 'all' ? 'Todo el tiempo' : monthLabel(month)}</strong>
          <button
            type="button"
            className="icon-btn"
            disabled={month === 'all' || isCurrent}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Mes siguiente"
          >
            <IoChevronForward />
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => setMonth((m) => (m === 'all' ? currentMonth() : 'all'))}
          >
            {month === 'all' ? 'Por mes' : 'Ver todo'}
          </button>
        </nav>

        <Hero summary={summary} display={display} onDisplay={changeDisplay} title={title} />

        <Rates rates={rates} canEdit={isTreasurer} onEdit={() => setSheet({ type: 'rates' })} />

        <MovementList
          items={visible}
          display={display}
          rates={rates}
          canEdit={isTreasurer}
          onOpen={(movement) => setSheet({ type: 'movement', movement })}
          filter={filter}
          onFilter={setFilter}
          empty={
            isTreasurer
              ? 'Aún no hay movimientos aquí. Toca “Agregar”.'
              : 'Aún no hay movimientos en este período.'
          }
        />
      </main>

      {isTreasurer && <AddButton onClick={() => setSheet({ type: 'movement' })} />}

      {sheet?.type === 'movement' && (
        <MovementSheet movement={sheet.movement} onClose={() => setSheet(null)} onSaved={afterSave} />
      )}
      {sheet?.type === 'rates' && (
        <RatesSheet rates={rates} onClose={() => setSheet(null)} onSaved={afterSave} />
      )}

      {toast && (
        <div className="toast" role="status">
          <IoCheckmarkCircle aria-hidden /> {toast}
        </div>
      )}
    </div>
  )
}
