import { chromium, request } from 'playwright-core';
import path from 'node:path';

const output = process.argv[2] || process.cwd();
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const username = `visual${Date.now()}`;
let userId;
const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:3000');
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('123456');
  await page.locator('#loginForm button').click();
  await page.waitForSelector('#adminPage:not([hidden])');
  await page.screenshot({ path: path.join(output, 'mapa-admin.png'), fullPage: true });
  userId = await page.evaluate(async credentials => {
    const response = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(credentials) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data.row.id;
  }, { name:'Teste Visual', username, password:'123456', role:'EDITOR' });
  await page.locator('#adminLogout').click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill('123456');
  await page.locator('#loginForm button').click();
  await page.waitForSelector('#workspace:not([hidden])');
  await page.screenshot({ path: path.join(output, 'mapa-desktop.png'), fullPage: true });
  await page.setViewportSize({ width:390, height:844 });
  await page.reload();
  await page.waitForSelector('#workspace:not([hidden])');
  await page.screenshot({ path: path.join(output, 'mapa-mobile.png'), fullPage: true });
  await page.locator('[data-shift="TARDE"]').click();
  await page.locator('#mobileSchedule [data-cell]').first().click();
  await page.waitForSelector('#cellDialog[open]');
  await page.screenshot({ path: path.join(output, 'mapa-mobile-editor.png'), fullPage: true });
} finally {
  await browser.close();
  if (userId) {
    const context = await request.newContext({ baseURL:'http://localhost:3000' });
    await context.post('/api/auth/login', { data:{ username:'admin', password:'123456' } });
    await context.delete(`/api/users/${userId}`);
    await context.dispose();
  }
}
