import {NextResponse} from'next/server'
import {sql} from'../../../lib/db'
import {getSession} from'../../../lib/auth'

async function auth(){const s=await getSession();if(!s)return{error:NextResponse.json({error:'No autorizado'},{status:401})};return{session:s}}

export async function GET(){
 const a=await auth();if(a.error)return a.error
 const rows=await sql`SELECT ch.id,ch.harvest_date,ch.week_number,ch.farm_id,ch.worker_id,ch.quantity,ch.unit,ch.rate_per_unit,ch.paid,ch.notes,w.full_name worker_name,f.name farm_name,(ch.quantity*ch.rate_per_unit) amount FROM coffee_harvest ch JOIN workers w ON w.id=ch.worker_id JOIN farms f ON f.id=ch.farm_id ORDER BY ch.harvest_date DESC,ch.id DESC,w.full_name`
 return NextResponse.json({harvest:rows})
}

export async function POST(req){
 const a=await auth();if(a.error)return a.error
 if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403})
 try{
  const b=await req.json()
  if(!b.harvest_date||!b.farm_id)return NextResponse.json({error:'Fecha y finca son requeridas.'},{status:400})
  const entries=Array.isArray(b.entries)?b.entries:[]
  const valid=entries.map(x=>({worker_id:Number(x.worker_id),quantity:Number(x.quantity||0),rate_per_unit:Number(x.rate_per_unit||0),notes:String(x.notes||'')})).filter(x=>x.worker_id&&x.quantity>0)
  if(!valid.length)return NextResponse.json({error:'Ingrese al menos una medida de cosecha.'},{status:400})
  if(valid.some(x=>x.quantity<0||x.rate_per_unit<0))return NextResponse.json({error:'Las cantidades y precios no pueden ser negativos.'},{status:400})
  for(const x of valid){
   await sql`INSERT INTO coffee_harvest(harvest_date,week_number,farm_id,worker_id,quantity,unit,rate_per_unit,paid,notes,created_by) VALUES(${b.harvest_date},${Number(b.week_number)},${Number(b.farm_id)},${x.worker_id},${x.quantity},'Cajuela',${x.rate_per_unit},false,${x.notes},${a.session.id})`
  }
  return NextResponse.json({ok:true,count:valid.length})
 }catch(e){console.error(e);return NextResponse.json({error:'No se pudo registrar la cosecha.'},{status:500})}
}

export async function PATCH(req){
 const a=await auth();if(a.error)return a.error
 if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403})
 const b=await req.json()
 await sql`UPDATE coffee_harvest SET paid=${Boolean(b.paid)} WHERE id=${Number(b.id)}`
 return NextResponse.json({ok:true})
}
