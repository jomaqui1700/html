'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [status, setStatus] = useState('Comprobando conexión...')
  const [farms, setFarms] = useState([])

  useEffect(() => {
    async function checkConnection() {
      const { data, error } = await supabase.from('farms').select('id,name,active').order('name')
      if (error) {
        setStatus('Supabase conectado. Inicie sesión para consultar los datos protegidos.')
        return
      }
      setFarms(data || [])
      setStatus('Conexión con Supabase activa')
    }
    checkConnection()
  }, [])

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Sistema de gestión agropecuaria</p>
        <h1>Ganadera San Ramón</h1>
        <p className="subtitle">Café y ganado en una sola plataforma, con módulos e inventarios independientes.</p>
        <div className="status">{status}</div>
      </section>

      <section className="grid">
        {['Café','Ganado','Inventario Café','Inventario Ganado','Gastos','Reportes','Fincas','Usuarios'].map((item) => (
          <article className="card" key={item}><h2>{item}</h2><p>Módulo preparado para la siguiente etapa.</p></article>
        ))}
      </section>

      {farms.length > 0 && (
        <section className="farms">
          <h2>Fincas registradas</h2>
          <ul>{farms.map(farm => <li key={farm.id}>{farm.name}</li>)}</ul>
        </section>
      )}
    </main>
  )
}
