/* Analítica ficticia del servicio GAS&GO. No se leen datos de la app ni del surtidor. */
(function(){'use strict';
const snapshot='2026-11-09T13:42:00+01:00',cutoff=Date.parse(snapshot);
const stations=[
 {id:'diagonal',name:'Diagonal',code:'BCN · 01',address:'Av. Diagonal, 670',city:'Barcelona · Les Corts',counts:{completed:108,active:3,identifying:2,link_failed:1,authorization_failed:1,abandoned:2},invoiceFailures:1},
 {id:'meridiana',name:'Meridiana',code:'BCN · 02',address:'Av. Meridiana, 276',city:'Barcelona · Sant Andreu',counts:{completed:79,active:2,identifying:2,link_failed:3,authorization_failed:2,abandoned:3},invoiceFailures:2},
 {id:'aeroport',name:'Aeroport',code:'BCN · 03',address:'Ctra. de l’Aeroport, 14',city:'El Prat de Llobregat',counts:{completed:69,active:2,identifying:1,link_failed:2,authorization_failed:1,abandoned:3},invoiceFailures:0}
];
const sessions=[];
stations.forEach((s,site)=>{
 let rank=0,failedInvoices=0;
 Object.entries(s.counts).forEach(([status,count])=>{for(let i=0;i<count;i++,rank++){
  const method=rank%10<8?'A':rank%10===8?'B':'C',identification=650+(rank%4)*230,authorization=method==='A'?1200+(rank%6)*370:method==='B'?6500+(rank%5)*1100:17000+(rank%5)*1700;
  const product=rank%5===0?'Electricidad':rank%3===0?'Diésel':'Gasolina 95',unit=product==='Electricidad'?'kWh':'L',price=product==='Electricidad'?.4:product==='Diésel'?1.52:1.6;
  const duration=product==='Electricidad'?600000+(rank%6)*90000:65000+(rank%7)*15000;
  const stage=status==='abandoned'?['linked','identified','authorized','supplying'][(i+site)%4]:null;
  const start=status==='completed'?cutoff-(rank*270000+90000+duration+authorization+identification):status==='active'?cutoff-(150000+i*16000):status==='identifying'?cutoff-(2500+i*300):cutoff-(900000+i*120000+site*60000);
  const events=[],event=(name,at,extra={})=>events.push({name,at:new Date(at).toISOString(),...extra});
  event('session_started',start);
  if(status==='link_failed')event('link_failed',start+15000,{code:'LINK_TIMEOUT'});
  else{
   event('device_linked',start+250);
   if(status!=='identifying'&&stage!=='linked'){
    event('vehicle_identified',start+identification);event('authorization_requested',start+identification+100);
    if(status==='authorization_failed')event('authorization_failed',start+identification+20000,{code:'AUTH_TIMEOUT'});
    else if(stage!=='identified'){
     event('authorization_succeeded',start+identification+authorization,{method});
     if(stage!=='authorized'){
      event('supply_started',start+identification+authorization+3000);
      if(status==='completed'){
       const finish=start+identification+authorization+3000+duration;event('supply_finished',finish);
       if(failedInvoices<s.invoiceFailures){failedInvoices++;event('invoice_failed',finish+500,{code:'PDF_ERROR'})}
       else{event('invoice_generated',finish+500);if(rank%3===0)event('invoice_download_requested',finish+2000)}
      }
     }
    }
   }
   if(status==='abandoned')event('session_abandoned',start+180000,{stage});
  }
  const identified=events.some(e=>e.name==='vehicle_identified'),supplied=events.some(e=>e.name==='supply_started'),quantity=supplied?Number(((status==='completed'?18:6)+(rank*7%230)/10).toFixed(2)):0;
  sessions.push({id:'GG-'+String(3000+site*500+rank),station:s.id,equipment:(product==='Electricidad'?'E0':'S0')+(rank%(product==='Electricidad'?2:4)+1),status,method,product,unit,quantity,amount:Number((quantity*price).toFixed(2)),userId:identified?(rank%4<2?'U-'+String((rank*7+site*3)%20+1).padStart(3,'0'):'U-'+(1000+site*200+rank)):null,plate:identified?'•••• '+['MTR','BCD','FGH','JKL','MNP','EVG'][rank%6]:null,events});
 }});
});
// Historial de sesiones ficticias: mismo esquema de eventos, sin extraer datos de la app.
// Se reparten durante el día; los filtros recortan los eventos al corte consultado.
const archivedSessions=[];
for(let ago=1;ago<=13;ago++){
 const dayStart=Date.parse('2026-11-09T00:00:00+01:00')-ago*86400000;
 for(const [site,station] of stations.entries()){
  const source=sessions.filter(s=>s.station===station.id&&!['active','identifying'].includes(s.status));
  const factor=[.92,.87,1.02,.84,.95,.9,.81][(ago+site)%7],count=Math.floor(source.length*factor);
  for(let i=0;i<count;i++){
   const original=source[(i+ago*7)%source.length],base=Date.parse(original.events[0].at),start=dayStart+3600000+Math.round(i/Math.max(1,count-1)*21*3600000),quantity=Number((original.quantity*(1+(ago%5-2)*.02)).toFixed(2));
   archivedSessions.push({...original,id:original.id+'-D'+ago+'-'+i,quantity,amount:original.quantity?Number((original.amount/original.quantity*quantity).toFixed(2)):0,events:original.events.map(e=>({...e,at:new Date(start+Date.parse(e.at)-base).toISOString()}))});
  }
 }
}
window.GGDashboardData={snapshot,stations:stations.map(({counts,invoiceFailures,...s})=>s),sessions,archivedSessions};
})();
