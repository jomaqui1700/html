import {NextResponse} from'next/server'
import {sql} from'../../../lib/db'
import {getSession} from'../../../lib/auth'

async function auth(){const s=await getSession();if(!s)return{error:NextResponse.json({error:'No autorizado'},{status:401})};return{session:s}}
function isoWeek(d){const x=new Date(`${d}T12:00:00Z`);x.setUTCDate(x.getUTCDate()+3-(x.getUTCDay()+6)%7);const w=new Date(Date.UTC(x.getUTCFullYear(),0,4));return 1+Math.round(((x-w)/86400000-3+(w.getUTCDay()+6)%7)/7)}

export async function GET(){
 const a=await auth();if(a.error)return a.error
 const rows=await sql`SELECT id,year,start_date,start_week,active,created_at,updated_at FROM coffee_seasons ORDER BY year DESC`
 return NextResponse.json({seasons:rows})
}

export async function POST(req){
 const a=await auth();if(a.error)return a.error
 if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403})
 try{
  const b=await req.json(),startDate=String(b.start_date||'').slice(0,10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate))return NextResponse.json({error:'Seleccione la fecha de inicio de cosecha.'},{status:400})
  const year=Number(startDate.slice(0,4)),startWeek=isoWeek(startDate)
  await sql`INSERT INTO coffee_seasons(year,start_date,start_week,active,created_by) VALUES(${year},${startDate},${startWeek},true,${a.session.id}) ON CONFLICT(year) DO UPDATE SET start_date=EXCLUDED.start_date,start_week=EXCLUDED.start_week,active=true,updated_at=NOW()`
  return NextResponse.json({ok:true,year,start_week:startWeek})
 }catch(e){console.error(e);return NextResponse.json({error:'No se pudo guardar el inicio de cosecha.'},{status:500})}
}
