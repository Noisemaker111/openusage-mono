import { chromium } from 'playwright';

async function compare() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  
  // Take screenshot of original
  const page1 = await context.newPage();
  await page1.goto('https://www.openusage.ai');
  await page1.waitForLoadState('networkidle');
  await page1.screenshot({ path: 'original.png', fullPage: true });
  
  // Take screenshot of local
  const page2 = await context.newPage();
  await page2.goto('http://localhost:5173');
  await page2.waitForLoadState('networkidle');
  await page2.screenshot({ path: 'local.png', fullPage: true });
  
  await browser.close();
  console.log('Screenshots taken: original.png and local.png');
}

compare().catch(console.error);
