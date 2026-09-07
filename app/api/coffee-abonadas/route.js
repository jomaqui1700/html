import {NextResponse} from'next/server'
import {sql} from'../../../lib/db'
import {getSession} from'../../../lib/auth'

async function auth(){const s=await getSession();if(!s)return{error:NextResponse.json({error:'No autorizado'},{status:401})};return{session:s}}
function productsOf(b){const src=Array.isArray(b.products)?b.products:[];return src.map(p=>({product_name:String(p.product_name||'').trim(),quantity:Number(p.quantity),unit:String(p.unit||'').trim()})).filter(p=>p.product_name||p.quantity||p.unit)}
function payload(b){return{application_date:String(b.application_date||'').slice(0,10),farm_id:Number(b.farm_id),products:productsOf(b),treated_area_ha:b.treated_area_ha===''||b.treated_area_ha==null?null:Number(b.treated_area_ha),total_cost:Number(b.total_cost||0),responsible:String(b.responsible||'').trim(),notes:String(b.notes||'').trim()}}
function validate(x){if(!x.application_date||!x.farm_id)return'Fecha y finca son requeridas.';if(!x.products.length)return'Debe registrar al menos un fertilizante.';for(const p of x.products){if(!p.product_name)return'Cada fertilizante debe tener nombre.';if(!(p.quantity>0))return'La cantidad de cada fertilizante debe ser mayor que cero.';if(!p.unit)return'Cada fertilizante debe tener unidad.'}if(x.treated_area_ha!=null&&!(x.treated_area_ha>0))return'El área abonada debe ser mayor que cero.';if(x.total_cost<0)return'El costo no puede ser negativo.';return''}

export async function GET(){const a=await auth();if(a.error)return a.error;const rows=await sql`
 SELECT r.*,COALESCE((SELECT json_agg(json_build_object('id',p.id,'product_name',p.product_name,'quantity',p.quantity,'unit',p.unit) ORDER BY p.id) FROM public.coffee_abonada_products p WHERE p.abonada_id=r.id),'[]'::json) AS product_list
 FROM public.coffee_abonada_report r ORDER BY r.application_date DESC,r.id DESC`;return NextResponse.json({abonadas:rows})}

export async function POST(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const x=payload(await req.json()),e=validate(x);if(e)return NextResponse.json({error:e},{status:400});const productsJson=JSON.stringify(x.products);const rows=await sql`
 WITH ins AS (
   INSERT INTO public.coffee_abonadas(application_date,farm_id,method,treated_area_ha,total_cost,responsible,notes,created_by,updated_by)
   VALUES(${x.application_date},${x.farm_id},'Manual',${x.treated_area_ha},${x.total_cost},${x.responsible||null},${x.notes||null},${a.session.id},${a.session.id}) RETURNING id
 ), prod AS (
   INSERT INTO public.coffee_abonada_products(abonada_id,product_name,quantity,unit)
   SELECT ins.id,p.product_name,p.quantity,p.unit FROM ins CROSS JOIN jsonb_to_recordset(${productsJson}::jsonb) AS p(product_name text,quantity numeric,unit text)
   RETURNING abonada_id
 ) SELECT id FROM ins`;return NextResponse.json({ok:true,id:rows[0]?.id,products:x.products.length})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo registrar la abonada.'},{status:500})}}

export async function PATCH(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const b=await req.json(),id=Number(b.id),x=payload(b),e=validate(x);if(!id)return NextResponse.json({error:'Registro requerido.'},{status:400});if(e)return NextResponse.json({error:e},{status:400});const productsJson=JSON.stringify(x.products);await sql`
 WITH upd AS (
   UPDATE public.coffee_abonadas SET application_date=${x.application_date},farm_id=${x.farm_id},method='Manual',treated_area_ha=${x.treated_area_ha},total_cost=${x.total_cost},responsible=${x.responsible||null},notes=${x.notes||null},updated_by=${a.session.id},updated_at=now() WHERE id=${id} RETURNING id
 ), del AS (
   DELETE FROM public.coffee_abonada_products p USING upd WHERE p.abonada_id=upd.id RETURNING p.id
 ), prod AS (
   INSERT INTO public.coffee_abonada_products(abonada_id,product_name,quantity,unit)
   SELECT upd.id,p.product_name,p.quantity,p.unit FROM upd CROSS JOIN jsonb_to_recordset(${productsJson}::jsonb) AS p(product_name text,quantity numeric,unit text)
   RETURNING abonada_id
 ) SELECT id FROM upd`;return NextResponse.json({ok:true,products:x.products.length})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo actualizar la abonada.'},{status:500})}}
