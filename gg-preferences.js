/* Preferencias FULL por matrícula; solo métodos ficticios del prototipo. */
(function(){'use strict';
const esc=escapeHtml,$=id=>document.getElementById(id);
const METHODS=['Visa •••• 4821','Mastercard •••• 1056','PayPal (demo)','Bizum (demo)','Visa (demo)','Mastercard (demo)'];
const key=v=>GGPlate.norm(v?.plate||'');
const full=()=>!inPresentationDemo();
const get=v=>data.vehiclePreferences?.[key(v)]||{};
function payment(v){const p=get(v).payment;return METHODS.includes(p)?p:data.generalPayment||data.payment}
function apply(v){
 if(!full()||!v)return;
 const pref=get(v);data.payment=payment(v);
 if(v.fuel==='Híbrido enchufable'&&['fuel','charge'].includes(pref.service)){
  data.energyPreferences=data.energyPreferences||{};data.energyPreferences[v.plate]=pref.service;
  data.fuel=pref.service==='charge'?'Eléctrico':v.combustionFuel||'Gasolina 95';
 }
}
function operation(){
 if(!full())return {};
 const v=data.customVehicle?.name===data.vehicle?data.customVehicle:null,pref=get(v),limit=Number(pref.maxAmount);
 return {payment:payment(v),maxAmount:Number.isFinite(limit)&&limit>=1&&limit<=300?Math.round(limit*100)/100:null};
}
let editing=null;
function open(index){
 if(!full())return;
 const v=index==='current'?data.customVehicle:data.plateVehicles?.[index];if(!v)return;
 editing=structuredClone(v);const pref=get(v),hybrid=v.fuel==='Híbrido enchufable',fuel=v.fuel==='Eléctrico'?'Eléctrico':hybrid?v.combustionFuel||'Gasolina 95':v.fuel;
 const service=pref.service||(hybrid&&data.energyPreferences?.[v.plate]==='charge'?'charge':fuel==='Eléctrico'?'charge':'fuel');
 modal(`<h2>Preferencias del vehículo</h2><p class="gg-pref-context"><strong>${esc(v.name)}</strong> · ${esc(v.plate)}</p><form id="ggPreferenceForm"><label class="field" for="ggPreferredService">Combustible o servicio habitual</label><select id="ggPreferredService" ${hybrid?'':'disabled'}>${fuel!=='Eléctrico'?`<option value="fuel" ${service==='fuel'?'selected':''}>${esc(fuel)} · Repostar</option>`:''}${hybrid||fuel==='Eléctrico'?`<option value="charge" ${service==='charge'?'selected':''}>Electricidad · Recargar</option>`:''}</select><p class="small muted">${hybrid?'Se aplicará al seleccionar este vehículo. Podrás cambiar de servicio en el mapa.':'El combustible está ligado al motor registrado del vehículo.'}</p><label class="field" for="ggPreferredLimit">Límite de gasto por operación (€)</label><input id="ggPreferredLimit" type="number" inputmode="decimal" min="1" max="300" step="0.01" placeholder="Sin límite" value="${pref.maxAmount==null?'':esc(pref.maxAmount)}"><p class="small muted">Opcional · entre 1 y 300 €. El suministro simulado se detendrá al alcanzarlo. Puedes finalizar antes. Límite antes de descuentos.</p><label class="field" for="ggPreferredPayment">Método de pago predeterminado</label><select id="ggPreferredPayment">${METHODS.map(m=>`<option ${payment(v)===m?'selected':''}>${esc(m)}</option>`).join('')}</select><p class="small muted">Métodos ficticios. No introduzcas datos bancarios reales.</p><p id="ggPreferenceError" role="alert"></p><button type="submit" class="btn primary block">Guardar preferencias</button></form>`);
 $('ggPreferenceForm').addEventListener('input',()=>{$('ggPreferenceError').textContent=''});
 $('ggPreferenceForm').addEventListener('submit',event=>{event.preventDefault();store()});
}
function store(){
 if(!full()||!editing)return;
 const raw=$('ggPreferredLimit').value.trim(),limit=raw===''?null:Number(raw),method=$('ggPreferredPayment').value,service=$('ggPreferredService').value;
 if((limit!==null&&(!Number.isFinite(limit)||limit<1||limit>300||Math.abs(limit*100-Math.round(limit*100))>1e-7))||!METHODS.includes(method)){$('ggPreferenceError').textContent='Revisa el límite (1–300 €, hasta dos decimales) y el método de pago.';return}
 data.vehiclePreferences=data.vehiclePreferences||{};data.vehiclePreferences[key(editing)]={service,maxAmount:limit,payment:method};
 if(key(data.customVehicle)===key(editing))apply(data.customVehicle);
 save();closeModal();render();window.ggv2?.refreshLinkUI?.();toast('Preferencias guardadas para '+editing.name);editing=null;
}
const originalPayment=window.setPayment;
window.setPayment=function(method){
 if(full()&&METHODS.includes(method)){
  data.generalPayment=method;
  if(data.customVehicle){data.vehiclePreferences=data.vehiclePreferences||{};const k=key(data.customVehicle);data.vehiclePreferences[k]={...get(data.customVehicle),payment:method}}
 }
 originalPayment(method);
};
const previousRegistration=window.completeRegistration;
window.completeRegistration=function(...args){
 const registering=page==='Registro';previousRegistration(...args);
 if(registering&&full()&&page==='Home'&&METHODS.includes(regDraft.payment)){
  data.generalPayment=regDraft.payment;data.payment=regDraft.payment;
  if(data.customVehicle){data.vehiclePreferences=data.vehiclePreferences||{};data.vehiclePreferences[key(data.customVehicle)]={...get(data.customVehicle),payment:regDraft.payment}}
  save();render();
 }
};
if(!data.generalPayment)data.generalPayment=data.payment;
window.GGPreferences={open,apply,operation,get};
})();
