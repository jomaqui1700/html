import { NextResponse } from 'next/server'
import { sql } from '../../../lib/db'
import { getSession } from '../../../lib/auth'

async function auth(){const session=await getSession();if(!session)return {error:NextResponse.json({error:'No autorizado'},{status:401})};return {session}}

export async function GET(){
 const a=await auth();if(a.error)return a.error
 const workers=await sql`SELECT w.id,w.farm_id,w.full_name,w.identification,w.phone,w.hourly_rate,w.active,w.business_area,w.created_at,f.name AS farm_name FROM workers w JOIN farms f ON f.id=w.farm_id WHERE w.business_area='cafe' ORDER BY w.active DESC,w.full_name`
 return NextResponse.json({workers})
}

export async function POST(request){
 const a=await auth();if(a.error)return a.error
 if(a.session.role!=='admin')return NextResponse.json({error:'Solo un administrador puede registrar peones.'},{status:403})
 try{
  const b=await request.json(),name=String(b.full_name||'').trim(),farmId=Number(b.farm_id),rate=Number(b.hourly_rate||0)
  if(!name||!farmId)return NextResponse.json({error:'Nombre y finca son requeridos.'},{status:400})
  if(rate<0)return NextResponse.json({error:'La tarifa no puede ser negativa.'},{status:400})
  const rows=await sql`INSERT INTO workers(farm_id,full_name,identification,phone,hourly_rate,active,business_area,created_by) VALUES(${farmId},${name},${String(b.identification||'').trim()},${String(b.phone||'').trim()},${rate},true,'cafe',${a.session.id}) RETURNING id`
  return NextResponse.json({ok:true,id:rows[0].id},{status:201})
 }catch(e){console.error(e);return NextResponse.json({error:'No se pudo registrar el peón.'},{status:500})}
}

export async function PATCH(request){
 const a=await auth();if(a.error)return a.error
 if(a.session.role!=='admin')return NextResponse.json({error:'Solo un administrador puede modificar peones.'},{status:403})
 try{
  const b=await request.json(),id=Number(b.id),farmId=Number(b.farm_id),name=String(b.full_name||'').trim(),rate=Number(b.hourly_rate||0)
  if(!id||!farmId||!name)return NextResponse.json({error:'Datos incompletos.'},{status:400})
  await sql`UPDATE workers SET farm_id=${farmId},full_name=${name},identification=${String(b.identification||'').trim()},phone=${String(b.phone||'').trim()},hourly_rate=${rate},active=${Boolean(b.active)} WHERE id=${id} AND business_area='cafe'`
  return NextResponse.json({ok:true})
 }catch(e){console.error(e);return NextResponse.json({error:'No se pudo actualizar el peón.'},{status:500})}
}
