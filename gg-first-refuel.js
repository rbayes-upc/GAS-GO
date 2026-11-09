/* Ayuda de interfaz: no altera la identificación, autorización ni el suministro. */
(function(){
'use strict';
const storageKey='gasgo:first-refuel-guide:v1';
const supply=document.getElementById('supplyBtn');
if(!supply)return;
let seen=false,previousFocus=null;
try{seen=localStorage.getItem(storageKey)==='seen'}catch(e){}
function close(){
 document.getElementById('ggFirstRefuelGuide')?.remove();
 document.removeEventListener('keydown',onKey);
 previousFocus?.focus();
}
function onKey(event){
 const dialog=document.getElementById('ggFirstRefuelGuide');if(!dialog)return;
 if(event.key==='Escape'){event.preventDefault();close();return}
 if(event.key!=='Tab')return;
 const buttons=Array.from(dialog.querySelectorAll('button'));
 const first=buttons[0],last=buttons[buttons.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
function show(continueWithHose=false){
 if(document.getElementById('ggFirstRefuelGuide'))return;
 previousFocus=document.activeElement;
 const overlay=document.createElement('div');overlay.id='ggFirstRefuelGuide';
 overlay.innerHTML='<section class="gg-refuel-guide-card" role="dialog" aria-modal="true" aria-labelledby="ggRefuelGuideTitle"><h2 id="ggRefuelGuideTitle">Tu primer repostaje, en tres pasos</h2><ol><li><strong>Coge la manguera.</strong> Pulsa «Agarra la manguera».</li><li><strong>Mantén pulsado para suministrar.</strong> El importe y los litros aumentarán. Al soltar, el suministro se detiene.</li><li><strong>Finaliza.</strong> Pulsa «Finalizar repostaje». La factura aparecerá en la app y quedará guardada en Historial.</li></ol><p>Esta es una simulación: no se suministra combustible ni se realizan cobros reales.</p><button type="button" class="primary" id="ggRefuelGuideContinue">Entendido</button><button type="button" class="secondary" id="ggRefuelGuideBack">Volver</button></section>';
 document.body.append(overlay);
 overlay.querySelector('#ggRefuelGuideContinue').addEventListener('click',()=>{
  seen=true;try{localStorage.setItem(storageKey,'seen')}catch(e){}
  close();if(continueWithHose&&!supply.disabled&&supply.textContent.includes('Agarra la manguera'))supply.click();
 });
 overlay.querySelector('#ggRefuelGuideBack').addEventListener('click',close);
 document.addEventListener('keydown',onKey);overlay.querySelector('#ggRefuelGuideContinue').focus();
}
supply.addEventListener('click',event=>{
 if(seen||supply.disabled||!supply.textContent.includes('Agarra la manguera'))return;
 event.preventDefault();event.stopImmediatePropagation();show(true);
},true);
const advanced=document.querySelector('#advancedMenu .advanced-body');
if(advanced){
 const button=document.createElement('button');button.type='button';button.className='secondary gg-reopen-guide';button.textContent='Ver guía de repostaje';
 button.addEventListener('click',()=>show(false));advanced.prepend(button);
}
})();
