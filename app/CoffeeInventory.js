'use client'
import {useEffect,useMemo,useState} from 'react'

const blank={name:'',category:'Abono',unit:'sacos',quantity:'',minimum_stock:'',unit_cost:'',farm_id:'',supplier:'',lot_number:'',expiration_date:'',notes:''}
const entryBlank={inventory_id:'',quantity:'',unit_cost:'',movement_date:'',farm_id:'',supplier:'',notes:''}
function money(v){return`₡${Number(v||0).toLocaleString('es-CR',{maximumFractionDigits:2})}`}
function num(v){return Number(v||0).toLocaleString('es-CR',{maximumFractionDigits:3})}
function d(v){return v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('es-CR'):'—'}

export default function CoffeeInventory({farms,user}){
  const isAdmin=user?.role==='admin'
  const[products,setProducts]=useState([]),[movements,setMovements]=useState([])
  const[form,setForm]=useState(blank),[entry,setEntry]=useState(entryBlank),[editing,setEditing]=useState(null)
  const[tab,setTab]=useState('Todos'),[msg,setMsg]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  const activeFarms=useMemo(()=>farms.filter(f=>f.active),[farms])
  useEffect(()=>{setEntry(e=>({...e,movement_date:e.movement_date||new Date().toISOString().slice(0,10)}));load()},[])
  async function load(){const r=await fetch('/api/coffee-inventory',{cache:'no-store'}),data=await r.json();if(r.ok){setProducts(data.products||[]);setMovements(data.movements||[])}else setErr(data.error||'No se pudo cargar el inventario.')}
  const filtered=useMemo(()=>products.filter(p=>tab==='Todos'||(tab==='Abonos'?p.category==='Abono':p.category==='Atomizacion')),[products,tab])
  const totals=useMemo(()=>products.filter(p=>p.active).reduce((a,p)=>{a.value+=Number(p.inventory_value||0);a.low+=p.low_stock?1:0;if(p.category==='Abono')a.abonos++;if(p.category==='Atomizacion')a.atomizos++;return a},{value:0,low:0,abonos:0,atomizos:0}),[products])
  function categoryLabel(v){return v==='Atomizacion'?'Atomización':'Abono'}
  function reset(){setForm(blank);setEditing(null)}
  async function saveProduct(e){e.preventDefault();setBusy(true);setErr('');setMsg('');const r=await fetch('/api/coffee-inventory',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(editing?{...form,id:editing.id}:{...form})}),data=await r.json();if(r.ok){setMsg(editing?'Producto actualizado correctamente.':'Producto agregado al inventario.');reset();await load()}else setErr(data.error||'No se pudo guardar.');setBusy(false)}
  function editProduct(p){setEditing(p);setForm({name:p.product_name||'',category:p.category||'Abono',unit:p.unit||'sacos',quantity:'',minimum_stock:String(p.minimum_stock||''),unit_cost:String(p.unit_cost||''),farm_id:p.farm_id?String(p.farm_id):'',supplier:p.supplier||'',lot_number:p.lot_number||'',expiration_date:p.expiration_date?String(p.expiration_date).slice(0,10):'',notes:p.notes||''})}
  async function toggle(p){if(!confirm(`¿${p.active?'Desactivar':'Activar'} ${p.product_name}?`))return;await fetch('/api/coffee-inventory',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,action:'toggle'})});await load()}
  async function addEntry(e){e.preventDefault();setBusy(true);setErr('');setMsg('');const r=await fetch('/api/coffee-inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...entry,action:'entrada'})}),data=await r.json();if(r.ok){setMsg('Entrada registrada y existencia actualizada.');setEntry({...entryBlank,movement_date:entry.movement_date});await load()}else setErr(data.error||'No se pudo registrar la entrada.');setBusy(false)}
  const selected=products.find(p=>String(p.id)===String(entry.inventory_id))
  return <section className="farms-module inventory-module">
    <div className="farms-toolbar"><div><h2>Inventario Café</h2><p className="muted">Control separado de abonos y productos de atomización.</p></div><div className="farm-count"><strong>{products.filter(p=>p.active).length}</strong><span>productos activos</span></div></div>
    {msg&&<div className="success-box">{msg}</div>}{err&&<div className="error-box">{err}</div>}
    <div className="summary-grid"><article className="summary-card"><span>Abonos</span><strong>{totals.abonos}</strong></article><article className="summary-card"><span>Atomización</span><strong>{totals.atomizos}</strong></article><article className="summary-card"><span>Valor inventario</span><strong>{money(totals.value)}</strong></article><article className="summary-card"><span>Existencia baja</span><strong>{totals.low}</strong></article></div>

    {isAdmin&&<><h3>{editing?'Editar producto':'Agregar producto'}</h3><form className="week-form labor-entry-card" onSubmit={saveProduct}><div className="week-main-fields labor-grid">
      <label>Nombre del producto<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
      <label>Categoría<select value={form.category} onChange={e=>setForm({...form,category:e.target.value,unit:e.target.value==='Abono'?'sacos':'L'})}><option value="Abono">Abono</option><option value="Atomizacion">Atomización</option></select></label>
      <label>Unidad<select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>{form.category==='Abono'?<><option>sacos</option><option>kg</option><option>unidades</option></>:<><option>L</option><option>ml</option><option>kg</option><option>unidades</option></>}</select></label>
      {!editing&&<label>Cantidad inicial<input type="number" step="0.001" min="0" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></label>}
      <label>Existencia mínima<input type="number" step="0.001" min="0" value={form.minimum_stock} onChange={e=>setForm({...form,minimum_stock:e.target.value})}/></label>
      <label>Costo unitario<input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e=>setForm({...form,unit_cost:e.target.value})}/></label>
      <label>Finca opcional<select value={form.farm_id} onChange={e=>setForm({...form,farm_id:e.target.value})}><option value="">Inventario general</option>{activeFarms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label>Proveedor<input value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/></label>
      <label>Lote<input value={form.lot_number} onChange={e=>setForm({...form,lot_number:e.target.value})}/></label>
      <label>Vencimiento<input type="date" value={form.expiration_date} onChange={e=>setForm({...form,expiration_date:e.target.value})}/></label>
      <label>Observaciones<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    </div><div style={{display:'flex',gap:10}}><button className="primary-action" disabled={busy}>{busy?'Guardando…':editing?'Guardar cambios':'Agregar producto'}</button>{editing&&<button type="button" className="secondary-action" onClick={reset}>Cancelar</button>}</div></form>

    <h3>Registrar nueva entrada / compra</h3><form className="week-form labor-entry-card" onSubmit={addEntry}><div className="week-main-fields labor-grid">
      <label>Producto<select value={entry.inventory_id} onChange={e=>{const p=products.find(x=>String(x.id)===e.target.value);setEntry({...entry,inventory_id:e.target.value,unit_cost:p?.unit_cost||'',farm_id:p?.farm_id?String(p.farm_id):'',supplier:p?.supplier||''})}} required><option value="">Seleccione</option>{products.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.product_name} · {categoryLabel(p.category)} · {p.unit}</option>)}</select></label>
      <label>Fecha<input type="date" value={entry.movement_date} onChange={e=>setEntry({...entry,movement_date:e.target.value})} required/></label>
      <label>Cantidad {selected?`(${selected.unit})`:''}<input type="number" step="0.001" min="0.001" value={entry.quantity} onChange={e=>setEntry({...entry,quantity:e.target.value})} required/></label>
      <label>Costo unitario<input type="number" step="0.01" min="0" value={entry.unit_cost} onChange={e=>setEntry({...entry,unit_cost:e.target.value})}/></label>
      <label>Finca<select value={entry.farm_id} onChange={e=>setEntry({...entry,farm_id:e.target.value})}><option value="">Inventario general</option>{activeFarms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label>Proveedor<input value={entry.supplier} onChange={e=>setEntry({...entry,supplier:e.target.value})}/></label>
      <label>Observación<input value={entry.notes} onChange={e=>setEntry({...entry,notes:e.target.value})}/></label>
    </div><button className="primary-action" disabled={busy}>{busy?'Registrando…':'Registrar entrada'}</button></form></>}

    <div className="section-heading" style={{marginTop:24}}><div><h3>Existencias actuales</h3><p>Seleccione la categoría para revisar el inventario.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['Todos','Abonos','Atomización'].map(t=><button key={t} className={tab===t?'primary-action':'secondary-action'} onClick={()=>setTab(t)}>{t}</button>)}</div></div>
    <div className="farms-table-wrap"><table className="farms-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Finca</th><th>Existencia</th><th>Mínimo</th><th>Costo unit.</th><th>Valor</th><th>Lote</th><th>Vence</th><th>Estado</th>{isAdmin&&<th>Acciones</th>}</tr></thead><tbody>{filtered.length?filtered.map(p=><tr key={p.id}><td><strong>{p.product_name}</strong><br/><small>{p.supplier||''}</small></td><td>{categoryLabel(p.category)}</td><td>{p.farm_name||'General'}</td><td><strong>{num(p.current_stock)} {p.unit}</strong></td><td>{num(p.minimum_stock)} {p.unit}</td><td>{money(p.unit_cost)}</td><td>{money(p.inventory_value)}</td><td>{p.lot_number||'—'}</td><td>{d(p.expiration_date)}</td><td><span className={`status-pill ${p.low_stock?'inactive':'active'}`}>{p.low_stock?'Existencia baja':'Disponible'}</span></td>{isAdmin&&<td><button onClick={()=>editProduct(p)}>Editar</button> <button onClick={()=>toggle(p)}>{p.active?'Desactivar':'Activar'}</button></td>}</tr>):<tr><td colSpan={isAdmin?11:10} className="empty-cell">Aún no hay productos registrados.</td></tr>}</tbody></table></div>

    <h3 style={{marginTop:24}}>Historial de entradas y movimientos</h3><div className="farms-table-wrap"><table className="farms-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Costo unit.</th><th>Finca</th><th>Proveedor</th><th>Observación</th></tr></thead><tbody>{movements.length?movements.map(m=><tr key={m.id}><td>{d(m.movement_date)}</td><td>{m.product_name}</td><td>{m.movement_type}</td><td>{num(m.quantity)} {m.unit}</td><td>{money(m.unit_cost)}</td><td>{m.farm_name||'General'}</td><td>{m.supplier||'—'}</td><td>{m.notes||'—'}</td></tr>):<tr><td colSpan="8" className="empty-cell">Aún no hay movimientos.</td></tr>}</tbody></table></div>
  </section>
}
