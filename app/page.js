'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

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

const today = new Date().toISOString().slice(0, 10)
const emptyWorker = { farm_id: '', full_name: '', identification: '', phone: '', hourly_rate: '' }
const emptyHarvest = { harvest_date: today, week_number: '', farm_id: '', worker_id: '', quantity: '', unit: 'Cajuela', rate_per_unit: '', notes: '' }
const emptyPayment = { worker_id: '', farm_id: '', week_number: '', week_start: '', week_end: '', monday_hours: '0', tuesday_hours: '0', wednesday_hours: '0', thursday_hours: '0', friday_hours: '0', saturday_hours: '0', sunday_hours: '0', hourly_rate: '', advances: '0', deductions: '0', notes: '' }
const emptyApplication = { application_date: today, farm_id: '', activity_type: 'Fertilización', method: 'Dron', product: '', dose: '', dose_unit: 'L', area: '', area_unit: 'hectáreas', applied_by: '', notes: '' }

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [farms, setFarms] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [activeModule, setActiveModule] = useState('Inicio')
  const [coffeeTab, setCoffeeTab] = useState('Cosecha')
  const [workers, setWorkers] = useState([])
  const [harvest, setHarvest] = useState([])
  const [payments, setPayments] = useState([])
  const [applications, setApplications] = useState([])
  const [workerForm, setWorkerForm] = useState(emptyWorker)
  const [harvestForm, setHarvestForm] = useState(emptyHarvest)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [applicationForm, setApplicationForm] = useState(emptyApplication)
  const [coffeeMessage, setCoffeeMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const visibleModules = useMemo(() => modules.filter((item) => !item.adminOnly || isAdmin), [isAdmin])
  const farmName = (id) => farms.find((f) => String(f.id) === String(id))?.name || '—'
  const workerName = (id) => workers.find((w) => String(w.id) === String(id))?.full_name || '—'

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
      if (nextSession) await loadUserData(nextSession.user.id)
      else { setProfile(null); setFarms([]); setActiveModule('Inicio') }
      setLoading(false)
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (session && activeModule === 'Café') loadCoffeeData()
  }, [activeModule, session])

  async function loadUserData(userId) {
    const [{ data: profileData }, { data: farmData }] = await Promise.all([
      supabase.from('profiles').select('full_name,role').eq('user_id', userId).single(),
      supabase.from('farms').select('id,name,active').eq('active', true).order('name'),
    ])
    setProfile(profileData || { full_name: '', role: 'viewer' })
    setFarms(farmData || [])
  }

  async function loadCoffeeData() {
    const [{ data: w }, { data: h }, { data: p }, { data: a }] = await Promise.all([
      supabase.from('workers').select('*').eq('active', true).order('full_name'),
      supabase.from('coffee_harvest').select('*').order('harvest_date', { ascending: false }).limit(100),
      supabase.from('worker_weeks').select('*').order('week_start', { ascending: false }).limit(100),
      supabase.from('farm_applications').select('*').order('application_date', { ascending: false }).limit(100),
    ])
    setWorkers(w || [])
    setHarvest(h || [])
    setPayments(p || [])
    setApplications(a || [])
  }

  async function handleLogin(event) {
    event.preventDefault(); setSigningIn(true); setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError('Correo o contraseña incorrectos.')
    else setPassword('')
    setSigningIn(false)
  }

  async function handleLogout() { await supabase.auth.signOut() }

  async function saveWorker(e) {
    e.preventDefault(); if (!isAdmin) return
    setSaving(true); setCoffeeMessage('')
    const { error } = await supabase.from('workers').insert({ ...workerForm, farm_id: Number(workerForm.farm_id), hourly_rate: Number(workerForm.hourly_rate || 0), created_by: session.user.id })
    setSaving(false)
    if (error) return setCoffeeMessage(`Error: ${error.message}`)
    setWorkerForm(emptyWorker); setCoffeeMessage('Peón registrado correctamente.'); await loadCoffeeData()
  }

  async function saveHarvest(e) {
    e.preventDefault(); if (!isAdmin) return
    setSaving(true); setCoffeeMessage('')
    const payload = { ...harvestForm, farm_id: Number(harvestForm.farm_id), worker_id: Number(harvestForm.worker_id), week_number: Number(harvestForm.week_number), quantity: Number(harvestForm.quantity), rate_per_unit: Number(harvestForm.rate_per_unit), created_by: session.user.id }
    const { error } = await supabase.from('coffee_harvest').insert(payload)
    setSaving(false)
    if (error) return setCoffeeMessage(`Error: ${error.message}`)
    setHarvestForm(emptyHarvest); setCoffeeMessage('Cosecha registrada correctamente.'); await loadCoffeeData()
  }

  async function savePayment(e) {
    e.preventDefault(); if (!isAdmin) return
    setSaving(true); setCoffeeMessage('')
    const numeric = ['monday_hours','tuesday_hours','wednesday_hours','thursday_hours','friday_hours','saturday_hours','sunday_hours','hourly_rate','advances','deductions']
    const payload = { ...paymentForm, worker_id: Number(paymentForm.worker_id), farm_id: Number(paymentForm.farm_id), week_number: Number(paymentForm.week_number), created_by: session.user.id }
    numeric.forEach(k => payload[k] = Number(payload[k] || 0))
    const { error } = await supabase.from('worker_weeks').insert(payload)
    setSaving(false)
    if (error) return setCoffeeMessage(`Error: ${error.message}`)
    setPaymentForm(emptyPayment); setCoffeeMessage('Semana de trabajo registrada correctamente.'); await loadCoffeeData()
  }

  async function saveApplication(e) {
    e.preventDefault(); if (!isAdmin) return
    setSaving(true); setCoffeeMessage('')
    const payload = { ...applicationForm, farm_id: Number(applicationForm.farm_id), dose: applicationForm.dose ? Number(applicationForm.dose) : null, area: applicationForm.area ? Number(applicationForm.area) : null, created_by: session.user.id }
    const { error } = await supabase.from('farm_applications').insert(payload)
    setSaving(false)
    if (error) return setCoffeeMessage(`Error: ${error.message}`)
    setApplicationForm(emptyApplication); setCoffeeMessage('Aplicación registrada correctamente.'); await loadCoffeeData()
  }

  if (loading) return <div className="loading-screen">Cargando Ganadera San Ramón…</div>

  if (!session) return (
    <main className="login-page">
      <section className="brand-panel"><div><p className="eyebrow light">Sistema de gestión agropecuaria</p><h1>Ganadera<br />San Ramón</h1><p>Administración separada de café y ganado, con inventarios, gastos y reportes por finca.</p></div><div className="brand-footer">Gestión clara · Datos protegidos · Acceso por usuario</div></section>
      <section className="login-panel"><form className="login-card" onSubmit={handleLogin}><span className="logo-mark">GSR</span><h2>Iniciar sesión</h2><p className="muted">Ingrese con su correo y contraseña.</p><label>Correo electrónico</label><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="correo@ejemplo.com" autoComplete="email" required/><label>Contraseña</label><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required/>{authError && <div className="error-box">{authError}</div>}<button className="primary-button" type="submit" disabled={signingIn}>{signingIn?'Ingresando…':'Ingresar'}</button><p className="login-note">Los permisos dependen del rol asignado: Administrador o Consulta.</p></form></section>
    </main>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div><div className="sidebar-brand"><span>GSR</span><strong>Ganadera<br/>San Ramón</strong></div><nav><button className={`nav-item ${activeModule==='Inicio'?'active':''}`} onClick={()=>setActiveModule('Inicio')}>⌂ <span>Inicio</span></button>{visibleModules.map(item=><button className={`nav-item ${activeModule===item.name?'active':''}`} key={item.name} onClick={()=>setActiveModule(item.name)}>{item.icon} <span>{item.name}</span></button>)}</nav></div>
        <button className="logout" onClick={handleLogout}>Cerrar sesión</button>
      </aside>

      <main className="dashboard">
        <header className="topbar"><div><p className="eyebrow">{activeModule==='Inicio'?'Panel principal':`Módulo ${activeModule}`}</p><h1>{activeModule==='Inicio'?`Bienvenido${profile?.full_name?`, ${profile.full_name}`:''}`:activeModule}</h1></div><div className="user-badge"><span className={`role ${isAdmin?'admin':'viewer'}`}>{isAdmin?'Administrador':'Consulta'}</span><small>{session.user.email}</small></div></header>

        {activeModule === 'Inicio' && <Dashboard farms={farms} visibleModules={visibleModules} isAdmin={isAdmin} setActiveModule={setActiveModule}/>}        
        {activeModule === 'Café' && <CoffeeModule farms={farms} workers={workers} harvest={harvest} payments={payments} applications={applications} isAdmin={isAdmin} tab={coffeeTab} setTab={setCoffeeTab} workerForm={workerForm} setWorkerForm={setWorkerForm} harvestForm={harvestForm} setHarvestForm={setHarvestForm} paymentForm={paymentForm} setPaymentForm={setPaymentForm} applicationForm={applicationForm} setApplicationForm={setApplicationForm} saveWorker={saveWorker} saveHarvest={saveHarvest} savePayment={savePayment} saveApplication={saveApplication} saving={saving} message={coffeeMessage} farmName={farmName} workerName={workerName}/>}        
        {activeModule !== 'Inicio' && activeModule !== 'Café' && <section className="placeholder-panel"><h2>{activeModule}</h2><p>Este módulo será conectado en la siguiente etapa. Café ya funciona con la base de datos real.</p></section>}
      </main>
    </div>
  )
}

