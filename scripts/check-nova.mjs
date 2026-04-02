import puppeteer from 'puppeteer';

(async () => {
  const url = process.argv[2] || 'http://localhost:5173';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[browser:${type}] ${text}`);
  });
  page.on('pageerror', err => {
    console.log(`[pageerror] ${err.message}`);
  });
  page.on('requestfailed', req => {
    console.log(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`);
  });
  try {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log(`[nav] status ${res?.status()}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const content = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log(`[body] ${content}`);
  } catch (e) {
    console.log(`[nav-error] ${e.message}`);
  }
  await browser.close();
})();
