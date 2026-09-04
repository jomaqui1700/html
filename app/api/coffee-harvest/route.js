import {NextResponse} from'next/server'
import {createHash} from'node:crypto'
import {sql} from'../../../lib/db'
import {getSession} from'../../../lib/auth'

async function auth(){const s=await getSession();if(!s)return{error:NextResponse.json({error:'No autorizado'},{status:401})};return{session:s}}
function measureNumber(x){const n=Number(x.measure_number);if(n>0)return n;const m=String(x.notes||'').match(/Medida\s+(\d+)/i);return Number(m?.[1]||1)}
function batchUuid(payload){const h=createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0,32).split('');h[12]='4';h[16]=((parseInt(h[16],16)&3)|8).toString(16);const s=h.join('');return`${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`}

export async function GET(){
 const a=await auth();if(a.error)return a.error
 const rows=await sql`SELECT ch.id,ch.harvest_date,ch.week_number,ch.farm_id,ch.worker_id,ch.quantity,ch.unit,ch.rate_per_unit,ch.paid,ch.paid_at,ch.batch_id,ch.measure_number,ch.notes,ch.created_at,w.full_name worker_name,f.name farm_name,(ch.quantity*ch.rate_per_unit) amount FROM coffee_harvest ch JOIN workers w ON w.id=ch.worker_id JOIN farms f ON f.id=ch.farm_id ORDER BY ch.harvest_date DESC,ch.created_at DESC,ch.id DESC,w.full_name`
 return NextResponse.json({harvest:rows})
}

export async function POST(req){
 const a=await auth();if(a.error)return a.error
 if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403})
 try{
  const b=await req.json()
  if(!b.harvest_date)return NextResponse.json({error:'La fecha es requerida.'},{status:400})
  const entries=Array.isArray(b.entries)?b.entries:[]
  const valid=entries.map(x=>({worker_id:Number(x.worker_id),farm_id:Number(x.farm_id),quantity:Number(x.quantity||0),rate_per_unit:Number(x.rate_per_unit||0),measure_number:measureNumber(x),notes:String(x.notes||'')})).filter(x=>x.worker_id&&x.farm_id&&x.quantity>0)
  if(!valid.length)return NextResponse.json({error:'Ingrese al menos una medida con peón, finca y cajuelas.'},{status:400})
  if(valid.some(x=>x.quantity<0||x.rate_per_unit<0))return NextResponse.json({error:'Las cantidades y precios no pueden ser negativos.'},{status:400})
  const canonical={harvest_date:String(b.harvest_date).slice(0,10),week_number:Number(b.week_number),created_by:String(a.session.id),entries:valid.map(x=>({worker_id:x.worker_id,farm_id:x.farm_id,quantity:x.quantity,rate_per_unit:x.rate_per_unit,measure_number:x.measure_number,notes:x.notes})).sort((x,y)=>x.worker_id-y.worker_id||x.measure_number-y.measure_number||x.farm_id-y.farm_id)}
  const batchId=String(b.batch_id||batchUuid(canonical))
  const previous=await sql`SELECT COUNT(*)::int count FROM coffee_harvest WHERE batch_id=${batchId}`
  if(Number(previous[0]?.count||0)>0)return NextResponse.json({error:'Esta planilla ya fue registrada. No se guardaron medidas duplicadas.',duplicate:true},{status:409})
  try{
   for(const x of valid){
    await sql`INSERT INTO coffee_harvest(harvest_date,week_number,farm_id,worker_id,quantity,unit,rate_per_unit,paid,batch_id,measure_number,notes,created_by) VALUES(${b.harvest_date},${Number(b.week_number)},${x.farm_id},${x.worker_id},${x.quantity},'Cajuela',${x.rate_per_unit},false,${batchId},${x.measure_number},${x.notes},${a.session.id})`
   }
  }catch(e){if(String(e?.code)==='23505')return NextResponse.json({error:'Esta planilla ya fue registrada. No se guardaron medidas duplicadas.',duplicate:true},{status:409});throw e}
  return NextResponse.json({ok:true,count:valid.length,batch_id:batchId})
 }catch(e){console.error(e);return NextResponse.json({error:'No se pudo registrar la cosecha.'},{status:500})}
}

export async function PATCH(req){
 const a=await auth();if(a.error)return a.error
 if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403})
 try{
  const b=await req.json()
  if(b.edit_measure){
   const id=Number(b.id),workerId=Number(b.worker_id),farmId=Number(b.farm_id),quantity=Number(b.quantity),rate=Number(b.rate_per_unit)
   if(!id||!workerId||!farmId)return NextResponse.json({error:'Peón y finca son requeridos.'},{status:400})
   if(!(quantity>0)||rate<0)return NextResponse.json({error:'La cantidad debe ser mayor que cero y el precio no puede ser negativo.'},{status:400})
   const current=await sql`SELECT id,paid,measure_number,notes FROM coffee_harvest WHERE id=${id} LIMIT 1`
   if(!current.length)return NextResponse.json({error:'La medida no existe.'},{status:404})
   if(current[0].paid)return NextResponse.json({error:'Esta medida pertenece a una nómina Pagada. Marque primero el pago como Pendiente para poder corregirla.'},{status:409})
   const n=Number(current[0].measure_number)||measureNumber(current[0]),observation=String(b.notes||'').trim(),notes=observation?`Medida ${n}: ${observation}`:`Medida ${n}`
   await sql`UPDATE coffee_harvest SET worker_id=${workerId},farm_id=${farmId},quantity=${quantity},rate_per_unit=${rate},notes=${notes},measure_number=${n} WHERE id=${id} AND paid=false`
   return NextResponse.json({ok:true})
  }
  const paid=Boolean(b.paid)
  if(b.worker_id&&b.week_number&&b.year){
   const workerId=Number(b.worker_id),weekNumber=Number(b.week_number),year=Number(b.year)
   await sql`UPDATE coffee_harvest SET paid=${paid},paid_at=${paid?new Date():null} WHERE worker_id=${workerId} AND week_number=${weekNumber} AND EXTRACT(YEAR FROM harvest_date)=${year}`
   return NextResponse.json({ok:true})
  }
  if(!b.id)return NextResponse.json({error:'Registro de cosecha requerido.'},{status:400})
  await sql`UPDATE coffee_harvest SET paid=${paid},paid_at=${paid?new Date():null} WHERE id=${Number(b.id)}`
  return NextResponse.json({ok:true})
 }catch(e){console.error(e);return NextResponse.json({error:'No se pudo actualizar el registro de cosecha.'},{status:500})}
}
