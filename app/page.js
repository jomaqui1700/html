'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const modules = [
  { name: 'Café', icon: '☕', detail: 'Cosecha, peones, fertilización y aplicaciones.' },
  { name: 'Ganado', icon: '🐄', detail: 'Animales, tratamientos y control sanitario.' },
  { name: 'Inventario Café', icon: '📦', detail: 'Fertilizantes, abonos, agroquímicos y herramientas.' },
  { name: 'Inventario Ganado', icon: '💉', detail: 'Medicamentos, vacunas, alimentos y materiales.' },
  { name: 'Gastos', icon: '₡', detail: 'Registro y consulta de gastos por finca y actividad.' },
  { name: 'Reportes', icon: '📊', detail: 'Resumen semanal, mensual y anual.' },
  { name: 'Fincas', icon: '🌿', detail: 'Administración de las fincas registradas.' },
  { name: 'Usuarios', icon: '👥', detail: 'Administradores y usuarios de consulta.', adminOnly: true },
]

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [farms, setFarms] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  const isAdmin = profile?.role === 'admin'

  const visibleModules = useMemo(
    () => modules.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  )

  useEffect(() => {
    let mounted = true

    async function initialize() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      if (data.session) await loadUserData(data.session.user.id)
      setLoading(false)
    }

    initialize()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      if (nextSession) {
        await loadUserData(nextSession.user.id)
      } else {
        setProfile(null)
        setFarms([])
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function loadUserData(userId) {
    const [{ data: profileData }, { data: farmData }] = await Promise.all([
      supabase.from('profiles').select('full_name,role').eq('user_id', userId).single(),
      supabase.from('farms').select('id,name,active').eq('active', true).order('name'),
    ])

    setProfile(profileData || { full_name: '', role: 'viewer' })
    setFarms(farmData || [])
  }

  async function handleLogin(event) {
    event.preventDefault()
    setSigningIn(true)
    setAuthError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError('Correo o contraseña incorrectos.')
      setSigningIn(false)
      return
    }

    setPassword('')
    setSigningIn(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="loading-screen">Cargando Ganadera San Ramón…</div>
  }

  if (!session) {
    return (
      <main className="login-page">
        <section className="brand-panel">
          <div>
            <p className="eyebrow light">Sistema de gestión agropecuaria</p>
            <h1>Ganadera<br />San Ramón</h1>
            <p>Administración separada de café y ganado, con inventarios, gastos y reportes por finca.</p>
          </div>
          <div className="brand-footer">Gestión clara · Datos protegidos · Acceso por usuario</div>
        </section>

        <section className="login-panel">
          <form className="login-card" onSubmit={handleLogin}>
            <span className="logo-mark">GSR</span>
            <h2>Iniciar sesión</h2>
            <p className="muted">Ingrese con su correo y contraseña.</p>

            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              required
            />

            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            {authError && <div className="error-box">{authError}</div>}

            <button className="primary-button" type="submit" disabled={signingIn}>
              {signingIn ? 'Ingresando…' : 'Ingresar'}
            </button>
            <p className="login-note">Los permisos dependen del rol asignado: Administrador o Consulta.</p>
          </form>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand"><span>GSR</span><strong>Ganadera<br />San Ramón</strong></div>
          <nav>
            <button className="nav-item active">⌂ <span>Inicio</span></button>
            {visibleModules.map((item) => (
              <button className="nav-item" key={item.name}>{item.icon} <span>{item.name}</span></button>
            ))}
          </nav>
        </div>
        <button className="logout" onClick={handleLogout}>Cerrar sesión</button>
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">Panel principal</p>
            <h1>Bienvenido{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
          </div>
          <div className="user-badge">
            <span className={`role ${isAdmin ? 'admin' : 'viewer'}`}>{isAdmin ? 'Administrador' : 'Consulta'}</span>
            <small>{session.user.email}</small>
          </div>
        </header>

        <section className="summary-grid">
          <article className="summary-card"><span>Fincas activas</span><strong>{farms.length}</strong></article>
          <article className="summary-card"><span>Área Café</span><strong>Activa</strong></article>
          <article className="summary-card"><span>Área Ganado</span><strong>Activa</strong></article>
          <article className="summary-card"><span>Acceso</span><strong>{isAdmin ? 'Completo' : 'Lectura'}</strong></article>
        </section>

        <section className="section-heading">
          <div><h2>Módulos</h2><p>Seleccione el área que desea gestionar o consultar.</p></div>
        </section>

        <section className="module-grid">
          {visibleModules.map((item) => (
            <article className="module-card" key={item.name}>
              <div className="module-icon">{item.icon}</div>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
              <button>Entrar →</button>
            </article>
          ))}
        </section>

        <section className="farm-section">
          <div className="section-heading"><div><h2>Fincas registradas</h2><p>Fincas activas disponibles para los distintos módulos.</p></div></div>
          {farms.length ? (
            <div className="farm-list">{farms.map((farm) => <span key={farm.id}>{farm.name}</span>)}</div>
          ) : (
            <p className="muted">No hay fincas visibles para este usuario.</p>
          )}
        </section>
      </main>
    </div>
  )
}
