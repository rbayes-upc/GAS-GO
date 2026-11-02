/* GAS&GO v2.4.6 · simulación de ocupación por punto y potencia real RIPREE.
   El CSV aporta número de puntos y potencia máxima de sus conectores (kW), NO
   ocupación, energía por sesión (kWh), autonomía, cola o potencia efectiva.
   Estas últimas magnitudes se simulan y se identifican como tales. */
(function(){'use strict';
const minutes=n=>Math.max(0,Math.ceil(n));
const spanish=n=>Number(n).toLocaleString('es-ES');
const fuelFor=()=>filterFuel==='Todos'?data.fuel:filterFuel;
const electricFor=s=>fuelFor()==='Eléctrico';
const TARGETS=[10,20,30,40,60];
let targetKWh=30;
try{const n=Number(sessionStorage.getItem('gg-demo-energy'));if(TARGETS.includes(n))targetKWh=n}catch(e){}
function setEnergy(n){n=Number(n);if(!TARGETS.includes(n))return;targetKWh=n;try{sessionStorage.setItem('gg-demo-energy',String(n))}catch(e){}}
function energyOptions(){return TARGETS.map(n=>`<option value="${n}" ${targetKWh===n?'selected':''}>${n} kWh (demo)</option>`).join('')}
const seedOf=s=>String(s.evSourceKey||s.officialId||s.id||'demo');
const hash=str=>{let h=2166136261;for(let i=0;i<String(str).length;i++)h=Math.imul(h^String(str).charCodeAt(i),16777619);return h>>>0};
function compatible(s,ev=electricFor(s)){return ev?Number(s.ev)>0:(fuelFor()==='Diésel'?s.diesel!=null:s.gas!=null)}
function capacity(s,ev=electricFor(s)){return Math.max(0,Math.floor(Number(ev?s.evTotal:s.total)||0))}
function free(s,ev=electricFor(s)){return Math.max(0,Math.min(capacity(s,ev),Math.floor(Number(ev?s.evFree:s.free)||0)))}
function occupied(s,ev=electricFor(s)){return Math.max(0,capacity(s,ev)-free(s,ev))}
function published(s){return !!s.realElectric&&s.evOrigin==='ripree'}
// Cada potencia y recuento se toman sin cambiar de evPowerLevels, generado desde el CSV.
// Una instalación puede tener, por ejemplo, dos puntos a 150 kW y tres a 22 kW.
function powerGroups(s){
 const count=capacity(s,true),res=[];if(!count)return res;
 if(published(s)){
  let seen=0;
  for(const item of Array.isArray(s.evPowerLevels)?s.evPowerLevels:[]){
   const kw=Number(item[0]),qty=Math.floor(Number(item[1]));
   if(!Number.isFinite(qty)||qty<=0)continue;
   for(let i=0;i<qty&&seen<count;i++,seen++)res.push(Number.isFinite(kw)&&kw>0?kw:null);
  }
  while(res.length<count)res.push(null);
 }else{
  const kw=Number(s.kw),p=Number.isFinite(kw)&&kw>0?kw:null;
  for(let i=0;i<count;i++)res.push(p);
 }
 return res;
}
// Se usa un reparto reproducible de los libres entre potencias, que cambia con
// las actualizaciones ficticias de ocupación, sin alterar recuentos publicados.
function slots(s){
 const powers=powerGroups(s),id=seedOf(s),step=typeof occupationTick==='number'?occupationTick:0;
 const ranked=powers.map((kw,i)=>({kw,i,rank:hash(id+'|plaza|'+i+'|'+Math.floor(step/2))})).sort((a,b)=>a.rank-b.rank);
 const available=new Set(ranked.slice(0,free(s,true)).map(o=>o.i));
 return powers.map((kw,i)=>({kw,index:i,available:available.has(i)}));
}
function chargingMinutes(kw,kwh=targetKWh){
 // La potencia publicada es un máximo. Se supone un vehículo demo de hasta
 // 150 kW de admisión y un rendimiento medio ficticio del 82 %.
 if(!Number.isFinite(Number(kw))||Number(kw)<=0)return Infinity;
 const effective=Math.min(Number(kw),150)*.82;
 return minutes(3+kwh/effective*60);
}
function remainingMinutes(s,slot){
 // Energía restante hipotética entre 8 y 38 kWh por vehículo que ya carga.
 const epoch=typeof occupationTick==='number'?Math.floor(occupationTick/4):0;
 const n=hash(seedOf(s)+'|ocupado|'+slot.index+'|'+epoch);
 return chargingMinutes(slot.kw,8+n%31);
}
function plan(s){
 const list=slots(s),n=capacity(s,true),f=free(s,true);
 if(!n)return {wait:Infinity,duration:Infinity,kw:null,energy:targetKWh,free:f,known:false};
 const options=list.map(slot=>{
  const charging=chargingMinutes(slot.kw),waiting=slot.available?0:remainingMinutes(s,slot);
  return {kw:slot.kw,wait:waiting,duration:charging,known:Number.isFinite(charging)&&Number.isFinite(waiting),index:slot.index};
 });
 // Calculamos el tiempo más breve hasta terminar: puede convenir esperar por
 // uno de 150 kW en lugar de empezar inmediatamente en otro de 7,4 kW.
 const known=options.filter(o=>o.known);
 // Si hay puntos libres, la espera es siempre cero; elegimos el más rápido
 // de entre los disponibles y no esperamos innecesariamente por otro ocupado.
 const available=known.filter(o=>o.wait===0);
 if(f>0&&!available.length)return {wait:0,duration:Infinity,kw:null,energy:targetKWh,free:f,known:false};
 const candidates=f>0?available:known;
 candidates.sort((a,b)=>(a.wait+a.duration)-(b.wait+b.duration)||a.wait-b.wait||b.kw-a.kw);
 if(candidates.length){const p=candidates[0];return {...p,energy:targetKWh,free:f,known:true}}
 return {wait:Infinity,duration:Infinity,kw:null,energy:targetKWh,free:f,known:false};
}
function duration(s,ev=electricFor(s)){
 if(ev)return plan(s).duration;
 return Math.max(2,minutes((Number(s.time)||240)/60));
}
function wait(s,ev=electricFor(s)){
 if(!capacity(s,ev))return Infinity;
 if(ev)return plan(s).wait;
 if(free(s,false)>0)return 0;
 const seed=hash(seedOf(s));return Math.max(2,minutes(duration(s,false)*.4+(seed%4)));
}
function travel(s){const km=Math.max(0,Number(s.dist)||0);return Math.max(1,minutes(km/28*60+2))}
function total(s,ev=electricFor(s)){
 if(!compatible(s,ev)||!capacity(s,ev))return Infinity;
 if(ev){const p=plan(s);return p.known?travel(s)+p.wait+p.duration:Infinity}
 return travel(s)+wait(s,ev)+duration(s,ev);
}
function serviceText(s,ev){const c=capacity(s,ev),f=free(s,ev),o=occupied(s,ev);if(!c)return ev?'Sin puntos de carga':'Sin surtidores';return `${c} ${ev?'puntos':'surtidores'} · ${f} libres · ${o} ocupados`}
function tiersText(s){
 const counts=new Map();for(const kw of powerGroups(s)){const key=kw===null?'?':String(kw);counts.set(key,(counts.get(key)||0)+1)}
 return [...counts.entries()].sort((a,b)=>Number(b[0])-Number(a[0])).map(([k,n])=>k==='?'?`${n} sin potencia publicada`:`${n} × ${Number(k).toLocaleString('es-ES',{maximumFractionDigits:2})} kW`).join(' · ');
}
function metrics(s,requested=electricFor(s)){
 const ev=requested?capacity(s,true)>0||capacity(s,false)===0:capacity(s,false)===0&&capacity(s,true)>0;
 const c=capacity(s,ev),p=ev?plan(s):null,w=ev?p.wait:wait(s,ev),d=ev?p.duration:duration(s,ev),t=total(s,electricFor(s));
 const label=ev?(published(s)?'Puntos RIPREE (reales)':'Puntos de carga demo'):'Surtidores demo';
 const disp=n=>Number.isFinite(n)?`≈ ${spanish(n)} min`:'Sin estimación';
 return `<div class="gg245-metrics" aria-label="Estimaciones ficticias de GAS&GO">
 <div class="gg245-capacity"><span class="gg245-label">${label} · ocupación simulada</span><b>${serviceText(s,ev)}</b></div>
 ${ev?`<div class="gg246-power"><small>${published(s)?'Potencias publicadas por punto':'Potencia de prueba por punto'}</small><b>${tiersText(s)||'No disponible'}</b></div>`:''}
 <div class="gg245-metricrow">
  <div><small>Espera simulada</small><strong>${!c?'—':w===0?'Sin espera':disp(w)}</strong></div>
  <div><small>${ev?`Recargar ${targetKWh} kWh (demo)`:'Repostaje medio demo'}</small><strong>${disp(d)}</strong></div>
  ${ev?`<div class="gg246-power-choice"><small>Potencia del punto elegido</small><strong>${p.known?`${p.kw.toLocaleString('es-ES',{maximumFractionDigits:2})} kW`:'No publicada'}</strong></div>`:''}
  <div class="gg245-total"><small>Trayecto + espera + suministro</small><strong>${Number.isFinite(t)?disp(t):'Sin estimación'}</strong></div>
 </div>
 ${!ev&&s.evTotal>0?`<div class="gg245-other">⚡ Carga: ${serviceText(s,true)} (ocupación simulada)</div>`:''}
 <div class="gg245-caveat">${ev?'La cantidad de puntos y sus potencias son '+(published(s)?'del CSV RIPREE.':'de demostración.')+' El cálculo elige el punto con menor tiempo combinado de espera y carga. Energía objetivo, puntos libres, carga pendiente, pérdidas y límite del vehículo (150 kW): supuestos ficticios. ':''}Trayecto aproximado con distancia en línea recta y 28 km/h; no son tiempos ni ocupación en directo.</div>
 </div>`;
}
function sortScore(s,key){if(key==='fastest')return total(s);if(key==='wait')return compatible(s)?wait(s):Infinity;if(key==='time')return compatible(s)?duration(s):Infinity;return Number(s.dist)||0}
const sortChoices=[['dist','Distancia'],['fastest','Menor tiempo total (demo)'],['wait','Menor espera (demo)'],['time','Suministro más corto (demo)'],['price','Precio'],['free','Disponibilidad demo']];
const sortOptions=()=>sortChoices.map(([v,l])=>`<option value="${v}" ${mapSort===v?'selected':''}>${l}</option>`).join('');
window.ggTiming={electricFor,compatible,capacity,free,occupied,slots,powerGroups,tiersText,chargingMinutes,plan,wait,duration,travel,total,serviceText,metrics,sortScore,sortOptions,setEnergy,energy:()=>targetKWh,energyOptions};
})();
