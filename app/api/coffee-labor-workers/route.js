import {NextResponse} from'next/server'
import {sql} from'../../../lib/db'
import {getSession} from'../../../lib/auth'

async function auth(){const s=await getSession();if(!s)return{error:NextResponse.json({error:'No autorizado'},{status:401})};return{session:s}}
function data(b){return{full_name:String(b.full_name||'').trim(),identification:String(b.identification||'').trim(),phone:String(b.phone||'').trim(),active:b.active!==false}}

export async function GET(){const a=await auth();if(a.error)return a.error;const rows=await sql`SELECT id,full_name,identification,phone,active,created_at,updated_at FROM public.coffee_labor_workers ORDER BY active DESC,full_name`;return NextResponse.json({workers:rows})}

export async function POST(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const x=data(await req.json());if(!x.full_name)return NextResponse.json({error:'El nombre del peón es requerido.'},{status:400});const r=await sql`INSERT INTO public.coffee_labor_workers(full_name,identification,phone,active,created_by,updated_by) VALUES(${x.full_name},${x.identification||null},${x.phone||null},true,${a.session.id},${a.session.id}) RETURNING id`;return NextResponse.json({ok:true,id:r[0]?.id})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo registrar el peón de labores.'},{status:500})}}

export async function PATCH(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const b=await req.json(),id=Number(b.id),x=data(b);if(!id||!x.full_name)return NextResponse.json({error:'Registro y nombre requeridos.'},{status:400});await sql`UPDATE public.coffee_labor_workers SET full_name=${x.full_name},identification=${x.identification||null},phone=${x.phone||null},active=${x.active},updated_by=${a.session.id},updated_at=now() WHERE id=${id}`;return NextResponse.json({ok:true})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo actualizar el peón de labores.'},{status:500})}}
