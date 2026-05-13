const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const today = new Date().toISOString().split('T')[0];

async function acceptCookies(page) {
  const cookieSelectors = [
    '#truste-consent-button',
    '#onetrust-accept-btn-handler',
    'button[id*="accept"]',
    'button[class*="accept"]',
    '.truste_overlay .pdynamicbutton .call',
    '[aria-label*="Accept"]',
    '[aria-label*="accept"]',
  ];
  for (const selector of cookieSelectors) {
    try {
      const btn = await page.waitForSelector(selector, { timeout: 5000 });
      if (btn) {
        await btn.click();
        console.log(`  Cookie accepted via: ${selector}`);
        await page.waitForTimeout(2000);
        return true;
      }
    } catch {}
  }
  console.log('  No cookie banner found');
  return false;
}

async function disableLazyLoadAndScroll(page) {
  // 1. 모든 이미지의 lazy loading 속성 제거
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
      img.removeAttribute('loading');
      // src가 data-src에 있는 경우도 처리
      if (img.dataset.src) img.src = img.dataset.src;
      if (img.dataset.lazySrc) img.src = img.dataset.lazySrc;
    });
  });

  // 2. IntersectionObserver 기반 lazy load도 트리거하기 위해 스크롤
  let previousHeight = 0;
  let attempts = 0;

  while (attempts < 20) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    let pos = 0;

    while (pos < currentHeight) {
      await page.evaluate((y) => window.scrollTo(0, y), pos);
      await page.waitForTimeout(800);
      pos += Math.floor(viewportHeight * 0.8); // 80% 겹치게 스크롤
    }

    // lazy load 재처리
    await page.evaluate(() => {
      document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        img.removeAttribute('loading');
        if (img.dataset.src) img.src = img.dataset.src;
        if (img.dataset.lazySrc) img.src = img.dataset.lazySrc;
      });
    });

    await page.waitForTimeout(5000);

    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log(`  Scroll attempt ${attempts + 1}: ${previousHeight} -> ${newHeight}px`);

    if (newHeight === previousHeight) break;
    previousHeight = newHeight;
    attempts++;
  }

  // 맨 위로 복귀
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(3000);
}

async function capture(site) {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    extraHTTPHeaders: { 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8' }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en'] });
  });

  const page = await context.newPage();

  try {
    console.log(`\nCapturing: ${site.name}`);
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    await acceptCookies(page);
    await page.waitForTimeout(2000);

    const dir = path.join('docs', 'screenshots', site.id);
    fs.mkdirSync(dir, { recursive: true });

    // 상단 캡처
    await page.screenshot({ path: path.join(dir, `${today}-top.png`), fullPage: false });
    console.log('  Top screenshot done');

    // lazy load 제거 + 스크롤
    console.log('  Disabling lazy load and scrolling...');
    await disableLazyLoadAndScroll(page);

    // 전체 캡처
    await page.screenshot({ path: path.join(dir, `${today}-full.png`), fullPage: true });
    console.log('  Full screenshot done');

    return { id: site.id, name: site.name, url: site.url, date: today, success: true };

  } catch (err) {
    console.error(`  Failed: ${site.name} - ${err.message}`);
    return { id: site.id, name: site.name, url: site.url, date: today, success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

async function main() {
  const results = [];
  for (const site of config.sites) results.push(await capture(site));

  const metaDir = path.join('docs', 'meta');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, `${today}.json`), JSON.stringify(results, null, 2));

  const indexPath = path.join(metaDir, 'index.json');
  let index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
  if (!index.includes(today)) { index.unshift(today); fs.writeFileSync(indexPath, JSON.stringify(index, null, 2)); }

  console.log('\nSummary:');
  results.forEach(r => console.log(`  ${r.success ? '✅' : '❌'} ${r.name}`));
}

main();
