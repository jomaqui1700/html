import {NextResponse} from'next/server'
import {sql} from'../../../lib/db'
import {getSession} from'../../../lib/auth'

async function auth(){const s=await getSession();if(!s)return{error:NextResponse.json({error:'No autorizado'},{status:401})};return{session:s}}
function entryData(b){
 const pay_mode=String(b.pay_mode||'Jornal')
 const rawHours=b.hours===''||b.hours==null?null:Number(b.hours)
 const hours=pay_mode==='Horas'?rawHours:null
 const rate=pay_mode==='Horas'?Number(b.rate||0):0
 const jornal_rate=pay_mode==='Jornal'?Number(b.jornal_rate||0):0
 const overtime_hours=Number(b.overtime_hours||0)
 const overtime_rate=Number(b.overtime_rate||0)
 const base=pay_mode==='Horas'?Number((Number(hours||0)*rate).toFixed(2)):jornal_rate
 const overtime=Number((overtime_hours*overtime_rate).toFixed(2))
 const amount=Number((base+overtime).toFixed(2))
 return{work_date:String(b.work_date||'').slice(0,10),worker_id:Number(b.worker_id),farm_id:Number(b.farm_id),task:String(b.task||'').trim(),pay_mode,hours,rate,jornal_rate,overtime_hours,overtime_rate,amount,notes:String(b.notes||'').trim()}
}
function validateEntry(x){if(!x.work_date||!x.worker_id||!x.farm_id||!x.task)return'Fecha, peón, finca y labor son requeridos.';if(!['Jornal','Horas'].includes(x.pay_mode))return'Modalidad de pago no válida.';if(x.pay_mode==='Horas'&&!(x.hours>0))return'Ingrese las horas trabajadas.';if(x.pay_mode==='Horas'&&!(x.rate>=0))return'Costo de hora no válido.';if(x.rate<0||x.jornal_rate<0||x.overtime_hours<0||x.overtime_rate<0)return'Los valores de pago no pueden ser negativos.';return''}

export async function GET(){const a=await auth();if(a.error)return a.error;const entries=await sql`
 SELECT e.*,w.full_name AS worker_name,f.name AS farm_name,
        date_trunc('week',e.work_date)::date AS week_start,
        (date_trunc('week',e.work_date)::date+6) AS week_end,
        (e.overtime_hours*e.overtime_rate)::numeric(14,2) AS overtime_amount
 FROM public.coffee_labor_entries e
 JOIN public.coffee_labor_workers w ON w.id=e.worker_id
 JOIN public.farms f ON f.id=e.farm_id
 ORDER BY e.work_date DESC,e.id DESC`;
 const payroll=await sql`SELECT * FROM public.coffee_labor_weekly_report ORDER BY week_start DESC,worker_name`;
 const farms=await sql`
 SELECT date_trunc('week',e.work_date)::date AS week_start,(date_trunc('week',e.work_date)::date+6) AS week_end,
        e.farm_id,f.name AS farm_name,COUNT(DISTINCT e.worker_id) AS workers,COUNT(DISTINCT e.work_date) AS work_days,
        COALESCE(SUM(e.hours),0)::numeric(12,2) AS total_hours,
        COALESCE(SUM(e.overtime_hours),0)::numeric(12,2) AS total_overtime_hours,
        COALESCE(SUM(CASE WHEN e.pay_mode='Jornal' THEN e.jornal_rate ELSE 0 END),0)::numeric(14,2) AS total_jornal,
        COALESCE(SUM(e.overtime_hours*e.overtime_rate),0)::numeric(14,2) AS total_overtime,
        COALESCE(SUM(e.amount),0)::numeric(14,2) AS total_amount
 FROM public.coffee_labor_entries e JOIN public.farms f ON f.id=e.farm_id
 GROUP BY date_trunc('week',e.work_date)::date,e.farm_id,f.name ORDER BY week_start DESC,f.name`;
 return NextResponse.json({entries,payroll,farm_summary:farms})}

export async function POST(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const x=entryData(await req.json()),er=validateEntry(x);if(er)return NextResponse.json({error:er},{status:400});const r=await sql`INSERT INTO public.coffee_labor_entries(work_date,worker_id,farm_id,task,pay_mode,hours,rate,jornal_rate,overtime_hours,overtime_rate,amount,notes,created_by,updated_by) VALUES(${x.work_date},${x.worker_id},${x.farm_id},${x.task},${x.pay_mode},${x.hours},${x.rate},${x.jornal_rate},${x.overtime_hours},${x.overtime_rate},${x.amount},${x.notes||null},${a.session.id},${a.session.id}) RETURNING id`;return NextResponse.json({ok:true,id:r[0]?.id,amount:x.amount})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo registrar la labor.'},{status:500})}}

export async function PATCH(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const b=await req.json();if(b.action==='payment'){const worker_id=Number(b.worker_id),week_start=String(b.week_start||'').slice(0,10),paid=Boolean(b.paid),note=String(b.payment_note||'').trim();if(!worker_id||!week_start)return NextResponse.json({error:'Peón y semana requeridos.'},{status:400});await sql`INSERT INTO public.coffee_labor_week_payments(worker_id,week_start,paid,paid_at,payment_note,updated_by) VALUES(${worker_id},${week_start},${paid},${paid?new Date():null},${note||null},${a.session.id}) ON CONFLICT(worker_id,week_start) DO UPDATE SET paid=excluded.paid,paid_at=excluded.paid_at,payment_note=excluded.payment_note,updated_by=excluded.updated_by,updated_at=now()`;return NextResponse.json({ok:true})}
 const id=Number(b.id),x=entryData(b),er=validateEntry(x);if(!id)return NextResponse.json({error:'Registro requerido.'},{status:400});if(er)return NextResponse.json({error:er},{status:400});await sql`UPDATE public.coffee_labor_entries SET work_date=${x.work_date},worker_id=${x.worker_id},farm_id=${x.farm_id},task=${x.task},pay_mode=${x.pay_mode},hours=${x.hours},rate=${x.rate},jornal_rate=${x.jornal_rate},overtime_hours=${x.overtime_hours},overtime_rate=${x.overtime_rate},amount=${x.amount},notes=${x.notes||null},updated_by=${a.session.id},updated_at=now() WHERE id=${id}`;return NextResponse.json({ok:true,amount:x.amount})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo actualizar el registro.'},{status:500})}}
