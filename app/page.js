'use client'

import { useEffect, useMemo, useState } from 'react'

const modules = [
  { name:'Café',icon:'☕',detail:'Cosecha, peones, pagos y aplicaciones.' },
  { name:'Ganado',icon:'🐄',detail:'Animales, lotes, tratamientos y control sanitario.' },
  { name:'Inventario Café',icon:'📦',detail:'Fertilizantes, abonos, agroquímicos y herramientas.' },
  { name:'Inventario Ganado',icon:'💉',detail:'Medicamentos, vacunas, alimentos y materiales.' },
  { name:'Gastos',icon:'₡',detail:'Registro y consulta de gastos por finca y actividad.' },
  { name:'Reportes',icon:'📊',detail:'Resumen semanal, mensual y anual.' },
  { name:'Fincas',icon:'🌿',detail:'Administración de las fincas registradas.' },
  { name:'Usuarios',icon:'👥',detail:'Administradores y usuarios de consulta.',adminOnly:true },
]

export default function Home(){
  const [loading,setLoading]=useState(true)
  const [user,setUser]=useState(null)
  const [farms,setFarms]=useState([])
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [authError,setAuthError]=useState('')
  const [authMessage,setAuthMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [activeModule,setActiveModule]=useState('Inicio')
  const [farmName,setFarmName]=useState('')
  const [editingFarm,setEditingFarm]=useState(null)
  const [farmError,setFarmError]=useState('')
  const [farmMessage,setFarmMessage]=useState('')
  const [farmBusy,setFarmBusy]=useState(false)

  const isAdmin=user?.role==='admin'
  const visibleModules=useMemo(()=>modules.filter(x=>!x.adminOnly||isAdmin),[isAdmin])
  const activeFarms=useMemo(()=>farms.filter(f=>f.active),[farms])

  useEffect(()=>{ init() },[])

  async function init(){
    try{
      const res=await fetch('/api/auth/session',{cache:'no-store'})
      const data=await res.json()
      if(data.user){
        setUser(data.user)
        await loadFarms()
      }
    }catch{
      setAuthError('No se pudo comprobar la sesión.')
    }finally{
      setLoading(false)
    }
  }

  async function loadFarms(){
    const res=await fetch('/api/farms',{cache:'no-store'})
    if(!res.ok){ setFarms([]); return }
    const data=await res.json()
    setFarms(data.farms||[])
  }

  async function login(e){
    e.preventDefault()
    setBusy(true)
    setAuthError('')
    setAuthMessage('')
    try{
      const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
      const data=await res.json()
      if(!res.ok){ setAuthError(data.error||'No se pudo iniciar sesión.'); return }
      setUser(data.user)
      setPassword('')
      await loadFarms()
    }catch{
      setAuthError('No se pudo conectar con el servidor.')
    }finally{
      setBusy(false)
    }
  }

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'})
    setUser(null)
    setFarms([])
    setActiveModule('Inicio')
    setAuthMessage('Sesión cerrada correctamente.')
  }

  async function saveFarm(e){
    e.preventDefault()
    if(!isAdmin) return
    setFarmBusy(true)
    setFarmError('')
    setFarmMessage('')
    try{
      const method=editingFarm?'PATCH':'POST'
      const payload=editingFarm?{id:editingFarm.id,name:farmName,active:editingFarm.active}:{name:farmName}
      const res=await fetch('/api/farms',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      const data=await res.json()
      if(!res.ok){ setFarmError(data.error||'No se pudo guardar la finca.'); return }
      setFarmName('')
      setEditingFarm(null)
      setFarmMessage(editingFarm?'Finca actualizada correctamente.':'Finca creada correctamente.')
      await loadFarms()
    }catch{
      setFarmError('No se pudo conectar con el servidor.')
    }finally{
      setFarmBusy(false)
    }
  }

  async function toggleFarm(farm){
    if(!isAdmin) return
    setFarmBusy(true)
    setFarmError('')
    setFarmMessage('')
    try{
      const res=await fetch('/api/farms',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:farm.id,name:farm.name,active:!farm.active})})
      const data=await res.json()
      if(!res.ok){ setFarmError(data.error||'No se pudo actualizar la finca.'); return }
      setFarmMessage(data.farm.active?'Finca activada correctamente.':'Finca desactivada correctamente.')
      await loadFarms()
    }catch{
      setFarmError('No se pudo conectar con el servidor.')
    }finally{
      setFarmBusy(false)
    }
  }

  function startEditFarm(farm){
    setEditingFarm(farm)
    setFarmName(farm.name)
    setFarmError('')
    setFarmMessage('')
  }

  function cancelEditFarm(){
    setEditingFarm(null)
    setFarmName('')
    setFarmError('')
  }

  if(loading) return <div className="loading-screen">Cargando Ganadera San Ramón…</div>

  if(!user) return <main className="login-page">
    <section className="brand-panel"><div><p className="eyebrow light">Sistema de gestión agropecuaria</p><h1>Ganadera<br/>San Ramón</h1><p>Administración separada de café y ganado, con inventarios, gastos y reportes por finca.</p></div><div className="brand-footer">Gestión clara · Datos protegidos · Acceso por usuario</div></section>
    <section className="login-panel"><form className="login-card" onSubmit={login}><span className="logo-mark">GSR</span><h2>Iniciar sesión</h2><p className="muted">Ingrese con su correo y contraseña.</p><label>Correo electrónico</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com" required/><label>Contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" minLength={8} required/>{authError&&<div className="error-box">{authError}</div>}{authMessage&&<div className="success-box">{authMessage}</div>}<button className="primary-button" disabled={busy}>{busy?'Ingresando…':'Ingresar'}</button><p className="login-note">Acceso protegido mediante Neon PostgreSQL y sesión segura.</p></form></section>
  </main>

  return <div className="app-shell">
    <aside className="sidebar"><div><div className="sidebar-brand"><span>GSR</span><strong>Ganadera<br/>San Ramón</strong></div><nav><button className={`nav-item ${activeModule==='Inicio'?'active':''}`} onClick={()=>setActiveModule('Inicio')}>⌂ <span>Inicio</span></button>{visibleModules.map(item=><button className={`nav-item ${activeModule===item.name?'active':''}`} key={item.name} onClick={()=>setActiveModule(item.name)}>{item.icon} <span>{item.name}</span></button>)}</nav></div><button className="logout" onClick={logout}>Cerrar sesión</button></aside>
    <main className="dashboard">
      <header className="topbar"><div><p className="eyebrow">{activeModule==='Inicio'?'Panel principal':`Módulo ${activeModule}`}</p><h1>{activeModule==='Inicio'?`Bienvenido${user?.full_name?`, ${user.full_name}`:''}`:activeModule}</h1></div><div className="user-badge"><span className={`role ${isAdmin?'admin':'viewer'}`}>{isAdmin?'Administrador':'Consulta'}</span><small>{user.email}</small></div></header>

      {activeModule==='Inicio'?<>
        <section className="summary-grid"><article className="summary-card"><span>Fincas activas</span><strong>{activeFarms.length}</strong></article><article className="summary-card"><span>Área Café</span><strong>Activa</strong></article><article className="summary-card"><span>Área Ganado</span><strong>Activa</strong></article><article className="summary-card"><span>Acceso</span><strong>{isAdmin?'Completo':'Lectura'}</strong></article></section>
        <section className="section-heading"><div><h2>Módulos</h2><p>Seleccione el área que desea gestionar o consultar.</p></div></section>
        <section className="module-grid">{visibleModules.map(item=><article className="module-card" key={item.name}><div className="module-icon">{item.icon}</div><h3>{item.name}</h3><p>{item.detail}</p><button onClick={()=>setActiveModule(item.name)}>Entrar →</button></article>)}</section>
        <section className="farm-section"><div className="section-heading"><div><h2>Fincas registradas</h2><p>Fincas activas disponibles.</p></div></div>{activeFarms.length?<div className="farm-list">{activeFarms.map(f=><span key={f.id}>{f.name}</span>)}</div>:<p className="muted">Aún no hay fincas registradas.</p>}</section>
      </>:activeModule==='Fincas'?<section className="farms-module">
        <div className="farms-toolbar"><div><h2>Administración de fincas</h2><p className="muted">Las fincas son la base para café, ganado, inventarios, gastos y reportes.</p></div><div className="farm-count"><strong>{activeFarms.length}</strong><span>activas</span></div></div>

        {isAdmin&&<form className="farm-form" onSubmit={saveFarm}><div><label>{editingFarm?'Editar nombre':'Nueva finca'}</label><input value={farmName} onChange={e=>setFarmName(e.target.value)} placeholder="Ej. Finca San Ramón" required/></div><button className="primary-action" disabled={farmBusy}>{farmBusy?'Guardando…':editingFarm?'Guardar cambios':'Agregar finca'}</button>{editingFarm&&<button type="button" className="secondary-action" onClick={cancelEditFarm}>Cancelar</button>}</form>}

        {farmError&&<div className="error-box">{farmError}</div>}
        {farmMessage&&<div className="success-box">{farmMessage}</div>}

        <div className="farms-table-wrap">
          <table className="farms-table">
            <thead><tr><th>Finca</th><th>Estado</th><th>Creada</th>{isAdmin&&<th>Acciones</th>}</tr></thead>
            <tbody>{farms.length?farms.map(f=><tr key={f.id}><td><strong>{f.name}</strong></td><td><span className={`status-pill ${f.active?'active':'inactive'}`}>{f.active?'Activa':'Inactiva'}</span></td><td>{f.created_at?new Date(f.created_at).toLocaleDateString('es-CR'):'—'}</td>{isAdmin&&<td className="farm-actions"><button onClick={()=>startEditFarm(f)}>Editar</button><button onClick={()=>toggleFarm(f)} disabled={farmBusy}>{f.active?'Desactivar':'Activar'}</button></td>}</tr>):<tr><td colSpan={isAdmin?4:3} className="empty-cell">Aún no hay fincas registradas.</td></tr>}</tbody>
          </table>
        </div>
        {!isAdmin&&<p className="viewer-note">Su cuenta es de consulta. Puede ver las fincas, pero no modificarlas.</p>}
      </section>:<section className="placeholder-panel"><h2>{activeModule}</h2><p>Este módulo ya utiliza la nueva autenticación con Neon. Continuaremos conectando sus formularios y reportes.</p></section>}
    </main>
  </div>
}
