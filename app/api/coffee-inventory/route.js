import {NextResponse} from 'next/server'
import {sql} from '../../../lib/db'
import {getSession} from '../../../lib/auth'

async function auth(){const session=await getSession();if(!session)return{error:NextResponse.json({error:'No autorizado'},{status:401})};return{session}}
function cleanProduct(b){return{name:String(b.name||'').trim(),category:String(b.category||'').trim(),unit:String(b.unit||'').trim(),minimum_stock:Number(b.minimum_stock||0),unit_cost:Number(b.unit_cost||0),supplier:String(b.supplier||'').trim(),lot_number:String(b.lot_number||'').trim(),expiration_date:b.expiration_date?String(b.expiration_date).slice(0,10):null,notes:String(b.notes||'').trim()}}
function validateProduct(x){if(!x.name)return'El nombre del producto es requerido.';if(!['Abono','Atomizacion'].includes(x.category))return'Seleccione Abono o Atomización.';if(!['sacos','kg','L','ml','unidades'].includes(x.unit))return'Unidad no válida.';if(x.minimum_stock<0||x.unit_cost<0)return'Inventario mínimo y costo no pueden ser negativos.';return''}
function dbError(e){console.error('coffee-inventory',e?.code,e?.constraint,e?.message);if(e?.code==='23514')return NextResponse.json({error:'Un dato no cumple las reglas del inventario. Revise cantidad y costo.'},{status:400});if(e?.code==='23503')return NextResponse.json({error:'El producto o usuario ya no existe. Actualice la página e intente nuevamente.'},{status:400});return NextResponse.json({error:`No se pudo guardar el inventario. Código técnico: ${e?.code||'DB'}.`},{status:500})}

export async function GET(){const a=await auth();if(a.error)return a.error;try{const products=await sql`SELECT * FROM public.coffee_inventory_summary ORDER BY active DESC,category,product_name`;const movements=await sql`SELECT m.*,i.name AS product_name,i.category,i.unit,i.lot_number,i.expiration_date,f.name AS farm_name,u.full_name AS created_by_name,CASE WHEN m.reference_type='abonada' THEN 'Abonada' WHEN m.reference_type='atomizacion' THEN 'Atomización' WHEN m.reference_type IS NOT NULL THEN m.reference_type ELSE CASE WHEN m.movement_type='entrada' THEN 'Ingreso / compra' ELSE 'Movimiento de inventario' END END AS reference_label FROM public.coffee_inventory_movements m JOIN public.coffee_inventory i ON i.id=m.inventory_id LEFT JOIN public.farms f ON f.id=m.farm_id LEFT JOIN public.users u ON u.id=m.created_by ORDER BY m.created_at DESC,m.id DESC LIMIT 500`;return NextResponse.json({products,movements})}catch(e){return dbError(e)}}

export async function POST(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const b=await req.json();
 if(b.action==='entrada'){
  const id=Number(b.inventory_id),quantity=Number(b.quantity||0),unit_cost=Number(b.unit_cost||0),movement_date=String(b.movement_date||'').slice(0,10),supplier=String(b.supplier||'').trim(),notes=String(b.notes||'').trim();
  if(!id)return NextResponse.json({error:'Seleccione el producto.'},{status:400});
  if(!movement_date)return NextResponse.json({error:'Seleccione la fecha de ingreso.'},{status:400});
  if(!(quantity>0))return NextResponse.json({error:'La cantidad debe ser mayor que cero.'},{status:400});
  if(unit_cost<0)return NextResponse.json({error:'El costo no puede ser negativo.'},{status:400});
  const r=await sql`INSERT INTO public.coffee_inventory_movements(inventory_id,movement_date,movement_type,quantity,unit_cost,farm_id,supplier,reference_type,notes,created_by) SELECT i.id,${movement_date},'entrada',${quantity},${unit_cost},NULL,${supplier||null},'compra',${notes||null},${a.session.id} FROM public.coffee_inventory i WHERE i.id=${id} AND i.active=true RETURNING id`;
  if(!r[0]?.id)return NextResponse.json({error:'Producto no encontrado o inactivo.'},{status:404});
  return NextResponse.json({ok:true,movement_id:r[0].id});
 }
 const x=cleanProduct(b),er=validateProduct(x);if(er)return NextResponse.json({error:er},{status:400});
 const r=await sql`INSERT INTO public.coffee_inventory(farm_id,name,category,unit,current_stock,minimum_stock,unit_cost,lot_number,expiration_date,supplier,active,notes,created_by,updated_by) VALUES(NULL,${x.name},${x.category},${x.unit},0,${x.minimum_stock},${x.unit_cost},${x.lot_number||null},${x.expiration_date},${x.supplier||null},true,${x.notes||null},${a.session.id},${a.session.id}) RETURNING id`;
 return NextResponse.json({ok:true,id:r[0]?.id})
 }catch(e){return dbError(e)}}

export async function PATCH(req){const a=await auth();if(a.error)return a.error;if(a.session.role!=='admin')return NextResponse.json({error:'Solo administrador.'},{status:403});try{const b=await req.json(),id=Number(b.id);if(!id)return NextResponse.json({error:'Producto requerido.'},{status:400});if(b.action==='toggle'){await sql`UPDATE public.coffee_inventory SET active=NOT active,updated_by=${a.session.id},updated_at=now() WHERE id=${id}`;return NextResponse.json({ok:true})}const x=cleanProduct(b),er=validateProduct(x);if(er)return NextResponse.json({error:er},{status:400});await sql`UPDATE public.coffee_inventory SET farm_id=NULL,name=${x.name},category=${x.category},unit=${x.unit},minimum_stock=${x.minimum_stock},unit_cost=${x.unit_cost},lot_number=${x.lot_number||null},expiration_date=${x.expiration_date},supplier=${x.supplier||null},notes=${x.notes||null},updated_by=${a.session.id},updated_at=now() WHERE id=${id}`;return NextResponse.json({ok:true})}catch(e){return dbError(e)}}
