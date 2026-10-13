/* Quini Lab: modelo exploratorio determinista, sin ventaja predictiva demostrada. */
(function(global) {
"use strict";
const MODES=["Tradicional","La Segunda","Revancha","Siempre Sale"];
const TOTAL=46;
const normalize=(a)=>Array.isArray(a)&&a.length===6&&new Set(a).size===6&&a.every(n=>Number.isInteger(n)&&n>=0&&n<46);
const pairKey=(a,b)=>Math.min(a,b)*46+Math.max(a,b);
const tripleKey=(a,b,c)=>[a,b,c].sort((x,y)=>x-y).join(",");
function dataFor(draws,mode){
const arr=[];
for(const d of draws||[]) for(const [key,nums] of Object.entries(d.results||{})){
if((mode==="Todas"||mode===key)&&normalize(nums)) arr.push({date:d.date,contest:d.contest,mode:key,numbers:nums.slice().sort((a,b)=>a-b)});
}
return arr.sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.contest)-Number(b.contest));
}
function compile(data){
const n=data.length,freq=new Float64Array(46),recent=new Float64Array(46),pairs=new Float64Array(46*46),triples=new Map(),last=new Int32Array(46);
last.fill(-1);
for(let ix=0;ix<n;ix++){
const a=data[ix].numbers;
const weight=Math.exp(-(n-1-ix)/Math.max(50,Math.min(240,n/3)));
for(let i=0;i<6;i++){
const v=a[i];freq[v]++;recent[v]+=weight;last[v]=ix;
for(let j=i+1;j<6;j++){
pairs[pairKey(v,a[j])]++;
for(let k=j+1;k<6;k++){const key=tripleKey(v,a[j],a[k]);triples.set(key,(triples.get(key)||0)+1)}
}
}
}
const recentTotal=recent.reduce((a,b)=>a+b,0), expectedPair=n*30/(46*45),expectedTriple=n*120/(46*45*44);
const freqExpectation=n*6/46,recentExpectation=recentTotal/46;
const smooth=(observed,expected)=>Math.log((observed+Math.max(3,expected*.35))/(expected+Math.max(3,expected*.35)));
function scoreIndividual(i){
const f=smooth(freq[i],freqExpectation);
const r=smooth(recent[i],recentExpectation);
const lag=last[i]<0?n:n-1-last[i];
const overdue=Math.min(lag,Math.max(1,n/10))/Math.max(1,n/10);
return 0.43*f+0.12*r+0.05*(overdue-.5);
}
function scoreJoint(i,chosen){
let sum=0;
if(chosen.length){
let ps=0;for(const j of chosen)ps+=smooth(pairs[pairKey(i,j)],expectedPair);
sum+=0.27*ps/chosen.length;
}
if(chosen.length>=2){
let ts=0,ct=0;
for(let x=0;x<chosen.length;x++)for(let y=x+1;y<chosen.length;y++){
ts+=smooth(triples.get(tripleKey(i,chosen[x],chosen[y]))||0,expectedTriple);ct++;
}
sum+=0.13*ts/ct;
}
return sum;
}
const chosen=[];
for(let turn=0;turn<6;turn++){
let best=-1,value=-Infinity;
for(let i=0;i<46;i++){
if(chosen.includes(i))continue;
const s=scoreIndividual(i)+scoreJoint(i,chosen);
if(s>value+1e-12){best=i;value=s;}
}
chosen.push(best);
}
chosen.sort((a,b)=>a-b);
return {numbers:chosen,n,details:{frequencyWeight:43,recentWeight:12,overdueWeight:5,pairWeight:27,tripleWeight:13},frequency:freq,pairs,triples};
}
function hits(a,b){return a.filter(x=>b.includes(x)).length}
function backtest(data,limit=80){
const minTrain=300, checked=Math.min(limit,Math.max(0,data.length-minTrain));
if(!checked)return {count:0,error:"Se necesitan al menos 301 extracciones."};
const start=data.length-checked,distribution=Array(7).fill(0),recs=[],nOut=0;
for(let idx=start;idx<data.length;idx++){
const result=compile(data.slice(0,idx));
const h=hits(result.numbers,data[idx].numbers);
distribution[h]++;recs.push({date:data[idx].date,mode:data[idx].mode,hits:h});nOut+=h;
}
const expected=36/46;
return {count:checked,meanHits:nOut/checked,expectedRandom:expected,distribution,latest:recs.slice(-8),method:"Evaluación temporal: cada pronóstico utiliza solamente sorteos anteriores al evaluado."};
}
global.QuiniModel={MODES,dataFor,compile,backtest};
})(window);
