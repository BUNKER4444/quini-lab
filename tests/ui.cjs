/* QA opcional: NODE_PATH con Playwright instalado; no dependencias de producción. */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../app'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const p=path.join(root,name==='/'?'index.html':name);
  if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403);res.end();return;}
  try{res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const dataset=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
 const contests=dataset.draw_count.toLocaleString('es-AR');
 const testRows=((dataset.draw_count-Math.floor(dataset.draw_count*.8))*4).toLocaleString('es-AR');
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1365,height:1000},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#forecast').waitFor({state:'visible'});
  const rowTexts=()=>page.locator('#ranked tr td:nth-child(2)').allTextContents();
  let ten=await rowTexts();assert.equal(ten.length,10);
  await page.locator('#quantity').fill('100');await page.locator('#generate').click();await page.locator('#forecast').waitFor({state:'visible'});
  const hundred=await rowTexts();assert.equal(hundred.length,100);assert.deepEqual(hundred.slice(0,10),ten);assert.equal(new Set(hundred).size,100);
  await page.locator('#quantity').fill('1');await page.locator('#generate').click();await page.locator('#forecast').waitFor({state:'visible'});assert.deepEqual(await rowTexts(),ten.slice(0,1));
  await page.locator('#quantity').fill('0');assert.equal(await page.locator('#forecast').isVisible(),false);assert.equal(await page.locator('#copyAll').isDisabled(),true);
  await page.locator('#quantity').fill('10');await page.locator('#generate').click();await page.locator('#forecast').waitFor({state:'visible'});
  await page.locator('#copyAll').click();assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('10. '));
  const download=page.waitForEvent('download');await page.locator('#exportPicks').click();const exported=await download;
  const csv=fs.readFileSync(await exported.path(),'utf8');assert.equal(csv.trim().split('\r\n').length,11);assert.ok(csv.includes('1/9366819'));
  await page.locator('#mode').selectOption('Todas');await page.locator('#forecast').waitFor({state:'visible'});assert.equal((await rowTexts()).length,10);
  await page.locator('#backtest').click();assert.ok((await page.locator('#validation').innerText()).includes(testRows+' extracciones'));
  await page.locator('summary').filter({hasText:'Comparar con el algoritmo anterior'}).click();await page.locator('#legacy-test').click();await page.waitForFunction(()=>document.getElementById('legacy-result').textContent.includes('80 extracciones'));
  await page.locator('#reload').click();await page.locator('#forecast').waitFor({state:'visible'});
  await page.locator('#mode').selectOption('Tradicional');await page.locator('#forecast').waitFor({state:'visible'});
  const qa=process.env.QUINI_QA_DIR;if(qa){fs.mkdirSync(qa,{recursive:true});await page.screenshot({path:path.join(qa,'desktop.png'),fullPage:false});}
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(qa)await page.screenshot({path:path.join(qa,'mobile.png'),fullPage:false});
  await page.goto(base+'/historial.html');await page.waitForFunction(expected=>document.getElementById('count').textContent.includes(expected),contests);
  await page.locator('#contest').fill(String(dataset.draws[0].contest));assert.ok((await page.locator('#count').innerText()).startsWith('1 concursos'));
  await page.locator('#clear').click();await page.locator('#number').fill('0');assert.ok((await page.locator('#list').innerText()).includes('00'));
  await page.goto(base);await page.locator('#forecast').waitFor({state:'visible'});
  await page.route('**/data.json?*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"draws":[]}'}));
  await page.locator('#reload').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('No se pudo cargar'));
  assert.equal(await page.locator('#forecast').isVisible(),false);assert.equal(await page.locator('#copyPick').isDisabled(),true);
  assert.deepEqual(errors,[]);console.log('QA OK: 1/10/100, prefijos, modalidades, validación, legado, copia, CSV, historial, móvil y errores.');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
