'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const APP_URL = 'https://ganadera-san-ramon-app.vercel.app'

const modules = [
  { name: 'Café', icon: '☕', detail: 'Cosecha, peones, pagos y aplicaciones.' },
  { name: 'Ganado', icon: '🐄', detail: 'Animales, tratamientos y control sanitario.' },
  { name: 'Inventario Café', icon: '📦', detail: 'Fertilizantes, abonos, agroquímicos y herramientas.' },
  { name: 'Inventario Ganado', icon: '💉', detail: 'Medicamentos, vacunas, alimentos y materiales.' },
  { name: 'Gastos', icon: '₡', detail: 'Registro y consulta de gastos por finca y actividad.' },
  { name: 'Reportes', icon: '📊', detail: 'Resumen semanal, mensual y anual.' },
  { name: 'Fincas', icon: '🌿', detail: 'Administración de las fincas registradas.' },
  { name: 'Usuarios', icon: '👥', detail: 'Administradores y usuarios de consulta.', adminOnly: true },
]

export default function Home() {
  const [loading,setLoading]=useState(true),[session,setSession]=useState(null),[profile,setProfile]=useState(null),[farms,setFarms]=useState([])
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[fullName,setFullName]=useState(''),[authError,setAuthError]=useState(''),[authMessage,setAuthMessage]=useState(''),[busy,setBusy]=useState(false)
  const [hasAdmin,setHasAdmin]=useState(true),[mode,setMode]=useState('login'),[activeModule,setActiveModule]=useState('Inicio')
  const isAdmin=profile?.role==='admin'
  const visibleModules=useMemo(()=>modules.filter(x=>!x.adminOnly||isAdmin),[isAdmin])

  useEffect(()=>{let mounted=true; async function init(){const {data:adminData}=await supabase.rpc('has_admin'); if(mounted){setHasAdmin(Boolean(adminData)); if(!adminData)setMode('register')} const {data}=await supabase.auth.getSession(); if(!mounted)return; setSession(data.session); if(data.session)await completeAdminAndLoad(data.session.user.id); setLoading(false)} init(); const {data:l}=supabase.auth.onAuthStateChange(async(_e,s)=>{if(!mounted)return;setSession(s);if(s)await completeAdminAndLoad(s.user.id);else{setProfile(null);setFarms([]);setActiveModule('Inicio')}setLoading(false)});return()=>{mounted=false;l.subscription.unsubscribe()}},[])

  async function completeAdminAndLoad(uid){
    const {data:p}=await supabase.from('profiles').select('full_name,role').eq('user_id',uid).maybeSingle()
    if(!p){
      const {data:adminExists}=await supabase.rpc('has_admin')
      if(!adminExists){
        const name=session?.user?.user_metadata?.full_name || fullName || 'Administrador'
        await supabase.rpc('bootstrap_admin',{p_full_name:name})
      }
    }
    await loadUserData(uid)
  }

  async function loadUserData(uid){const [{data:p},{data:f}]=await Promise.all([supabase.from('profiles').select('full_name,role').eq('user_id',uid).maybeSingle(),supabase.from('farms').select('id,name,active').eq('active',true).order('name')]);setProfile(p||{full_name:'',role:'viewer'});setFarms(f||[])}

  async function login(e){e.preventDefault();setBusy(true);setAuthError('');setAuthMessage('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setAuthError(error.message==='Email not confirmed'?'El correo todavía no ha sido confirmado. Use el botón para reenviar la confirmación.':'Correo o contraseña incorrectos.');else setPassword('');setBusy(false)}

  async function register(e){
    e.preventDefault();setBusy(true);setAuthError('');setAuthMessage('')
    const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:APP_URL,data:{full_name:fullName}}})
    if(error){setAuthError(error.message);setBusy(false);return}
    if(data.session){
      const {error:rpcError}=await supabase.rpc('bootstrap_admin',{p_full_name:fullName})
      if(rpcError){setAuthError(rpcError.message);setBusy(false);return}
      setHasAdmin(true);await loadUserData(data.session.user.id);setPassword('');setBusy(false);return
    }
    setAuthMessage('Cuenta creada. Revise su correo y pulse el enlace de confirmación. Si no llega, use “Reenviar correo de confirmación”.')
    setBusy(false)
  }

  async function resendConfirmation(){
    if(!email){setAuthError('Escriba primero el correo que utilizó para registrarse.');return}
    setBusy(true);setAuthError('');setAuthMessage('')
    const {error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:APP_URL}})
    if(error)setAuthError(`No se pudo reenviar: ${error.message}`)
    else setAuthMessage('Correo de confirmación reenviado. Revise Recibidos, Spam y Promociones. Puede tardar unos minutos.')
    setBusy(false)
  }

  async function logout(){await supabase.auth.signOut()}

  if(loading)return <div className="loading-screen">Cargando Ganadera San Ramón…</div>
  if(!session)return <main className="login-page"><section className="brand-panel"><div><p className="eyebrow light">Sistema de gestión agropecuaria</p><h1>Ganadera<br/>San Ramón</h1><p>Administración separada de café y ganado, con inventarios, gastos y reportes por finca.</p></div><div className="brand-footer">Gestión clara · Datos protegidos · Acceso por usuario</div></section><section className="login-panel"><form className="login-card" onSubmit={mode==='register'?register:login}><span className="logo-mark">GSR</span><h2>{mode==='register'?'Crear administrador inicial':'Iniciar sesión'}</h2><p className="muted">{mode==='register'?'Esta opción estará disponible solamente mientras no exista un administrador.':'Ingrese con su correo y contraseña.'}</p>{mode==='register'&&<><label>Nombre completo</label><input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nombre del administrador" required/></>}<label>Correo electrónico</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com" required/><label>Contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" minLength={6} required/>{authError&&<div className="error-box">{authError}</div>}{authMessage&&<div className="success-box">{authMessage}</div>}<button className="primary-button" disabled={busy}>{busy?'Procesando…':mode==='register'?'Crear administrador':'Ingresar'}</button><button type="button" className="text-button" onClick={resendConfirmation} disabled={busy}>Reenviar correo de confirmación</button>{hasAdmin&&<button type="button" className="text-button" onClick={()=>{setMode(mode==='login'?'register':'login');setAuthError('');setAuthMessage('')}}>{mode==='login'?'Configurar administrador inicial':'Volver a iniciar sesión'}</button>}<p className="login-note">Al confirmar el correo, regresará a Ganadera San Ramón. La contraseña se gestiona directamente por Supabase.</p></form></section></main>

  return <div className="app-shell"><aside className="sidebar"><div><div className="sidebar-brand"><span>GSR</span><strong>Ganadera<br/>San Ramón</strong></div><nav><button className={`nav-item ${activeModule==='Inicio'?'active':''}`} onClick={()=>setActiveModule('Inicio')}>⌂ <span>Inicio</span></button>{visibleModules.map(item=><button className={`nav-item ${activeModule===item.name?'active':''}`} key={item.name} onClick={()=>setActiveModule(item.name)}>{item.icon} <span>{item.name}</span></button>)}</nav></div><button className="logout" onClick={logout}>Cerrar sesión</button></aside><main className="dashboard"><header className="topbar"><div><p className="eyebrow">{activeModule==='Inicio'?'Panel principal':`Módulo ${activeModule}`}</p><h1>{activeModule==='Inicio'?`Bienvenido${profile?.full_name?`, ${profile.full_name}`:''}`:activeModule}</h1></div><div className="user-badge"><span className={`role ${isAdmin?'admin':'viewer'}`}>{isAdmin?'Administrador':'Consulta'}</span><small>{session.user.email}</small></div></header>{activeModule==='Inicio'?<><section className="summary-grid"><article className="summary-card"><span>Fincas activas</span><strong>{farms.length}</strong></article><article className="summary-card"><span>Área Café</span><strong>Activa</strong></article><article className="summary-card"><span>Área Ganado</span><strong>Activa</strong></article><article className="summary-card"><span>Acceso</span><strong>{isAdmin?'Completo':'Lectura'}</strong></article></section><section className="section-heading"><div><h2>Módulos</h2><p>Seleccione el área que desea gestionar o consultar.</p></div></section><section className="module-grid">{visibleModules.map(item=><article className="module-card" key={item.name}><div className="module-icon">{item.icon}</div><h3>{item.name}</h3><p>{item.detail}</p><button onClick={()=>setActiveModule(item.name)}>Entrar →</button></article>)}</section><section className="farm-section"><div className="section-heading"><div><h2>Fincas registradas</h2><p>Fincas activas disponibles.</p></div></div>{farms.length?<div className="farm-list">{farms.map(f=><span key={f.id}>{f.name}</span>)}</div>:<p className="muted">Aún no hay fincas registradas.</p>}</section></>:<section className="placeholder-panel"><h2>{activeModule}</h2><p>El acceso ya está protegido. Continuaremos conectando este módulo con la base de datos.</p></section>}</main></div>
}
