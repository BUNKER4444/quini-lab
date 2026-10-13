/* Quini Lab 2.0 — conjuntos de seis, ranking exacto y prueba temporal.
 * Las probabilidades del modelo son hipótesis, no una ventaja comprobada. */
(function(global){
'use strict';
const VERSION='2.0.0',TOTAL=46,SIZE=6,COMBINATIONS=9366819;
const MODES=['Tradicional','La Segunda','Revancha','Siempre Sale'];
const EXPECTED_HITS=36/46,UNIFORM_LOG=-Math.log(COMBINATIONS);
const SPECS=[
 {id:'uniform',name:'Azar uniforme',state:'full',prior:0},
 {id:'history200',name:'Frecuencia · suavizado 200',state:'full',prior:200},
 {id:'history1000',name:'Frecuencia · suavizado 1000',state:'full',prior:1000},
 {id:'recent52',name:'Recencia · 52 concursos',state:'recent52',prior:200},
 {id:'recent156',name:'Recencia · 156 concursos',state:'recent156',prior:200},
 {id:'recent416',name:'Recencia · 416 concursos',state:'recent416',prior:200},
 {id:'ensemble',name:'Ensamble regularizado',state:null,prior:0}
];
const valid=a=>Array.isArray(a)&&a.length===SIZE&&new Set(a).size===SIZE&&a.every(n=>Number.isInteger(n)&&n>=0&&n<TOTAL);
const hits=(a,b)=>a.reduce((s,n)=>s+Number(b.includes(n)),0);
const pairKey=(a,b)=>Math.min(a,b)*TOTAL+Math.max(a,b);
function dataFor(draws,mode){
 if(!Array.isArray(draws)||(!MODES.includes(mode)&&mode!=='Todas'))throw Error('Modalidad o base inválida.');
 const rows=[],contests=new Set();
 for(const d of draws){
  if(!Number.isInteger(d.contest)||d.contest<1||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date||contests.has(d.contest))throw Error('Concurso duplicado o fecha inválida: '+d.contest);
  contests.add(d.contest);
  for(const [key,nums] of Object.entries(d.results||{})){
   if(!MODES.includes(key)||!valid(nums))throw Error('Resultado inválido: '+d.contest+' / '+key);
   if(mode==='Todas'||mode===key)rows.push({date:d.date,contest:d.contest,mode:key,numbers:nums.slice().sort((a,b)=>a-b)});
  }
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.contest-b.contest||MODES.indexOf(a.mode)-MODES.indexOf(b.mode));
}
function groupData(rows){
 const groups=[],seen=new Map();
 for(const row of rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.contest-b.contest)){
  if(!valid(row.numbers))throw Error('Se requieren seis números distintos entre 00 y 45.');
  let group=seen.get(row.contest);
  if(!group){group={date:row.date,contest:row.contest,rows:[]};seen.set(row.contest,group);groups.push(group);}
  if(group.date!==row.date||group.rows.some(r=>r.mode===row.mode))throw Error('Concurso inconsistente o modalidad duplicada.');
  group.rows.push(row);
 }
 return groups;
}
function stateBank(){
 return Object.fromEntries([['full',Infinity],['recent52',52],['recent156',156],['recent416',416]].map(([key,halfLife])=>[key,{counts:new Float64Array(TOTAL),exposure:0,decay:Math.pow(.5,1/halfLife)}]));
}
function update(bank,group){
 for(const state of Object.values(bank)){
  state.exposure=state.exposure*state.decay+group.rows.length;
  for(let i=0;i<TOTAL;i++)state.counts[i]*=state.decay;
  for(const row of group.rows)for(const n of row.numbers)state.counts[n]++;
 }
}
// Coeficiente e_6: suma exacta de productos de pesos sobre TODOS los conjuntos.
function logNormalizer(logWeights,size=SIZE){
 if(size<1||size>logWeights.length||logWeights.some(x=>!Number.isFinite(x)))throw Error('Pesos inválidos.');
 const max=Math.max(...logWeights),e=new Float64Array(size+1);e[0]=1;
 for(const lw of logWeights){const w=Math.exp(lw-max);for(let k=size;k>=1;k--)e[k]+=w*e[k-1];}
 return Math.log(e[size])+size*max;
}
function fitBank(bank){
 const fits=[];
 for(const spec of SPECS){
  let logWeights;
  if(spec.id==='uniform')logWeights=Array(TOTAL).fill(0);
  else if(spec.id==='ensemble'){
   // Media geométrica de odds; incluye uniforme para reducir extremos.
   logWeights=Array.from({length:TOTAL},(_,n)=>fits.reduce((s,f)=>s+f.logWeights[n],0)/fits.length);
  }else{
   const state=bank[spec.state];
   logWeights=Array.from(state.counts,count=>{
    const p=(count+spec.prior*SIZE/TOTAL)/(state.exposure+spec.prior);
    return Math.log(p)-Math.log1p(-p);
   });
  }
  fits.push({...spec,logWeights,logZ:logNormalizer(logWeights)});
 }
 return fits;
}
const logProbability=(fit,numbers)=>numbers.reduce((s,n)=>s+fit.logWeights[n],0)-fit.logZ;
// Best-first sobre índices crecientes: cada vecino sólo pierde puntaje.
// Los K mejores conjuntos globales, no una muestra ni una selección voraz.
function topCombinations(logWeights,count=10,size=SIZE){
 if(!Number.isInteger(count)||count<1||count>100)throw Error('Elegí una cantidad entera de 1 a 100 jugadas.');
 if(size<1||size>logWeights.length||logWeights.some(x=>!Number.isFinite(x)))throw Error('Pesos inválidos.');
 const order=logWeights.map((w,n)=>({w,n})).sort((a,b)=>b.w-a.w||a.n-b.n);
 const heap=[],seen=new Set(),output=[];
 const better=(a,b)=>a.score>b.score||(a.score===b.score&&a.key<b.key);
 function push(indices){
  const key=indices.map(i=>String(i).padStart(2,'0')).join(',');
  if(seen.has(key))return;seen.add(key);
  const node={indices,key,score:indices.reduce((s,i)=>s+order[i].w,0)};
  heap.push(node);let i=heap.length-1;
  while(i>0){const p=(i-1)>>1;if(!better(heap[i],heap[p]))break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}
 }
 function pop(){
  const out=heap[0],last=heap.pop();
  if(heap.length){heap[0]=last;let i=0;while(true){let b=i,l=2*i+1,r=l+1;if(l<heap.length&&better(heap[l],heap[b]))b=l;if(r<heap.length&&better(heap[r],heap[b]))b=r;if(b===i)break;[heap[i],heap[b]]=[heap[b],heap[i]];i=b;}}
  return out;
 }
 push(Array.from({length:size},(_,i)=>i));
 while(output.length<count&&heap.length){
  const node=pop();output.push({numbers:node.indices.map(i=>order[i].n).sort((a,b)=>a-b),logScore:node.score});
  for(let i=0;i<size;i++){const next=node.indices.slice();next[i]++;if(next[i]<(i===size-1?order.length:next[i+1]))push(next);}
 }
 const best=output[0].logScore;
 return output.map((r,i)=>({...r,rank:i+1,score:100*Math.exp(r.logScore-best)}));
}
function moments(values){
 const n=values.length;if(!n)return {mean:null,ci:null};
 const mean=values.reduce((a,b)=>a+b,0)/n;if(n<20)return {mean,ci:null};
 // Newey–West: IC normal aproximado de promedios por concurso.
 const d=values.map(x=>x-mean),lag=Math.min(n-1,Math.floor(4*Math.pow(n/100,2/9)));
 let variance=d.reduce((s,x)=>s+x*x,0)/n;
 for(let k=1;k<=lag;k++){let cov=0;for(let i=k;i<n;i++)cov+=d[i]*d[i-k];variance+=2*(1-k/(lag+1))*cov/n;}
 const se=Math.sqrt(Math.max(0,variance)/n);return {mean,ci:[mean-1.96*se,mean+1.96*se]};
}
function newMetric(){return {count:0,sumHits:0,distribution:Array(7).fill(0),gains:[],groupHits:[],logLossSum:0,firstForecast:null};}
function evaluate(metric,fit,group){
 const pick=fit.logWeights.map((w,n)=>({w,n})).sort((a,b)=>b.w-a.w||a.n-b.n).slice(0,SIZE).map(x=>x.n);
 if(!metric.firstForecast)metric.firstForecast={contest:group.contest,date:group.date,numbers:pick.slice().sort((a,b)=>a-b)};
 let gains=0,hitsTotal=0;
 for(const row of group.rows){const lp=logProbability(fit,row.numbers),h=hits(pick,row.numbers);metric.count++;metric.sumHits+=h;metric.distribution[h]++;metric.logLossSum-=lp;gains+=lp-UNIFORM_LOG;hitsTotal+=h;}
 metric.gains.push(gains/group.rows.length);metric.groupHits.push(hitsTotal/group.rows.length);
}
function summarize(metric){
 const gain=moments(metric.gains),hit=moments(metric.groupHits),half=Math.floor(metric.gains.length/2);
 return {count:metric.count,contests:metric.gains.length,meanHits:hit.mean,meanHitsCI:hit.ci,distribution:metric.distribution,logLoss:gain.mean===null?null:-UNIFORM_LOG-gain.mean,logGain:gain.mean,logGainCI:gain.ci,firstForecast:metric.firstForecast,halves:[moments(metric.gains.slice(0,half)).mean,moments(metric.gains.slice(half)).mean]};
}
function analyze(rows){
 const groups=groupData(rows),n=groups.length;if(!n)throw Error('No hay resultados para esta modalidad.');
 const sufficient=n>=500,trainEnd=sufficient?Math.floor(n*.6):n,validationEnd=sufficient?Math.floor(n*.8):n;
 const bank=stateBank(),metrics=Object.fromEntries(SPECS.map(s=>[s.id,newMetric()])),audit=newMetric();let selectedId='history1000';
 const choose=()=>SPECS.filter(s=>s.id!=='uniform').map(s=>({id:s.id,value:moments(metrics[s.id].gains).mean})).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id))[0].id;
 for(let i=0;i<n;i++){
  if(sufficient&&i===validationEnd)selectedId=choose();
  if(i>=trainEnd){const fits=fitBank(bank);if(i<validationEnd)for(const fit of fits)evaluate(metrics[fit.id],fit,groups[i]);else evaluate(audit,fits.find(f=>f.id===selectedId),groups[i]);}
  // Incorporar el concurso sólo DESPUÉS de evaluar todas sus modalidades.
  update(bank,groups[i]);
 }
 const selected=fitBank(bank).find(f=>f.id===selectedId),test=summarize(audit);
 const selectionRows=SPECS.map(s=>({id:s.id,name:s.name,...summarize(metrics[s.id])}));
 const chosenValidation=selectionRows.find(s=>s.id===selectedId);
 const signal=sufficient&&chosenValidation.logGain>0&&test.logGainCI?.[0]>0&&test.halves.every(x=>x>0);
 const period=(a,b)=>a<b?{count:b-a,from:groups[a].date,to:groups[b-1].date,firstContest:groups[a].contest,lastContest:groups[b-1].contest}:null;
 return {version:VERSION,selected,sufficient,signal:Boolean(signal),count:rows.length,contests:n,last:groups[n-1].date,lastContest:groups[n-1].contest,validation:selectionRows,audit:test,split:{training:period(0,trainEnd),validation:period(trainEnd,validationEnd),test:period(validationEnd,n)},uniform:{combinationProbability:1/COMBINATIONS,expectedHits:EXPECTED_HITS,logLoss:-UNIFORM_LOG},interpretation:signal?'Señal retrospectiva favorable; requiere confirmación con sorteos nuevos.':'No se demostró una ventaja predictiva frente al azar uniforme.'};
}
function compile(rows,count=1){
 const analysis=analyze(rows),ranked=topCombinations(analysis.selected.logWeights,count);
 const frequency=new Float64Array(TOTAL),pairs=new Float64Array(TOTAL*TOTAL),triples=new Map(),last=new Int32Array(TOTAL).fill(-1),groups=groupData(rows);
 groups.forEach((g,gi)=>g.rows.forEach(row=>{const a=row.numbers.slice().sort((x,y)=>x-y);for(let i=0;i<SIZE;i++){frequency[a[i]]++;last[a[i]]=gi;for(let j=i+1;j<SIZE;j++){pairs[pairKey(a[i],a[j])]++;for(let k=j+1;k<SIZE;k++){const key=[a[i],a[j],a[k]].join(',');triples.set(key,(triples.get(key)||0)+1);}}}}));
 return {numbers:ranked[0].numbers,n:rows.length,ranked,frequency,pairs,triples,lag:Array.from(last,i=>i<0?groups.length:groups.length-1-i),analysis};
}
function backtest(rows){const a=analyze(rows);return a.sufficient?{...a.audit,expectedRandom:EXPECTED_HITS,analysis:a}:{count:0,error:'Se necesitan al menos 500 concursos para separar entrenamiento, selección y prueba.'};}
function portfolioChance(count){if(!Number.isInteger(count)||count<1||count>COMBINATIONS)throw Error('Cantidad inválida.');return {count,probability:count/COMBINATIONS,oneIn:COMBINATIONS/count};}
const api={VERSION,MODES,TOTAL,SIZE,COMBINATIONS,EXPECTED_HITS,SPECS,valid,hits,dataFor,groupData,logNormalizer,logProbability,topCombinations,moments,analyze,compile,backtest,portfolioChance};
global.QuiniModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
