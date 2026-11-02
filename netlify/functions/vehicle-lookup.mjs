/* GAS&GO v2.6.7 — consulta servidor-servidor mediante APIVehículo.
   La clave APIVEHICULO_KEY NUNCA se expone en HTML, JS de navegador o ZIP.
   Respuesta reducida: sin datos personales, VIN, titular ni historial. */
const allow = /^[0-9]{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
const result = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const str=(v,limit=80)=>typeof v==='string'?v.trim().slice(0,limit):'';
function normalizedFuel(raw){
 const f=String(raw||'').toLowerCase();
 if(/electr|battery/.test(f)&&!/hybrid|h[ií]brid/.test(f))return 'Eléctrico';
 if(/diesel|di[eé]sel|gasoil/.test(f)&&!/hybrid|h[ií]brid/.test(f))return 'Diésel';
 if(/petrol|gasoline|gasolina|benzine/.test(f)&&!/hybrid|h[ií]brid/.test(f))return 'Gasolina 95';
 // Híbridos, GLP, GNC y variantes que no permiten determinar producto de repostaje.
 return '';
}
function normalizedKind(body){
 const kind=String(body||'').toLowerCase();
 if(/motorcycle|motorbike|motocicl|scooter|ciclomotor/.test(kind))return 'Moto';
 if(/van|furgoneta|light commercial/.test(kind))return 'Furgoneta';
 return 'Coche';
}
export default async (request) => {
 if(request.method!=='POST')return result({ok:false,message:'Usa POST.'},405);
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return result({ok:false,message:'Se requiere JSON.'},415);
 let input;
 try{input=await request.json()}catch(e){return result({ok:false,message:'Solicitud inválida.'},400)}
 const plate=String(input?.plate||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(!allow.test(plate))return result({ok:false,message:'Formato de matrícula española no admitido por esta consulta.'},400);
 const key=process.env.APIVEHICULO_KEY;
 if(!key)return result({ok:false,message:'La consulta de matrículas todavía no está activada: falta configurar APIVEHICULO_KEY en Netlify.'},503);
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),9500);
 try{
   const uri='https://api.apivehiculo.com/v1/vehicles/lookup?'+new URLSearchParams({plate,country:'ES'});
   const upstream=await fetch(uri,{headers:{'Authorization':'Bearer '+key,'Accept':'application/json'},signal:controller.signal});
   if(upstream.status===404)return result({ok:false,message:'Matrícula no encontrada en el proveedor.'},404);
   if(upstream.status===429)return result({ok:false,message:'Se alcanzó el límite de consultas contratado.'},429);
   if(upstream.status===401||upstream.status===403)return result({ok:false,message:'La credencial del proveedor no está autorizada.'},502);
   if(!upstream.ok)return result({ok:false,message:'El proveedor de vehículos no ha podido completar la consulta.'},502);
   const payload=await upstream.json(),d=payload?.data;
   if(!d||typeof d!=='object'||!d.brand||!d.model)return result({ok:false,message:'El proveedor no devolvió suficientes datos para identificar el modelo.'},422);
   return result({ok:true,vehicle:{plate,brand:str(d.brand,55),model:str(d.model),version:str(d.version),fuel:normalizedFuel(d.fuelType),rawFuel:str(d.fuelType,55),kind:normalizedKind(d.bodyType),firstRegistrationDate:str(d.firstRegistrationDate,18),source:'APIVehículo'}});
 }catch(err){return result({ok:false,message:err?.name==='AbortError'?'El proveedor ha tardado demasiado en responder.':'No se pudo comunicar con el proveedor de vehículos.'},504)}
 finally{clearTimeout(timer)}
};
