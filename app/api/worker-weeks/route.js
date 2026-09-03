import { NextResponse } from 'next/server'
import { sql } from '../../../lib/db'
import { getSession } from '../../../lib/auth'

async function requireUser(){
  const session=await getSession()
  if(!session)return {error:NextResponse.json({error:'No autorizado'},{status:401})}
  return {session}
}

function n(v){const x=Number(v||0);return Number.isFinite(x)?x:0}

export async function GET(){
  const a=await requireUser(); if(a.error)return a.error
  const weeks=await sql`
    SELECT ww.id,ww.worker_id,ww.farm_id,ww.week_number,ww.week_start,ww.week_end,
      ww.monday_hours,ww.tuesday_hours,ww.wednesday_hours,ww.thursday_hours,
      ww.friday_hours,ww.saturday_hours,ww.sunday_hours,ww.hourly_rate,
      ww.advances,ww.deductions,ww.paid,ww.payment_date,ww.notes,
      w.full_name AS worker_name,f.name AS farm_name,
      (ww.monday_hours+ww.tuesday_hours+ww.wednesday_hours+ww.thursday_hours+ww.friday_hours+ww.saturday_hours+ww.sunday_hours) AS total_hours,
      ((ww.monday_hours+ww.tuesday_hours+ww.wednesday_hours+ww.thursday_hours+ww.friday_hours+ww.saturday_hours+ww.sunday_hours)*ww.hourly_rate) AS gross_pay,
      (((ww.monday_hours+ww.tuesday_hours+ww.wednesday_hours+ww.thursday_hours+ww.friday_hours+ww.saturday_hours+ww.sunday_hours)*ww.hourly_rate)-ww.advances-ww.deductions) AS net_pay
    FROM worker_weeks ww
    JOIN workers w ON w.id=ww.worker_id
    JOIN farms f ON f.id=ww.farm_id
    ORDER BY ww.week_start DESC,w.full_name`
  return NextResponse.json({weeks})
}

export async function POST(request){
  const a=await requireUser(); if(a.error)return a.error
  if(a.session.role!=='admin')return NextResponse.json({error:'Solo un administrador puede registrar horas.'},{status:403})
  try{
    const b=await request.json()
    const workerId=Number(b.worker_id), farmId=Number(b.farm_id), rate=n(b.hourly_rate)
    if(!workerId||!farmId||!b.week_start||!b.week_end)return NextResponse.json({error:'Peón, finca y semana son requeridos.'},{status:400})
    const hours=[b.monday_hours,b.tuesday_hours,b.wednesday_hours,b.thursday_hours,b.friday_hours,b.saturday_hours,b.sunday_hours].map(n)
    if(hours.some(x=>x<0||x>24))return NextResponse.json({error:'Las horas diarias deben estar entre 0 y 24.'},{status:400})
    if(rate<0)return NextResponse.json({error:'La tarifa no puede ser negativa.'},{status:400})
    const rows=await sql`
      INSERT INTO worker_weeks(worker_id,farm_id,week_number,week_start,week_end,monday_hours,tuesday_hours,wednesday_hours,thursday_hours,friday_hours,saturday_hours,sunday_hours,hourly_rate,advances,deductions,notes,created_by)
      VALUES(${workerId},${farmId},${Number(b.week_number)},${b.week_start},${b.week_end},${hours[0]},${hours[1]},${hours[2]},${hours[3]},${hours[4]},${hours[5]},${hours[6]},${rate},${n(b.advances)},${n(b.deductions)},${String(b.notes||'').trim()},${a.session.id})
      ON CONFLICT(worker_id,week_start) DO UPDATE SET
        farm_id=EXCLUDED.farm_id,week_number=EXCLUDED.week_number,week_end=EXCLUDED.week_end,
        monday_hours=EXCLUDED.monday_hours,tuesday_hours=EXCLUDED.tuesday_hours,wednesday_hours=EXCLUDED.wednesday_hours,thursday_hours=EXCLUDED.thursday_hours,
        friday_hours=EXCLUDED.friday_hours,saturday_hours=EXCLUDED.saturday_hours,sunday_hours=EXCLUDED.sunday_hours,
        hourly_rate=EXCLUDED.hourly_rate,advances=EXCLUDED.advances,deductions=EXCLUDED.deductions,notes=EXCLUDED.notes,updated_at=now()
      RETURNING id`
    return NextResponse.json({ok:true,id:rows[0].id})
  }catch(e){console.error(e);return NextResponse.json({error:'No se pudo guardar la semana de trabajo.'},{status:500})}
}

export async function PATCH(request){
  const a=await requireUser(); if(a.error)return a.error
  if(a.session.role!=='admin')return NextResponse.json({error:'Solo un administrador puede registrar pagos.'},{status:403})
  try{
    const b=await request.json(), id=Number(b.id)
    if(!id)return NextResponse.json({error:'Registro inválido.'},{status:400})
    await sql`UPDATE worker_weeks SET paid=${Boolean(b.paid)},payment_date=${b.paid?(b.payment_date||new Date().toISOString().slice(0,10)):null},updated_at=now() WHERE id=${id}`
    return NextResponse.json({ok:true})
  }catch(e){console.error(e);return NextResponse.json({error:'No se pudo actualizar el pago.'},{status:500})}
}
