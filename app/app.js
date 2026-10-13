'use strict';
const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>Number(n).toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d});
const date=s=>s?new Date(s+'T12:00:00Z').toLocaleDateString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}):'—';
let history=[],latest=null,worker=null,sequence=0,renderToken=0,loadToken=0,loading=false,pending=new Map();
let currentMode='',currentQuantity=0;
function resetWorker(){
 if(worker)worker.terminate();for(const task of pending.values())task.reject(Error('Análisis reemplazado por una actualización.'));pending.clear();
 try{
  worker=new Worker('./worker.js?v=2.0.0');
  worker.onmessage=({data})=>{const task=pending.get(data.id);if(!task)return;pending.delete(data.id);data.error?task.reject(Error(data.error)):task.resolve(data.result??data);};
  worker.onerror=()=>{for(const task of pending.values())task.reject(Error('No se pudo iniciar el cálculo en segundo plano. Probá recargar la página.'));pending.clear();worker.terminate();worker=null;};
 }catch{worker=null;}
}
async function work(message){
 if(worker)return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,...message});});
 await new Promise(resolve=>setTimeout(resolve,20));
 if(message.type==='init')return {ok:true};
 const rows=QuiniModel.dataFor(history,message.mode);
 return message.type==='legacy'?QuiniLegacy.backtest(rows,80):QuiniModel.compile(rows,message.count);
}
function disableOutputs(disabled){['copyPick','copyAll','exportPicks','backtest','legacy-test'].forEach(id=>$(id).disabled=disabled);}
function clearForecast(message){
 latest=null;disableOutputs(true);$('forecast').hidden=true;$('validation').hidden=true;$('backtest').textContent='Ver prueba histórica y métodos';$('legacy-result').textContent='';$('compute-status').textContent=message;
}
async function compute(){
 if(loading||!history.length)return;
 const token=++renderToken;
 if(!$('generate-form').reportValidity()){clearForecast('Ingresá una cantidad entera entre 1 y 100.');return;}
 const mode=$('mode').value,count=Number($('quantity').value);
 clearForecast('Comparando métodos y ordenando las combinaciones…');$('generate').disabled=true;
 try{
  const result=await work({type:'forecast',mode,count});if(token!==renderToken)return;
  latest=result;currentMode=mode;currentQuantity=count;renderForecast();renderStats();renderValidation();
  $('compute-status').textContent=fmt(count)+' jugada'+(count===1?'':'s')+' distinta'+(count===1?'':'s')+' · '+mode+' · cálculo terminado.';
  disableOutputs(false);$('forecast').hidden=false;
 }catch(e){if(token===renderToken)clearForecast('No se pudo calcular: '+e.message);}
 finally{if(token===renderToken)$('generate').disabled=false;}
}
function renderForecast(){
 const a=latest.analysis;
 $('pick').innerHTML=latest.numbers.map(n=>'<span class="ball">'+pad(n)+'</span>').join('');
 $('cutoff').textContent='Datos hasta '+date(a.last)+' · concurso '+a.lastContest;
 $('model-name').textContent=a.selected.name+' · '+currentMode;
 const val=a.validation.find(x=>x.id===a.selected.id);
 $('evidence').innerHTML='<strong>'+safe(a.interpretation)+'</strong>'+(a.sufficient?(val.logGain<=0?'El azar uniforme rindió mejor que todas las alternativas en la etapa de selección. ':'')+'El orden siguiente es exploratorio: no demuestra que la primera jugada tenga más chances reales que las demás.':'Historial insuficiente para una prueba independiente: se usa el modelo de mayor suavizado, sin validación.');
 $('ranking-title').textContent='Las '+currentQuantity+' jugadas en orden';
 $('ranked').innerHTML=latest.ranked.map(r=>'<tr><td>#'+r.rank+'</td><td>'+r.numbers.map(pad).join(' · ')+'</td><td>'+fmt(r.score,3)+'</td></tr>').join('');
 const chance=QuiniModel.portfolioChance(currentQuantity);
 $('chance').textContent=currentQuantity+' jugada'+(currentQuantity===1?'':'s')+' distinta'+(currentQuantity===1?'':'s')+': '+currentQuantity+' en 9.366.819'+(currentQuantity>1?' (aprox. 1 en '+fmt(chance.oneIn,1)+')':'')+'.';
 $('explain').textContent='Calculado con '+fmt(a.contests)+' concursos y '+fmt(a.count)+' extracciones. Último dato: '+date(a.last)+'. Motor '+a.version+'. '+(currentMode==='Todas'?'Historial combinado: asume una distribución común entre modalidades. ':'')+'Los seis números se evalúan como un conjunto; el puntaje no es una probabilidad comprobada.';
}
function renderStats(){
 const top=Array.from(latest.frequency,(count,n)=>({n,count})).sort((a,b)=>b.count-a.count||a.n-b.n).slice(0,12);
 $('stats').innerHTML='<div class="table-scroll"><table><thead><tr><th>Número</th><th>Apariciones</th><th>Frecuencia</th><th>Ausencia*</th></tr></thead><tbody>'+top.map(x=>'<tr><td>'+pad(x.n)+'</td><td>'+fmt(x.count)+'</td><td>'+fmt(100*x.count/latest.n,1)+' %</td><td>'+latest.lag[x.n]+'</td></tr>').join('')+'</tbody></table></div><p class="muted">*Concursos desde su última aparición. No interviene como ventaja en el nuevo modelo.</p>';
 const pairs=[];for(let a=0;a<46;a++)for(let b=a+1;b<46;b++)pairs.push({nums:[a,b],count:latest.pairs[a*46+b]});
 pairs.sort((a,b)=>b.count-a.count||a.nums[0]-b.nums[0]||a.nums[1]-b.nums[1]);
 const triples=Array.from(latest.triples,([key,count])=>({nums:key.split(',').map(Number),count})).sort((a,b)=>b.count-a.count||a.nums.join(',').localeCompare(b.nums.join(',')));
 const table=(rows,name)=>'<div class="table-scroll"><table><thead><tr><th>'+name+'</th><th>Apariciones</th></tr></thead><tbody>'+rows.slice(0,12).map(x=>'<tr><td>'+x.nums.map(pad).join(' · ')+'</td><td>'+fmt(x.count)+'</td></tr>').join('')+'</tbody></table></div>';
 $('pairs').innerHTML=table(pairs,'Pareja');$('triples').innerHTML=table(triples,'Trío');
}
function renderValidation(){
 const a=latest.analysis,t=a.audit,ci=x=>x?x.map(v=>fmt(v,4)).join(' a '):'no disponible';
 if(!a.sufficient){$('validation').textContent='Se necesitan al menos 500 concursos para separar tres períodos de análisis.';return;}
 const phases=[['training','Entrenamiento inicial'],['validation','Selección del método'],['test','Prueba final']].map(([key,title])=>{const p=a.split[key];return '<p class="phase"><strong>'+title+': '+fmt(p.count)+' concursos</strong> · '+date(p.from)+' al '+date(p.to)+'</p>';}).join('');
 const sorted=a.validation.slice().sort((x,y)=>y.logGain-x.logGain);
 $('validation').innerHTML=phases+'<h3>Métodos comparados en la selección</h3><p class="muted">Menor pérdida logarítmica es mejor. Evalúa la probabilidad asignada al conjunto completo de seis, no sólo los aciertos individuales. La referencia uniforme también puede ganar.</p><div class="table-scroll"><table><thead><tr><th>Método</th><th>Pérdida log.</th><th>Media de aciertos</th></tr></thead><tbody>'+sorted.map(x=>'<tr><td>'+safe(x.name)+(x.id===a.selected.id?' · seleccionado*':'')+'</td><td>'+fmt(x.logLoss,5)+'</td><td>'+(x.id==='uniform'?fmt(a.uniform.expectedHits,3)+' (teórica)':fmt(x.meanHits,3))+'</td></tr>').join('')+'</tbody></table></div><p class="muted">En la referencia uniforme, la media de aciertos es la esperanza matemática; en los otros métodos es el promedio observado. *Mejor alternativa histórica para ordenar jugadas. Si pierde frente al uniforme, el ranking se mantiene como exploración, sin atribuirle una ventaja.</p><h3>Prueba final: '+safe(a.selected.name)+'</h3><p>'+fmt(t.count)+' extracciones en '+fmt(t.contests)+' concursos. Media de aciertos de la <strong>primera jugada: '+fmt(t.meanHits,3)+'</strong>; referencia matemática: '+fmt(a.uniform.expectedHits,3)+'. IC 95 % aproximado del promedio por concurso: '+ci(t.meanHitsCI)+'.</p><p>Pérdida logarítmica: <strong>'+fmt(t.logLoss,5)+'</strong>; uniforme: '+fmt(a.uniform.logLoss,5)+'. Ganancia logarítmica frente al uniforme: '+fmt(t.logGain,5)+'; IC 95 % aproximado: '+ci(t.logGainCI)+'. Un intervalo que incluye cero no permite distinguir una mejora.</p><div class="table-scroll"><table><thead><tr><th>Aciertos</th><th>Extracciones</th></tr></thead><tbody>'+t.distribution.map((n,i)=>'<tr><td>'+i+'</td><td>'+n+'</td></tr>').join('')+'</tbody></table></div><p><strong>'+safe(a.interpretation)+'</strong></p><p class="muted">La distribución de aciertos corresponde sólo a la primera combinación del modelo, no al conjunto de '+currentQuantity+' jugadas. Los intervalos agrupan las modalidades por concurso y contemplan dependencia temporal aproximada. Una ganancia retrospectiva no valida la posibilidad de acertar los seis ni certifica la fuente.</p>';
}
async function runLegacy(){
 if(!latest)return;const token=renderToken,mode=currentMode;$('legacy-test').disabled=true;$('legacy-result').textContent='Evaluando modelo anterior…';
 try{const r=await work({type:'legacy',mode});if(token!==renderToken)return;if(r.error)throw Error(r.error);$('legacy-result').textContent=r.count+' extracciones · media '+fmt(r.meanHits,3)+' · referencia '+fmt(r.expectedRandom,3)+'. Distribución: '+r.distribution.map((n,i)=>i+' aciertos: '+n).join(' · ')+'. No demuestra una ventaja predictiva.';}
 catch(e){if(token===renderToken)$('legacy-result').textContent='Error: '+e.message;}
 finally{if(token===renderToken)$('legacy-test').disabled=false;}
}
async function load(){
 const token=++loadToken;++renderToken;loading=true;history=[];$('cutoff').textContent='Consultando historial…';clearForecast('Cargando datos…');$('generate').disabled=true;$('reload').disabled=true;$('status').className='';$('status').textContent='Consultando historial publicado…';
 try{
  const response=await fetch('./data.json?nocache='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);
  const d=await response.json();if(token!==loadToken)return;
  const rows=QuiniModel.dataFor(d.draws,'Todas');if(!rows.length)throw Error('La base no contiene resultados.');
  if(d.draw_count!==d.draws.length||d.record_count!==rows.length)throw Error('Los totales no coinciden con la base.');
  if(rows.some(r=>r.date>new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'})))throw Error('Hay resultados fechados en el futuro.');
  history=d.draws;resetWorker();await work({type:'init',draws:history});if(token!==loadToken)return;
  const incomplete=history.filter(x=>Object.keys(x.results).length!==4).length;
  $('status').textContent=fmt(history.length)+' concursos cargados · Última actualización: '+(d.updated?new Date(d.updated).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hourCycle:'h23'})+' (Argentina)':'sin fecha')+(incomplete?' · Atención: '+incomplete+' concursos incompletos':'');
  $('metrics').innerHTML=[['Concursos',fmt(history.length)],['Extracciones',fmt(rows.length)],['Desde',date(rows[0].date)],['Último sorteo',date(rows.at(-1).date)]].map(([k,v])=>'<div class="metric"><span>'+safe(k)+'</span><strong>'+safe(v)+'</strong></div>').join('');
  let sourceURL='https://www.loteriasantafe.gov.ar/';try{const u=new URL(d.source_url);if(u.protocol==='https:')sourceURL=u.href;}catch{}
  $('source').innerHTML='Datos históricos: '+safe(d.source)+' — <a target="_blank" rel="noopener noreferrer" href="'+safe(sourceURL)+'">ver origen</a>. '+safe(d.attribution||'')+'. Fuente de terceros; sin auditoría oficial integral.';
  const recent=history.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.contest-a.contest).slice(0,5);
  $('results').innerHTML=recent.map(d=>'<article class="record"><h3>Concurso '+d.contest+' · '+date(d.date)+'</h3>'+Object.entries(d.results).map(([m,a])=>'<strong>'+safe(m)+'</strong><div class="balls">'+a.map(n=>'<span class="ball">'+pad(n)+'</span>').join('')+'</div>').join('')+'</article>').join('');
  loading=false;await compute();
 }catch(e){if(token===loadToken){clearForecast('Sin datos disponibles para generar jugadas.');$('status').className='error';$('status').textContent='No se pudo cargar el historial: '+e.message;['stats','pairs','triples','results','metrics'].forEach(id=>$(id).textContent='Sin datos disponibles');}}
 finally{if(token===loadToken){loading=false;$('reload').disabled=false;$('generate').disabled=!history.length;}}
}
async function copy(text,button,label){
 try{await navigator.clipboard.writeText(text);button.textContent='¡Copiado!';setTimeout(()=>button.textContent=label,1800);}
 catch{const area=document.createElement('textarea');area.value=text;area.readOnly=true;area.style.width='100%';area.setAttribute('aria-label','Jugadas para copiar manualmente');button.after(area);area.focus();area.select();button.textContent='Seleccioná y copiá el texto';}
}
$('generate-form').addEventListener('submit',event=>{event.preventDefault();compute();});
$('mode').addEventListener('change',compute);
$('quantity').addEventListener('input',()=>{++renderToken;clearForecast('Presioná «Generar jugadas» para aplicar la cantidad.');$('generate').disabled=!history.length||loading;});
$('reload').addEventListener('click',load);
$('backtest').addEventListener('click',()=>{$('validation').hidden=!$('validation').hidden;$('backtest').textContent=$('validation').hidden?'Ver prueba histórica y métodos':'Ocultar prueba histórica';});
$('legacy-test').addEventListener('click',runLegacy);
$('copyPick').addEventListener('click',()=>{if(latest)copy(latest.numbers.map(pad).join(' - '),$('copyPick'),'Copiar primera jugada');});
$('copyAll').addEventListener('click',()=>{if(latest)copy('Quini Lab · '+currentMode+' · datos hasta '+latest.analysis.last+'\n'+latest.ranked.map(r=>r.rank+'. '+r.numbers.map(pad).join(' - ')).join('\n')+'\nOrden exploratorio, sin ventaja predictiva demostrada.',$('copyAll'),'Copiar todas');});
$('exportPicks').addEventListener('click',()=>{
 if(!latest)return;const a=latest.analysis;
 const rows=[['orden','modalidad','n1','n2','n3','n4','n5','n6','puntaje_relativo_no_probabilidad','modelo','datos_hasta','ultimo_concurso','version','probabilidad_uniforme_por_extraccion','alcance']];
 for(const r of latest.ranked)rows.push([r.rank,currentMode,...r.numbers.map(pad),r.score.toFixed(5),a.selected.name,a.last,a.lastContest,a.version,'1/9366819','Exploratorio; sin ventaja predictiva demostrada']);
 const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='quini_lab_jugadas_'+currentMode.replace(/\s+/g,'_')+'_'+a.last+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
load();
