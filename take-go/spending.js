/* Límites de demostración: periodos naturales en Europe/Madrid, importes en céntimos. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TakeGoSpending=factory()})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const PERIODS=[['daily','Diario'],['weekly','Semanal'],['monthly','Mensual']];
const empty=()=>({daily:null,weekly:null,monthly:null});
function valid(l){return l&&PERIODS.every(([k])=>l[k]===null||(Number.isSafeInteger(l[k])&&l[k]>=0&&l[k]<=99999999))}
function normalize(l){return valid(l)?{daily:l.daily,weekly:l.weekly,monthly:l.monthly}:empty()}
function keys(at){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)),get=k=>parts.find(p=>p.type===k).value;const day=`${get('year')}-${get('month')}-${get('day')}`,d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return {daily:day,weekly:d.toISOString().slice(0,10),monthly:day.slice(0,7)}}
function report(receipts,limits,now=Date.now(),purchase=0){const current=keys(now),spent={daily:0,weekly:0,monthly:0},seen=new Set();for(const r of receipts||[]){if(!r||seen.has(r.id)||r.simulated!==true||!Number.isSafeInteger(r.totalCents)||r.totalCents<0||!Number.isFinite(r.paidAt)||r.paidAt>now)continue;seen.add(r.id);const periods=keys(r.paidAt);for(const [k] of PERIODS)if(periods[k]===current[k])spent[k]+=r.totalCents}const l=normalize(limits);return PERIODS.map(([key,label])=>({key,label,spent:spent[key],limit:l[key],remaining:l[key]===null?null:Math.max(0,l[key]-spent[key]),projected:spent[key]+purchase,exceeded:l[key]!==null&&spent[key]+purchase>l[key]}))}
return {PERIODS,empty,valid,normalize,keys,report};
});
