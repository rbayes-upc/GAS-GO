/* Presentación compartida. Las incidencias se guardan únicamente en el navegador. */
(function(){'use strict';
const U=TakeGoUI;
function row(p,{returnable=false}={}){
 const subtitle=p.pending?`${p.quantity+p.pending} detectado${p.quantity+p.pending===1?'':'s'} · ${p.pending} en verificación`:`${p.quantity} verificado${p.quantity===1?'':'s'}`;
 const amount=p.pending?'<span class="pending-price">Importe pendiente</span>':`<strong>${U.money(p.cents*p.quantity)}</strong>`;
 return `<div class="row basket-row"><div class="basket-product">${U.art(p)}<div><strong>${U.esc(p.name)}</strong><p>${subtitle}</p></div></div><div class="basket-amount">${amount}${returnable?`<button class="return-button" aria-label="Devolver ${U.esc(p.name)}" data-action="return" data-sku="${p.id}">${U.icon('return')} Devolver</button>`:''}</div></div>`;
}
function total(b,paid=false){return `<div class="row total"><small>${paid?'Total pagado':b.pending.length?'Total pendiente':'Total de la cesta'}</small><strong>${b.pending.length?'En verificación':U.money(b.totalCents)}</strong></div>${b.pending.length?'<p class="warning">Hay productos detectados pendientes de contrastar. No se realizará ningún cobro hasta verificarlos.</p>':''}`}
function budget(rows,{estimated=false}={}){
 if(!rows?.length)return '';
 const active=rows.filter(r=>r.limit!==null),tight=active.filter(r=>r.remaining===0||r.exceeded||r.projected>=r.limit*.8);
 return `<section class="budget-summary ${tight.length?'budget-attention':''}"><strong>${active.length?'Tu presupuesto disponible':'Topes de compra: sin límite'}</strong>${active.map(r=>`<div class="row micro ${r.exceeded?'budget-exceeded':''}"><span>${r.label}</span><span>${U.money(r.remaining)} disponibles</span></div>`).join('')}${tight.length?'<p class="micro">'+(tight.some(r=>r.exceeded)?'Esta cesta supera un tope. Devuelve productos antes de salir.':'Te estás acercando a un tope de compra.')+'</p>':''}${estimated?'<p class="micro">Aviso estimado: incluye productos en verificación.</p>':''}${!active.length?'<p class="micro">Puedes configurar topes diarios, semanales y mensuales en Perfil.</p>':''}</section>`;
}
const issueKey='takego_issues_v1';
const stages={open:'Pendiente',review:'En revisión',resolved:'Resuelta'};
function readIssues(){try{const rows=JSON.parse(localStorage.getItem(issueKey));return Array.isArray(rows)?rows.filter(x=>x&&typeof x.id==='string'&&(x.receiptId===null||typeof x.receiptId==='string')):[]}catch{return []}}
const purchaseReasons=['Producto que no he cogido','Cantidad o importe incorrecto','Posible cobro duplicado','Problema con la factura','Otro motivo'];
const storeReasons=['Problema de acceso','Producto o estantería','Problema con la cesta','Limpieza o mantenimiento','Otro motivo'];
function issueForm(r=null){
 const reasons=r?purchaseReasons:storeReasons;
 const context=r?`<section class="card tinted"><strong>${U.esc(r.store)}</strong><p>${U.date(r.paidAt)} · ${U.money(r.totalCents)}</p><small class="reference">${U.esc(r.id)}</small></section>`:'';
 return `<h2 class="page-title">${r?'Problema con una compra':'Comunicar incidencia de la tienda'}</h2>${context}<p class="warning">Incidencia de demostración. Se guardará en este navegador; no se enviará a la estación ni iniciará un reembolso.</p><form id="issueForm"><label class="field-label" for="issueReason">¿Qué ha ocurrido?</label><select id="issueReason" name="reason" required>${reasons.map(reason=>`<option>${U.esc(reason)}</option>`).join('')}</select><label class="field-label" for="issueDetails">Detalles (opcional)</label><textarea id="issueDetails" name="details" rows="4" maxlength="500" placeholder="Describe el problema sin incluir datos bancarios."></textarea><button class="button primary wide" type="submit">Guardar incidencia de demostración</button><p id="issueError" role="alert" class="form-error"></p></form>`;
}
function changeIssues(change){
 const write=()=>{const rows=readIssues();const result=change(rows);localStorage.setItem(issueKey,JSON.stringify(rows));return result};
 return navigator.locks?navigator.locks.request(issueKey,write):Promise.resolve().then(write);
}
function stage(issue){return Object.hasOwn(stages,issue.stage)?issue.stage:'open'}
function recordIssue(receipt,form){
 const fields=new FormData(form),reason=fields.get('reason'),details=String(fields.get('details')||'').trim().slice(0,500);
 if((receipt&&!U.receiptValid(receipt))||!(receipt?purchaseReasons:storeReasons).includes(reason))throw Error('Selecciona un motivo y una compra válidos.');
 const receiptId=receipt?.id??null;
 return changeIssues(rows=>{
  const existing=rows.find(x=>x.receiptId===receiptId&&x.reason===reason&&x.details===details&&stage(x)!=='resolved');
  if(existing)return existing;
  const issue={id:'TG-INC-'+crypto.randomUUID(),receiptId,reason,details,createdAt:Date.now(),stage:'open',simulated:true};
  rows.push(issue);return issue;
 });
}
function updateIssue(id,expected){
 return changeIssues(rows=>{
  const issue=rows.find(x=>x.id===id);
  if(!issue)throw Error('No se encuentra la incidencia.');
  if(stage(issue)!==expected)return;
  issue.stage={open:'review',review:'resolved',resolved:'open'}[stage(issue)];
  issue.updatedAt=Date.now();
 });
}
function issuesHTML({manage=false}={}){
 const rows=readIssues().slice().reverse();
 return `<h2 class="page-title">${manage?'Incidencias de la tienda':'Mis incidencias'}</h2><p>Copias de demostración guardadas en este navegador. No se han enviado a la estación.</p><button class="button primary wide issue-new" data-action="new-issue">${U.icon('warning')} Comunicar incidencia</button>${rows.length?rows.map(x=>`<section class="card"><strong>${U.esc(x.reason)}</strong><p class="micro">${U.date(x.createdAt)} · ${stages[stage(x)]}</p><p>${U.esc(x.details||'Sin detalles adicionales.')}</p><small class="reference">${x.receiptId?'Compra: '+U.esc(x.receiptId):'Incidencia de la tienda'}</small><button class="button outline wide" data-action="download-issue" data-id="${U.esc(x.id)}">${U.icon('download')} Descargar copia</button>${manage?`<button class="button outline wide issue-stage" data-action="issue-stage" data-stage="${stage(x)}" data-id="${U.esc(x.id)}">${{open:'Marcar en revisión',review:'Marcar como resuelta',resolved:'Reabrir incidencia'}[stage(x)]}</button>`:''}</section>`).join(''):'<div class="empty">'+U.icon('warning')+'<h3>No hay incidencias guardadas.</h3></div>'}`;
}
function downloadIssue(id){const x=readIssues().find(r=>r.id===id);if(!x)return;const text=`TAKE&GO · INCIDENCIA DE DEMOSTRACIÓN\nReferencia: ${x.id}\nCompra: ${x.receiptId||'Incidencia de la tienda'}\nFecha: ${U.date(x.createdAt)}\nMotivo: ${x.reason}\nDetalles: ${x.details||'Sin detalles'}\nEstado: ${stages[stage(x)]}. Guardada solo en este navegador. No enviada. No inicia reembolsos.\n`,url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=x.id+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),15000)}
window.TakeGoExperience={row,total,budget,readIssues,issueForm,recordIssue,updateIssue,issuesHTML,downloadIssue,issueKey};
})();
