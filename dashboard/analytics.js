/* Cálculos puros sobre los eventos ya recortados al periodo consultado. */
(function(){'use strict';
const has=(s,name)=>s.events.some(e=>e.name===name);
const stageErrors={device_linked:['link_failed'],vehicle_identified:['identification_failed'],authorization_succeeded:['authorization_failed'],supply_finished:['supply_failed','supply_interrupted'],invoice_generated:['invoice_failed']};
function transitionBucket(session,from,to){
 if(!has(session,from))return null;
 if(has(session,to))return 'advanced';
 if((stageErrors[to]||[]).some(event=>has(session,event)))return 'failed';
 if(has(session,'session_abandoned'))return 'closed';
 return 'pending';
}
function transition(rows,from,to){
 const result={from,to,total:0,advanced:[],failed:[],closed:[],pending:[]};
 for(const session of rows){const bucket=transitionBucket(session,from,to);if(bucket){result.total++;result[bucket].push(session)}}
 return result;
}
function attemptsFor(session){
 const attempts=new Map(),methods=new Set(['A','B','C']);
 for(const e of session.events){
  if(e.name==='authorization_attempt_started'&&e.attemptId&&methods.has(e.method)&&!attempts.has(e.attemptId))attempts.set(e.attemptId,{id:session.id+'/'+e.attemptId,localId:e.attemptId,sessionId:session.id,method:e.method,start:e.at,status:'pending',end:null,duration:null});
  else if(['authorization_attempt_succeeded','authorization_attempt_failed','authorization_attempt_cancelled'].includes(e.name)){
   const a=attempts.get(e.attemptId),duration=a?Date.parse(e.at)-Date.parse(a.start):NaN;
   if(a&&a.status==='pending'&&a.method===e.method&&Number.isFinite(duration)&&duration>=0){a.status=({authorization_attempt_succeeded:'succeeded',authorization_attempt_failed:'failed',authorization_attempt_cancelled:'cancelled'})[e.name];a.end=e.at;a.duration=duration}
  }
 }
 return [...attempts.values()];
}
function methodComparison(rows){
 const attempts=rows.flatMap(attemptsFor);
 return ['A','B','C'].map(method=>{
  const list=attempts.filter(a=>a.method===method),resolved=list.filter(a=>a.status==='succeeded'||a.status==='failed'),changes=rows.filter(s=>s.events.some(e=>e.name==='authorization_method_changed'&&e.from===method));
  return {method,attempts:list,started:list.length,succeeded:list.filter(a=>a.status==='succeeded').length,failed:list.filter(a=>a.status==='failed').length,cancelled:list.filter(a=>a.status==='cancelled').length,pending:list.filter(a=>a.status==='pending').length,rate:list.length?list.filter(a=>a.status==='succeeded').length/list.length*100:null,averageDuration:resolved.length?resolved.reduce((n,a)=>n+a.duration,0)/resolved.length:null,resolved:resolved.length,switchedSessions:changes.length};
 });
}
function methodChanges(rows){
 const pairs=new Map();
 for(const s of rows)for(const e of s.events){if(e.name!=='authorization_method_changed'||!['A','B','C'].includes(e.from)||!['A','B','C'].includes(e.to)||e.from===e.to)continue;const key=e.from+'-'+e.to;if(!pairs.has(key))pairs.set(key,{from:e.from,to:e.to,sessions:new Set(),authorized:new Set(),changes:0});const pair=pairs.get(key);pair.changes++;pair.sessions.add(s.id);if(s.events.some(next=>next.name==='authorization_succeeded'&&Date.parse(next.at)>Date.parse(e.at)))pair.authorized.add(s.id)}
 return [...pairs.values()].sort((a,b)=>(a.from+a.to).localeCompare(b.from+b.to)).map(p=>({...p,sessions:[...p.sessions],authorized:[...p.authorized]}));
}
function matches(session,filter){
 if(!filter)return true;
 if(filter.kind==='transition')return transitionBucket(session,filter.from,filter.to)===filter.bucket;
 if(filter.kind==='attempt')return attemptsFor(session).some(a=>a.method===filter.method&&(filter.outcome==='all'||a.status===filter.outcome));
 if(filter.kind==='change')return session.events.some(e=>e.name==='authorization_method_changed'&&e.from===filter.from&&e.to===filter.to);
 return false;
}
window.GGDashboardAnalytics={transitionBucket,transition,attemptsFor,methodComparison,methodChanges,matches};
})();
