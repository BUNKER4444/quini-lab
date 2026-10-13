'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('../app/model.js'),L=require('../app/legacy-model.js');
const data=JSON.parse(fs.readFileSync(new URL('../app/data.json',`file://${__filename}`),'utf8'));
function exhaustive(weights,k){
 const out=[];
 function visit(start,a){if(a.length===k){out.push({numbers:a.slice(),score:a.reduce((s,i)=>s+weights[i],0)});return;}for(let i=start;i<=weights.length-(k-a.length);i++){a.push(i);visit(i+1,a);a.pop();}}
 visit(0,[]);return out.sort((a,b)=>b.score-a.score);
}
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('base real: totales, modalidades, unicidad y seis números válidos',()=>{
 const rows=M.dataFor(data.draws,'Todas');assert.equal(data.draw_count,data.draws.length);assert.equal(rows.length,data.record_count);
 assert.equal(rows.length,data.draws.length*4);assert.equal(new Set(rows.map(r=>r.contest+'|'+r.mode)).size,rows.length);
 assert.equal(rows[0].date,data.first_date);assert.equal(rows.at(-1).date,data.last_date);
 for(const mode of M.MODES)assert.equal(M.dataFor(data.draws,mode).length,data.draws.length);
});
test('probabilidades normalizadas: suma uno para todos los conjuntos pequeños',()=>{
 const weights=[-.2,-3,-.1,.2,2.1,-.7,1.1,.3,1.4,0],all=exhaustive(weights,6),z=M.logNormalizer(weights);
 near(all.reduce((s,r)=>s+Math.exp(r.score-z),0),1);
 near(M.logNormalizer(Array(46).fill(0)),Math.log(9366819));
 near(M.logNormalizer(weights.map(x=>x+100))-600,z);
});
test('ranking global exacto contra enumeración exhaustiva independiente',()=>{
 for(const weights of [[.1,-1.8,2.3,.42,-.3,.17,1.21,.8,1.71,-.23],Array(10).fill(0),[1,1,0,0,2,2,-1,-1,3,3]]){
  const oracle=exhaustive(weights,6),ranked=M.topCombinations(weights,100);
  assert.equal(ranked.length,100);assert.equal(new Set(ranked.map(r=>r.numbers.join(','))).size,100);
  for(let i=0;i<ranked.length;i++){near(ranked[i].logScore,oracle[i].score);assert.equal(ranked[i].rank,i+1);assert.ok(M.valid(ranked[i].numbers));}
 }
});
test('1, 10 y 100: sin duplicados, sin modificar el prefijo y orden decreciente',()=>{
 const w=Array.from({length:46},(_,i)=>Math.sin(i*1.731));
 const a=M.topCombinations(w,1),b=M.topCombinations(w,10),c=M.topCombinations(w,100);
 assert.deepEqual(a,b.slice(0,1));assert.deepEqual(b,c.slice(0,10));assert.equal(new Set(c.map(r=>r.numbers.join(','))).size,100);
 for(let i=1;i<c.length;i++)assert.ok(c[i].logScore<=c[i-1].logScore+1e-12);
});
test('rechaza cantidades inválidas y resultados corruptos',()=>{
 for(const n of [0,-1,101,1.5,NaN,Infinity,'10'])assert.throws(()=>M.topCombinations(Array(46).fill(0),n));
 const base={contest:1,date:'2026-01-01',results:{Tradicional:[0,1,2,3,4,5]}};
 assert.throws(()=>M.dataFor([base,base],'Tradicional'));
 for(const numbers of [[0,0,1,2,3,4],[0,1,2,3,4,46],[0,1,2,3,4]])assert.throws(()=>M.dataFor([{...base,results:{Tradicional:numbers}}],'Tradicional'));
 assert.throws(()=>M.dataFor([{...base,date:'2026-02-30'}],'Tradicional'));
 assert.throws(()=>M.analyze([]));
});
test('10 apuestas distintas cubren exactamente 10 resultados posibles',()=>{
 near(M.portfolioChance(10).probability,10/9366819);near(M.portfolioChance(10).oneIn,936681.9);
 assert.throws(()=>M.portfolioChance(0));
});
test('prueba temporal real: selección congelada y primer pronóstico sin usar prueba final',()=>{
 const rows=M.dataFor(data.draws,'Tradicional'),a=M.analyze(rows),changed=structuredClone(rows),start=Math.floor(rows.length*.8);
 for(let i=start;i<changed.length;i++)changed[i].numbers=[0,1,2,3,4,5];
 const b=M.analyze(changed);
 assert.equal(a.selected.id,b.selected.id);assert.deepEqual(a.validation,b.validation);
 assert.deepEqual(a.audit.firstForecast,b.audit.firstForecast);
 assert.equal(a.audit.count,rows.length-start);assert.equal(a.audit.distribution.reduce((s,n)=>s+n),a.audit.count);
 assert.ok(a.split.training.lastContest<a.split.validation.firstContest);
 assert.ok(a.split.validation.lastContest<a.split.test.firstContest);
});
test('Todas: un concurso completo antes de aprender; orden de modalidades irrelevante',()=>{
 const rows=M.dataFor(data.draws,'Todas'),a=M.analyze(rows),b=M.analyze(rows.slice().reverse());
 assert.equal(a.audit.count,a.audit.contests*4);assert.equal(a.selected.id,b.selected.id);
 near(a.audit.logGain,b.audit.logGain);assert.deepEqual(a.audit.firstForecast,b.audit.firstForecast);
 const changed=structuredClone(rows),cutoff=a.split.test.firstContest;
 for(const r of changed)if(r.contest>=cutoff)r.numbers=[40,41,42,43,44,45];
 const c=M.analyze(changed);assert.equal(c.selected.id,a.selected.id);assert.deepEqual(c.audit.firstForecast,a.audit.firstForecast);
});
test('todas las modalidades: cálculos finitos y ranking normalizado sin ventaja inventada',()=>{
 for(const mode of [...M.MODES,'Todas']){
  const m=M.compile(M.dataFor(data.draws,mode),10),a=m.analysis;
  assert.equal(m.ranked.length,10);assert.ok(a.audit.logGainCI.every(Number.isFinite));assert.equal(m.frequency.reduce((s,n)=>s+n),m.n*6);
  assert.equal(m.pairs.reduce((s,n)=>s+n),m.n*15);assert.equal([...m.triples.values()].reduce((s,n)=>s+n),m.n*20);
  near(m.ranked[0].score,100);assert.ok(a.validation.some(v=>v.id==='uniform'));
  assert.equal(a.signal,Boolean(a.validation.find(v=>v.id===a.selected.id).logGain>0&&a.audit.logGainCI[0]>0&&a.audit.halves.every(x=>x>0)));
 }
});
test('backtest anterior ejecuta sin error de constante y nueva API conserva contrato',()=>{
 const rows=M.dataFor(data.draws,'Tradicional'),r=L.backtest(rows,8);
 assert.equal(r.count,8);assert.ok(Number.isFinite(r.meanHits));assert.equal(r.distribution.reduce((s,n)=>s+n),8);
 assert.ok(M.backtest(rows).count>0);assert.ok(M.backtest(rows.slice(0,50)).error);
});
