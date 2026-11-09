/* TAKE&GO · misma plantilla V2 de gg-invoice.js, paleta marrón y detalle de compra. */
(function(){'use strict';
const G='#523729',G2='#6b4935',Y='#ffda2f',INK='#3c281e',MUTED='#8b7768',BORDER='#e7ddd1',SOFT='#f7f3ec';
const euro=n=>TakeGoUI.money(Math.round(Number(n||0)*100)),esc=s=>TakeGoUI.esc(s);
function fields(r){return {number:r.id,date:TakeGoUI.date(r.paidAt),station:r.store,quantity:r.rows.reduce((n,p)=>n+p.quantity,0),issuer:'TAKE&GO TIENDAS DEMO',issuerNif:'No registrado · demo',issuerAddress:'Estación Diagonal · Barcelona',customer:r.customer,customerNif:'No registrado',customerAddress:'No registrada',payment:r.payment,paymentStatus:'Pago ficticio aprobado (automático)'}}
function preview(r){const d=fields(r);return `<div class="tg-invoice-preview" aria-label="Vista previa de la factura TAKE&GO">
<div class="tg-inv-top"><div class="tg-inv-logo">TAKE<span>&amp;</span>GO</div><div class="tg-inv-top-right"><span class="tg-inv-tag">FACTURA</span><div class="tg-inv-ref">${esc(d.number)}</div><div class="tg-inv-date">${esc(d.date)}</div></div></div>
<div class="tg-inv-content"><div class="tg-inv-section">RESUMEN DE LA COMPRA</div><div class="tg-inv-grid3">${[['ESTACIÓN',d.station],['PRODUCTOS',d.quantity+(d.quantity===1?' unidad':' unidades')],['ACREDITACIÓN','Método '+r.method]].map(([k,v])=>`<div class="tg-inv-box"><span class="tg-inv-caption">${k}</span><span class="tg-inv-value">${esc(v)}</span></div>`).join('')}</div>
<div class="tg-inv-section">DATOS DE FACTURACIÓN</div><div class="tg-inv-grid2">${[['EMISOR',d.issuer,'CIF: '+d.issuerNif,d.issuerAddress],['CLIENTE',d.customer,'DNI/NIF: '+d.customerNif,d.customerAddress]].map(([k,n,id,a])=>`<div class="tg-inv-billing"><span class="tg-inv-dash"></span><div class="tg-inv-caption">${k}</div><strong>${esc(n)}</strong><p>${esc(id)}<br>${esc(a)}</p></div>`).join('')}</div>
<div class="tg-inv-section">DETALLE</div><div class="tg-inv-detail"><div class="tg-inv-detail-head"><span>CONCEPTO</span><span>IMPORTE</span></div>${r.rows.map(p=>`<div class="tg-inv-detail-row"><div><strong>${esc(p.name)}</strong><small>${p.quantity} ud. × ${TakeGoUI.money(p.cents)}</small></div><strong>${TakeGoUI.money(p.cents*p.quantity)}</strong></div>`).join('')}</div>
<div class="tg-inv-grid2"><div class="tg-inv-paycard"><div class="tg-inv-caption">PAGO</div><strong>${esc(d.payment)}</strong><p>${esc(d.paymentStatus)}</p><span class="tg-inv-paid">OPERACIÓN SIMULADA</span></div><div class="tg-inv-totalcard"><div class="tg-inv-caption" style="color:#eedfcb">RESUMEN</div><div><span>Importe productos</span><strong>${TakeGoUI.money(r.totalCents)}</strong></div><div><span>Impuestos</span><strong>Incluidos</strong></div><div class="tg-inv-final"><span>TOTAL</span><strong>${TakeGoUI.money(r.totalCents)}</strong></div></div></div></div>
<div class="tg-inv-bottom"><div><strong>DOCUMENTO FICTICIO · SIN VALIDEZ FISCAL</strong><p>Datos del emisor y operaciones exclusivamente de demostración.<br>Importes con impuestos incluidos. No acredita compra ni pago real.</p></div><span class="tg-inv-footer-logo">T&amp;G</span></div></div>`}
function roundRect(ctx,x,y,w,h,r,fill,stroke){
 ctx.beginPath();ctx.roundRect(x,y,w,h,Math.max(0,Math.min(r,w/2,h/2)));
 if(fill){ctx.fillStyle=fill;ctx.fill()} if(stroke){ctx.lineWidth=.85;ctx.strokeStyle=stroke;ctx.stroke()}
}
function font(ctx,size=10,bold=false){ctx.font=(bold?'700 ':'400 ')+size+'px Arial, Helvetica, sans-serif'}
function text(ctx,t,x,y,size=10,color=INK,bold=false,align='left'){
 ctx.fillStyle=color;font(ctx,size,bold);ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(String(t??''),x,y);
}
function fit(ctx,t,max){let s=String(t??'');if(ctx.measureText(s).width<=max)return s;while(s.length>1&&ctx.measureText(s+'…').width>max)s=s.slice(0,-1);return s+'…'}
function fitted(ctx,t,x,y,max,size=10,color=INK,bold=false,align='left'){
 font(ctx,size,bold);text(ctx,fit(ctx,t,max),x,y,size,color,bold,align);
}
function multiline(ctx,s,x,y,width,size=9,color=MUTED,weight=false,lineH=13,maxLines=2){
 let all=[];for(const paragraph of String(s??'').split(/\n/)){let row='';for(const word of paragraph.split(/\s+/)){const next=row?row+' '+word:word;font(ctx,size,weight);if(ctx.measureText(next).width>width&&row){all.push(row);row=word;}else row=next;}all.push(row);}
 all=all.filter(Boolean);let result=all.slice(0,maxLines);
 if(all.length>maxLines&&result.length){font(ctx,size,weight);result[result.length-1]=fit(ctx,result[result.length-1]+'…',width)}
 for(let i=0;i<result.length;i++)fitted(ctx,result[i],x,y+i*lineH,width,size,color,weight);
 return result.length;
}
function drawCard(ctx,x,y,w,h){roundRect(ctx,x,y,w,h,11,SOFT,BORDER)}
function drawInvoice(ctx,r){
 const W=595,d=fields(r),q={total:r.totalCents/100};
 ctx.fillStyle='#fff';ctx.fillRect(0,0,595,842);
 // Brown header, adapted corporate colors with top yellow line.
 const bg=ctx.createLinearGradient(0,0,595,145);bg.addColorStop(0,G);bg.addColorStop(1,G2);
 ctx.fillStyle=bg;ctx.fillRect(0,0,W,147);ctx.fillStyle=Y;ctx.fillRect(0,0,W,6);
 text(ctx,'TAKE&GO',39,86,34,Y,true);
 roundRect(ctx,426,30,139,34,19,Y);text(ctx,'FACTURA',495.5,53,15,G,true,'center');
 fitted(ctx,d.number,557,88,185,7,'#fffaf4',true,'right');
 fitted(ctx,d.date,557,108,180,9,'#eedfcb',false,'right');
 // Headline and three summary boxes
 text(ctx,'RESUMEN DE LA COMPRA',38,171,9,MUTED,true);
 const tabs=[{x:38,k:'ESTACIÓN',v:d.station},{x:214,k:'PRODUCTOS',v:d.quantity+(d.quantity===1?' unidad':' unidades')},{x:390,k:'ACREDITACIÓN',v:'Método '+r.method}];
 tabs.forEach(t=>{drawCard(ctx,t.x,185,167,62);text(ctx,t.k,t.x+12,206,8,MUTED,true);multiline(ctx,t.v,t.x+12,224,143,10,INK,true,11,2)});
 // Issuer and customer
 text(ctx,'DATOS DE FACTURACIÓN',38,279,9,MUTED,true);
 const bill=[{x:38,k:'EMISOR',name:d.issuer,nif:'CIF: '+d.issuerNif,address:d.issuerAddress},{x:305,k:'CLIENTE',name:d.customer,nif:'DNI/NIF: '+d.customerNif,address:d.customerAddress}];
 bill.forEach(t=>{
  roundRect(ctx,t.x,294,252,106,12,'#fff',BORDER);roundRect(ctx,t.x+14,307,29,5,3,Y);
  text(ctx,t.k,t.x+14,326,9,G,true);multiline(ctx,t.name,t.x+14,344,224,10,INK,true,11,2);
  fitted(ctx,t.nif,t.x+14,364,225,8,MUTED);multiline(ctx,t.address,t.x+14,380,224,8,MUTED,false,10,2);
 });
 // El bloque de detalle crece para las seis referencias del catálogo.
 const detailHeight=Math.max(103,28+r.rows.length*22),payY=439+detailHeight+19;
 text(ctx,'DETALLE',38,426,9,MUTED,true);
 roundRect(ctx,38,439,519,detailHeight,12,'#fff',BORDER);
 ctx.save();ctx.beginPath();ctx.roundRect(38,439,519,detailHeight,12);ctx.clip();ctx.fillStyle='#f1e6d8';ctx.fillRect(38,439,519,28);ctx.restore();
 text(ctx,'CONCEPTO',52,457,9,G,true);text(ctx,'IMPORTE',543,457,9,G,true,'right');
 r.rows.forEach((p,i)=>{const y=477+i*21;fitted(ctx,p.name,52,y,370,10,INK,true);text(ctx,p.quantity+' ud. × '+euro(p.cents/100),52,y+10,8,MUTED);text(ctx,euro(p.cents*p.quantity/100),542,y+2,10,INK,true,'right')});
 ctx.save();ctx.translate(0,payY-561);
 // Pay / summary boxes
 drawCard(ctx,38,561,252,124);text(ctx,'PAGO',52,584,9,G,true);
 multiline(ctx,d.payment,52,609,224,12,INK,true,15,2);
 fitted(ctx,d.paymentStatus,52,640,224,9,MUTED);
 roundRect(ctx,52,651,119,21,11,'#efe1ce');text(ctx,'OPERACIÓN SIMULADA',111.5,665,7.7,G,true,'center');
 const tot=ctx.createLinearGradient(305,561,555,685);tot.addColorStop(0,G);tot.addColorStop(1,'#79563e');
 roundRect(ctx,305,561,252,124,12,tot);
 text(ctx,'RESUMEN',319,584,9,'#f1e5d7',true);
 text(ctx,'Importe productos',319,605,9,'#eddfcf');text(ctx,euro(q.total),541,605,9,'#fff',true,'right');
 text(ctx,'Impuestos',319,627,9,'#eddfcf');text(ctx,'Incluidos',541,627,9,'#fff',true,'right');
 ctx.beginPath();ctx.strokeStyle='#ffffff57';ctx.moveTo(319,639);ctx.lineTo(541,639);ctx.stroke();
 text(ctx,'TOTAL',319,664,11,Y,true);text(ctx,euro(q.total),541,665,18,Y,true,'right');
 ctx.restore();
 // Fiscal disclaimer remains on both modes: both currently generate fake invoices.
 ctx.beginPath();ctx.strokeStyle=BORDER;ctx.moveTo(38,754);ctx.lineTo(557,754);ctx.stroke();
 text(ctx,'DOCUMENTO FICTICIO · SIN VALIDEZ FISCAL',38,774,9,G,true);
 text(ctx,'Datos del emisor y operaciones exclusivamente de demostración.',38,791,8,MUTED);
 text(ctx,'Importes con impuestos incluidos. No acredita compra ni pago real.',38,806,8,MUTED);
 text(ctx,'T&G',516,794,23,G,true,'center');
}
function binaryPdfFromJpeg(imageUrl,width,height){
 const raw=atob(imageUrl.split(',')[1]);const jpg=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)jpg[i]=raw.charCodeAt(i);
 const enc=new TextEncoder();const chunks=[];let pos=0;const offsets=[0];
 const push=b=>{const arr=typeof b==='string'?enc.encode(b):b;chunks.push(arr);pos+=arr.length};
 const obj=(i,content)=>{offsets[i]=pos;push(i+' 0 obj\n');push(content);push('\nendobj\n')};
 push('%PDF-1.4\n%TAKEGO\n');
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>');
 offsets[4]=pos;push('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');push(jpg);push('\nendstream\nendobj\n');
 const content='q\n595 0 0 842 0 0 cm\n/Im1 Do\nQ\n';
 obj(5,'<< /Length '+enc.encode(content).length+' >>\nstream\n'+content+'endstream');
 const xref=pos;push('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
 const bytes=new Uint8Array(pos);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}return new Blob([bytes],{type:'application/pdf'});
}
async function download(r){const scale=2.5,canvas=document.createElement('canvas');canvas.width=Math.round(595*scale);canvas.height=Math.round(842*scale);const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Este navegador no permite generar la factura PDF');ctx.scale(scale,scale);drawInvoice(ctx,r);const blob=binaryPdfFromJpeg(canvas.toDataURL('image/jpeg',.94),canvas.width,canvas.height),uri=URL.createObjectURL(blob),a=document.createElement('a');a.href=uri;a.download='TAKEGO_Factura_'+r.id.replace(/[^\w.-]/g,'_')+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),15000);return blob}
window.TakeGoInvoice={preview,download,draw:drawInvoice};
})();
