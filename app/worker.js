'use strict';
importScripts('./model.js?v=2.0.0','./legacy-model.js?v=2.0.0');
let history=[],cache=new Map();
self.onmessage=event=>{
 const {id,type,draws,mode,count}=event.data;
 try{
  if(type==='init'){history=draws;cache.clear();postMessage({id,ok:true});return;}
  if(type==='legacy'){postMessage({id,result:QuiniLegacy.backtest(QuiniModel.dataFor(history,mode),80)});return;}
  if(!cache.has(mode))cache.set(mode,QuiniModel.compile(QuiniModel.dataFor(history,mode)));
  const model=cache.get(mode),ranked=QuiniModel.topCombinations(model.analysis.selected.logWeights,count);
  postMessage({id,result:{...model,ranked,numbers:ranked[0].numbers}});
 }catch(error){postMessage({id,error:error.message});}
};