function Dashboard({ farms, visibleModules, isAdmin, setActiveModule }) {
  return <><section className="summary-grid"><article className="summary-card"><span>Fincas activas</span><strong>{farms.length}</strong></article><article className="summary-card"><span>Área Café</span><strong>Activa</strong></article><article className="summary-card"><span>Área Ganado</span><strong>Activa</strong></article><article className="summary-card"><span>Acceso</span><strong>{isAdmin?'Completo':'Lectura'}</strong></article></section><section className="section-heading"><div><h2>Módulos</h2><p>Seleccione el área que desea gestionar o consultar.</p></div></section><section className="module-grid">{visibleModules.map(item=><article className="module-card" key={item.name}><div className="module-icon">{item.icon}</div><h3>{item.name}</h3><p>{item.detail}</p><button onClick={()=>setActiveModule(item.name)}>Entrar →</button></article>)}</section><section className="farm-section"><div className="section-heading"><div><h2>Fincas registradas</h2><p>Fincas activas disponibles para los distintos módulos.</p></div></div>{farms.length?<div className="farm-list">{farms.map(f=><span key={f.id}>{f.name}</span>)}</div>:<p className="muted">No hay fincas visibles para este usuario.</p>}</section></>
}

function CoffeeModule(props) {
  const tabs = ['Cosecha','Peones','Pagos semanales','Aplicaciones']
  return <section className="coffee-module"><div className="coffee-tabs">{tabs.map(t=><button key={t} className={props.tab===t?'active':''} onClick={()=>props.setTab(t)}>{t}</button>)}</div>{props.message&&<div className="notice">{props.message}</div>}{props.tab==='Cosecha'&&<HarvestTab {...props}/>} {props.tab==='Peones'&&<WorkersTab {...props}/>} {props.tab==='Pagos semanales'&&<PaymentsTab {...props}/>} {props.tab==='Aplicaciones'&&<ApplicationsTab {...props}/>}</section>
}

