'use client'
import {useEffect,useState} from'react'
import CoffeeLaborWorkers from'../CoffeeLaborWorkers'

export default function LaboresCafePage(){
 const[loading,setLoading]=useState(true),[user,setUser]=useState(null),[farms,setFarms]=useState([])
 useEffect(()=>{(async()=>{try{const s=await fetch('/api/auth/session',{cache:'no-store'}),sd=await s.json();if(sd.user){setUser(sd.user);const f=await fetch('/api/farms',{cache:'no-store'}),fd=await f.json();if(f.ok)setFarms(fd.farms||[])}}finally{setLoading(false)}})()},[])
 if(loading)return <div className="loading-screen">Cargando módulo de labores de café…</div>
 if(!user)return <main className="dashboard"><section className="placeholder-panel"><h2>Sesión requerida</h2><p>Ingrese primero a Ganadera San Ramón.</p><a className="primary-action" href="/">Ir al inicio de sesión</a></section></main>
 return <div className="dashboard labor-page"><div className="labor-page-top"><a className="secondary-action" href="/">← Volver al panel principal</a><div className="user-badge"><span className={`role ${user.role==='admin'?'admin':'viewer'}`}>{user.role==='admin'?'Administrador':'Consulta'}</span><small>{user.email}</small></div></div><CoffeeLaborWorkers farms={farms} user={user}/></div>
}
