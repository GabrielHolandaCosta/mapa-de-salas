import { chromium, request } from 'playwright-core';
import path from 'node:path';

const baseURL=process.env.MAPA_BASE_URL||'http://localhost:3000';
const output=process.argv[2]||process.cwd();
const username=`ajudaviewer${Date.now()}`;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
let userId;
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(baseURL);
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('123456');
  await page.locator('#loginForm button').click();
  await page.waitForSelector('#adminPage:not([hidden])');
  userId=await page.evaluate(async credentials=>{const response=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});const data=await response.json();if(!response.ok)throw new Error(data.error);return data.row.id},{name:'Ajuda Visualizador',username,password:'123456',role:'VIEWER'});
  await page.locator('#adminLogout').click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill('123456');
  await page.locator('#loginForm button').click();
  await page.waitForSelector('.help-dialog[open]');
  if(await page.locator('.help-dialog').getAttribute('data-role')!=='viewer')throw new Error('Guia incorreto para Visualizador');
  if(await page.locator('.help-copy h3').textContent()!=='Entenda o mapa em segundos')throw new Error('Primeiro passo do Visualizador incorreto');
  await page.screenshot({path:path.join(output,'mapa-ajuda-visualizador.png')});
  for(let step=1;step<5;step++)await page.locator('.help-next').click();
  if(await page.locator('.help-copy h3').textContent()!=='Exporte e personalize')throw new Error('Último passo do Visualizador incorreto');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'mapa-ajuda-visualizador-mobile.png')});
}finally{
  await browser.close();
  if(userId){const context=await request.newContext({baseURL});await context.post('/api/auth/login',{data:{username:'admin',password:'123456'}});await context.delete(`/api/users/${userId}`);await context.dispose()}
}
