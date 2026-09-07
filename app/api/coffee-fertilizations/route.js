import {NextResponse} from'next/server'
import {sql} from'../../../lib/db'
import {getSession} from'../../../lib/auth'

const METHODS=['Dron','Manual','Maquina estacionaria']
async function auth(){const s=await getSession();if(!s)return{error:NextResponse.json({error:'No autorizado'},{status:401})};return{session:s}}
function productsOf(b){const src=Array.isArray(b.products)?b.products:[];return src.map(p=>({product_name:String(p.product_name||'').trim(),quantity:Number(p.quantity),unit:String(p.unit||'').trim(),unit_cost:Number(p.unit_cost||0)})).filter(p=>p.product_name||p.quantity||p.unit_cost)}
function payload(b){const products=productsOf(b),application_cost=Number(b.application_cost||0),product_cost=products.reduce((s,p)=>s+p.quantity*p.unit_cost,0);return{application_date:String(b.application_date||'').slice(0,10),farm_id:Number(b.farm_id),method:String(b.method||''),products,treated_area_ha:b.treated_area_ha===''||b.treated_area_ha==null?null:Number(b.treated_area_ha),application_cost,total_cost:product_cost+application_cost,responsible:String(b.responsible||'').trim(),notes:String(b.notes||'').trim()}}
function validate(x){if(!x.application_date||!x.farm_id||!METHODS.includes(x.method))return'Fecha, finca y método son requeridos.';if(!x.products.length)return'Debe registrar al menos un producto.';for(const p of x.products){if(!p.product_name)return'Cada producto debe tener nombre.';if(!(p.quantity>0))return'La cantidad de cada producto debe ser mayor que cero.';if(!p.unit)return'Cada producto debe tener unidad.';if(p.unit_cost<0)return'El costo de cada producto no puede ser negativo.'}if(x.treated_area_ha!=null&&!(x.treated_area_ha>0))return'El área tratada debe ser mayor que cero.';if(x.application_cost<0)return'El costo de aplicación no puede ser negativo.';return''}

export async function GET(){const a=await auth();if(a.error)return a.error;const rows=await sql`
 SELECT r.*,COALESCE((SELECT json_agg(json_build_object('id',p.id,'product_name',p.product_name,'quantity',p.quantity,'unit',p.unit,'unit_cost',p.unit_cost,'subtotal',p.quantity*p.unit_cost) ORDER BY p.id) FROM public.coffee_fertilization_products p WHERE p.fertilization_id=r.id),'[]'::json) AS product_list
 FROM public.coffee_fertilization_report r ORDER BY r.application_date DESC,r.id DESC`;return NextResponse.json({fertilizations:rows})}

export async function POST(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const x=payload(await req.json()),e=validate(x);if(e)return NextResponse.json({error:e},{status:400});const first=x.products[0],productsJson=JSON.stringify(x.products);const rows=await sql`
 WITH ins AS (
  INSERT INTO public.coffee_fertilizations(application_date,farm_id,method,product_name,quantity,unit,treated_area_ha,total_cost,application_cost,responsible,notes,created_by,updated_by)
  VALUES(${x.application_date},${x.farm_id},${x.method},${first.product_name},${first.quantity},${first.unit},${x.treated_area_ha},${x.total_cost},${x.application_cost},${x.responsible||null},${x.notes||null},${a.session.id},${a.session.id}) RETURNING id
 ),prod AS (
  INSERT INTO public.coffee_fertilization_products(fertilization_id,product_name,quantity,unit,unit_cost)
  SELECT ins.id,p.product_name,p.quantity,p.unit,p.unit_cost FROM ins CROSS JOIN jsonb_to_recordset(${productsJson}::jsonb) AS p(product_name text,quantity numeric,unit text,unit_cost numeric)
  RETURNING fertilization_id
 ) SELECT id FROM ins`;return NextResponse.json({ok:true,id:rows[0]?.id,products:x.products.length,total_cost:x.total_cost})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo registrar la atomización.'},{status:500})}}

export async function PATCH(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const b=await req.json(),id=Number(b.id),x=payload(b),e=validate(x);if(!id)return NextResponse.json({error:'Registro requerido.'},{status:400});if(e)return NextResponse.json({error:e},{status:400});const first=x.products[0],productsJson=JSON.stringify(x.products);await sql`
 WITH upd AS (
  UPDATE public.coffee_fertilizations SET application_date=${x.application_date},farm_id=${x.farm_id},method=${x.method},product_name=${first.product_name},quantity=${first.quantity},unit=${first.unit},treated_area_ha=${x.treated_area_ha},total_cost=${x.total_cost},application_cost=${x.application_cost},responsible=${x.responsible||null},notes=${x.notes||null},updated_by=${a.session.id},updated_at=now() WHERE id=${id} RETURNING id
 ),del AS (
  DELETE FROM public.coffee_fertilization_products p USING upd WHERE p.fertilization_id=upd.id RETURNING p.id
 ),prod AS (
  INSERT INTO public.coffee_fertilization_products(fertilization_id,product_name,quantity,unit,unit_cost)
  SELECT upd.id,p.product_name,p.quantity,p.unit,p.unit_cost FROM upd CROSS JOIN jsonb_to_recordset(${productsJson}::jsonb) AS p(product_name text,quantity numeric,unit text,unit_cost numeric)
  RETURNING fertilization_id
 ) SELECT id FROM upd`;return NextResponse.json({ok:true,products:x.products.length,total_cost:x.total_cost})}catch(e){console.error(e);return NextResponse.json({error:'No se pudo actualizar la atomización.'},{status:500})}}