function Field({label, children}) { return <label className="field"><span>{label}</span>{children}</label> }
function FarmSelect({farms, value, onChange, required=true}) { return <select value={value} onChange={onChange} required={required}><option value="">Seleccione finca</option>{farms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select> }
function WorkerSelect({workers, value, onChange}) { return <select value={value} onChange={onChange} required><option value="">Seleccione peón</option>{workers.map(w=><option key={w.id} value={w.id}>{w.full_name}</option>)}</select> }

function HarvestTab({farms,workers,harvest,isAdmin,harvestForm,setHarvestForm,saveHarvest,saving,farmName,workerName}) {
  const total = harvest.reduce((s,r)=>s+Number(r.quantity||0),0)
  return <div className="module-layout">{isAdmin&&<form className="data-card form-card" onSubmit={saveHarvest}><h2>Registrar cosecha diaria</h2><div className="form-grid"><Field label="Fecha"><input type="date" value={harvestForm.harvest_date} onChange={e=>setHarvestForm({...harvestForm,harvest_date:e.target.value})} required/></Field><Field label="Semana (1–27)"><input type="number" min="1" max="27" value={harvestForm.week_number} onChange={e=>setHarvestForm({...harvestForm,week_number:e.target.value})} required/></Field><Field label="Finca"><FarmSelect farms={farms} value={harvestForm.farm_id} onChange={e=>setHarvestForm({...harvestForm,farm_id:e.target.value})}/></Field><Field label="Peón"><WorkerSelect workers={workers} value={harvestForm.worker_id} onChange={e=>setHarvestForm({...harvestForm,worker_id:e.target.value})}/></Field><Field label="Cantidad"><input type="number" min="0" step="0.01" value={harvestForm.quantity} onChange={e=>setHarvestForm({...harvestForm,quantity:e.target.value})} required/></Field><Field label="Unidad"><select value={harvestForm.unit} onChange={e=>setHarvestForm({...harvestForm,unit:e.target.value})}><option>Cajuela</option><option>Kg</option><option>Litros</option></select></Field><Field label="Pago por unidad (₡)"><input type="number" min="0" step="0.01" value={harvestForm.rate_per_unit} onChange={e=>setHarvestForm({...harvestForm,rate_per_unit:e.target.value})} required/></Field><Field label="Notas"><input value={harvestForm.notes} onChange={e=>setHarvestForm({...harvestForm,notes:e.target.value})}/></Field></div><button className="primary-button compact" disabled={saving}>Guardar cosecha</button></form>}<div className="data-card"><div className="card-title-row"><div><h2>Últimos registros</h2><p>{harvest.length} registros · {total.toFixed(2)} unidades registradas</p></div></div><Table headers={['Fecha','Finca','Peón','Cantidad','Pago']} rows={harvest.map(r=>[r.harvest_date,farmName(r.farm_id),workerName(r.worker_id),`${r.quantity} ${r.unit}`,`₡${(Number(r.quantity)*Number(r.rate_per_unit)).toLocaleString('es-CR')}`])}/></div></div>
}

function WorkersTab({farms,workers,isAdmin,workerForm,setWorkerForm,saveWorker,saving,farmName}) {
  return <div className="module-layout">{isAdmin&&<form className="data-card form-card" onSubmit={saveWorker}><h2>Registrar peón</h2><div className="form-grid"><Field label="Nombre completo"><input value={workerForm.full_name} onChange={e=>setWorkerForm({...workerForm,full_name:e.target.value})} required/></Field><Field label="Finca"><FarmSelect farms={farms} value={workerForm.farm_id} onChange={e=>setWorkerForm({...workerForm,farm_id:e.target.value})}/></Field><Field label="Identificación"><input value={workerForm.identification} onChange={e=>setWorkerForm({...workerForm,identification:e.target.value})}/></Field><Field label="Teléfono"><input value={workerForm.phone} onChange={e=>setWorkerForm({...workerForm,phone:e.target.value})}/></Field><Field label="Tarifa por hora (₡)"><input type="number" min="0" step="0.01" value={workerForm.hourly_rate} onChange={e=>setWorkerForm({...workerForm,hourly_rate:e.target.value})} required/></Field></div><button className="primary-button compact" disabled={saving}>Guardar peón</button></form>}<div className="data-card"><h2>Peones activos</h2><Table headers={['Nombre','Finca','Identificación','Teléfono','Tarifa/h']} rows={workers.map(w=>[w.full_name,farmName(w.farm_id),w.identification||'—',w.phone||'—',`₡${Number(w.hourly_rate||0).toLocaleString('es-CR')}`])}/></div></div>
}

function PaymentsTab({farms,workers,payments,isAdmin,paymentForm,setPaymentForm,savePayment,saving,farmName,workerName}) {
  const days=['monday_hours','tuesday_hours','wednesday_hours','thursday_hours','friday_hours','saturday_hours','sunday_hours']
  const labels=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
  return <div className="module-layout">{isAdmin&&<form className="data-card form-card wide-form" onSubmit={savePayment}><h2>Registrar semana de trabajo</h2><div className="form-grid"><Field label="Peón"><WorkerSelect workers={workers} value={paymentForm.worker_id} onChange={e=>{const w=workers.find(x=>String(x.id)===e.target.value);setPaymentForm({...paymentForm,worker_id:e.target.value,farm_id:w?.farm_id||paymentForm.farm_id,hourly_rate:w?.hourly_rate||paymentForm.hourly_rate})}}/></Field><Field label="Finca"><FarmSelect farms={farms} value={paymentForm.farm_id} onChange={e=>setPaymentForm({...paymentForm,farm_id:e.target.value})}/></Field><Field label="Semana (1–27)"><input type="number" min="1" max="27" value={paymentForm.week_number} onChange={e=>setPaymentForm({...paymentForm,week_number:e.target.value})} required/></Field><Field label="Inicio de semana"><input type="date" value={paymentForm.week_start} onChange={e=>setPaymentForm({...paymentForm,week_start:e.target.value})} required/></Field><Field label="Fin de semana"><input type="date" value={paymentForm.week_end} onChange={e=>setPaymentForm({...paymentForm,week_end:e.target.value})} required/></Field><Field label="Tarifa por hora (₡)"><input type="number" min="0" step="0.01" value={paymentForm.hourly_rate} onChange={e=>setPaymentForm({...paymentForm,hourly_rate:e.target.value})} required/></Field></div><div className="hours-grid">{days.map((d,i)=><Field key={d} label={labels[i]}><input type="number" min="0" max="24" step="0.5" value={paymentForm[d]} onChange={e=>setPaymentForm({...paymentForm,[d]:e.target.value})}/></Field>)}</div><div className="form-grid"><Field label="Adelantos (₡)"><input type="number" min="0" value={paymentForm.advances} onChange={e=>setPaymentForm({...paymentForm,advances:e.target.value})}/></Field><Field label="Deducciones (₡)"><input type="number" min="0" value={paymentForm.deductions} onChange={e=>setPaymentForm({...paymentForm,deductions:e.target.value})}/></Field><Field label="Notas"><input value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm,notes:e.target.value})}/></Field></div><button className="primary-button compact" disabled={saving}>Guardar semana</button></form>}<div className="data-card"><h2>Pagos semanales</h2><Table headers={['Semana','Rango','Peón','Finca','Horas','Neto']} rows={payments.map(r=>{const hrs=days.reduce((s,d)=>s+Number(r[d]||0),0);const net=hrs*Number(r.hourly_rate||0)-Number(r.advances||0)-Number(r.deductions||0);return [`#${r.week_number}`,`${r.week_start} a ${r.week_end}`,workerName(r.worker_id),farmName(r.farm_id),hrs.toFixed(1),`₡${net.toLocaleString('es-CR')}`]})}/></div></div>
}

