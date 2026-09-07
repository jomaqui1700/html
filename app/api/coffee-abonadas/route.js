import {NextResponse} from'next/server'
import {sql} from'../../../lib/db'
import {getSession} from'../../../lib/auth'

async function auth(){const s=await getSession();if(!s)return{error:NextResponse.json({error:'No autorizado'},{status:401})};return{session:s}}
function productsOf(b){const src=Array.isArray(b.products)?b.products:[];return src.map(p=>({product_name:String(p.product_name||'').trim(),quantity:Number(p.quantity),unit:'sacos',price_per_sack:Number(p.price_per_sack||0)})).filter(p=>p.product_name||p.quantity||p.price_per_sack)}
function payload(b){const products=productsOf(b),total_cost=products.reduce((s,p)=>s+p.quantity*p.price_per_sack,0);return{application_date:String(b.application_date||'').slice(0,10),farm_id:Number(b.farm_id),products,treated_area_ha:b.treated_area_ha===''||b.treated_area_ha==null?null:Number(b.treated_area_ha),total_cost,responsible:String(b.responsible||'').trim(),notes:String(b.notes||'').trim()}}
function validate(x){if(!x.application_date||!x.farm_id)return'Fecha y finca son requeridas.';if(!x.products.length)return'Debe registrar al menos un abono.';for(const p of x.products){if(!p.product_name)return'Cada abono debe tener nombre.';if(!(p.quantity>0))return'La cantidad de sacos debe ser mayor que cero.';if(p.price_per_sack<0)return'El precio por saco no puede ser negativo.'}if(x.treated_area_ha!=null&&!(x.treated_area_ha>0))return'El área abonada debe ser mayor que cero.';return''}

export async function GET(){const a=await auth();if(a.error)return a.error;const rows=await sql`
 SELECT r.*,COALESCE((SELECT json_agg(json_build_object('id',p.id,'product_name',p.product_name,'quantity',p.quantity,'unit',p.unit,'price_per_sack',p.price_per_sack,'subtotal',p.quantity*p.price_per_sack) ORDER BY p.id) FROM public.coffee_abonada_products p WHERE p.abonada_id=r.id),'[]'::json) AS product_list
 FROM public.coffee_abonada_report r ORDER BY r.application_date DESC,r.id DESC`;return NextResponse.json({abonadas:rows})}

export async function POST(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const x=payload(await req.json()),e=validate(x);if(e)return NextResponse.json({error:e},{status:400});const productsJson=JSON.stringify(x.products);const rows=await sql`
 WITH ins AS (
   INSERT INTO public.coffee_abonadas(application_date,farm_id,method,treated_area_ha,total_cost,responsible,notes,created_by,updated_by)
   VALUES(${x.application_date},${x.farm_id},'Manual',${x.treated_area_ha},${x.total_cost},${x.responsible||null},${x.notes||null},${a.session.id},${a.session.id}) RETURNING id
 ),prod AS (
   INSERT INTO public.coffee_abonada_products(abonada_id,product_name,quantity,unit,price_per_sack)
   SELECT ins.id,p.product_name,p.quantity,'sacos',p.price_per_sack FROM ins CROSS JOIN jsonb_to_recordset(${productsJson}::jsonb) AS p(product_name text,quantity numeric,unit text,price_per_sack numeric)
   RETURNING abonada_id
 ) SELECT id FROM ins`;return NextResponse.json({ok:true,id:rows[0]?.id,products:x.products.length,total_cost:x.total_cost})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo registrar la abonada.'},{status:500})}}

export async function PATCH(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const b=await req.json(),id=Number(b.id),x=payload(b),e=validate(x);if(!id)return NextResponse.json({error:'Registro requerido.'},{status:400});if(e)return NextResponse.json({error:e},{status:400});const productsJson=JSON.stringify(x.products);await sql`
 WITH upd AS (
   UPDATE public.coffee_abonadas SET application_date=${x.application_date},farm_id=${x.farm_id},method='Manual',treated_area_ha=${x.treated_area_ha},total_cost=${x.total_cost},responsible=${x.responsible||null},notes=${x.notes||null},updated_by=${a.session.id},updated_at=now() WHERE id=${id} RETURNING id
 ),del AS (
   DELETE FROM public.coffee_abonada_products p USING upd WHERE p.abonada_id=upd.id RETURNING p.id
 ),prod AS (
   INSERT INTO public.coffee_abonada_products(abonada_id,product_name,quantity,unit,price_per_sack)
   SELECT upd.id,p.product_name,p.quantity,'sacos',p.price_per_sack FROM upd CROSS JOIN jsonb_to_recordset(${productsJson}::jsonb) AS p(product_name text,quantity numeric,unit text,price_per_sack numeric)
   RETURNING abonada_id
 ) SELECT id FROM upd`;return NextResponse.json({ok:true,products:x.products.length,total_cost:x.total_cost})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo actualizar la abonada.'},{status:500})}}