function ApplicationsTab({farms,applications,isAdmin,applicationForm,setApplicationForm,saveApplication,saving,farmName}) {
  return <div className="module-layout">{isAdmin&&<form className="data-card form-card" onSubmit={saveApplication}><h2>Registrar fertilización o abono</h2><div className="form-grid"><Field label="Fecha"><input type="date" value={applicationForm.application_date} onChange={e=>setApplicationForm({...applicationForm,application_date:e.target.value})} required/></Field><Field label="Finca"><FarmSelect farms={farms} value={applicationForm.farm_id} onChange={e=>setApplicationForm({...applicationForm,farm_id:e.target.value})}/></Field><Field label="Actividad"><select value={applicationForm.activity_type} onChange={e=>setApplicationForm({...applicationForm,activity_type:e.target.value})}><option>Fertilización</option><option>Abono</option></select></Field><Field label="Método"><select value={applicationForm.method} onChange={e=>setApplicationForm({...applicationForm,method:e.target.value})}><option>Dron</option><option>Máquina estacionaria</option><option>Manual</option><option>Otro</option></select></Field><Field label="Producto"><input value={applicationForm.product} onChange={e=>setApplicationForm({...applicationForm,product:e.target.value})} required/></Field><Field label="Dosis"><input type="number" min="0" step="0.01" value={applicationForm.dose} onChange={e=>setApplicationForm({...applicationForm,dose:e.target.value})}/></Field><Field label="Unidad dosis"><input value={applicationForm.dose_unit} onChange={e=>setApplicationForm({...applicationForm,dose_unit:e.target.value})}/></Field><Field label="Área"><input type="number" min="0" step="0.01" value={applicationForm.area} onChange={e=>setApplicationForm({...applicationForm,area:e.target.value})}/></Field><Field label="Aplicado por"><input value={applicationForm.applied_by} onChange={e=>setApplicationForm({...applicationForm,applied_by:e.target.value})}/></Field><Field label="Notas"><input value={applicationForm.notes} onChange={e=>setApplicationForm({...applicationForm,notes:e.target.value})}/></Field></div><button className="primary-button compact" disabled={saving}>Guardar aplicación</button></form>}<div className="data-card"><h2>Historial de aplicaciones</h2><Table headers={['Fecha','Finca','Actividad','Método','Producto','Dosis','Área']} rows={applications.map(r=>[r.application_date,farmName(r.farm_id),r.activity_type,r.method,r.product,r.dose?`${r.dose} ${r.dose_unit||''}`:'—',r.area?`${r.area} ${r.area_unit||''}`:'—'])}/></div></div>
}

function Table({headers,rows}) { return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>):<tr><td colSpan={headers.length} className="empty-cell">No hay registros todavía.</td></tr>}</tbody></table></div> }
