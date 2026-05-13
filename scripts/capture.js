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

async function captureGNBHover(page, dir) {
  try {
    console.log('  Trying GNB hover capture...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    const targetLink = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('nav a, header a, [class*="nav"] a, [class*="gnb"] a, [class*="GNB"] a, [role="menuitem"]'));
      return links.find(a => {
        const text = a.textContent.trim().toLowerCase();
        return text.includes('computer') || text.includes('display') || text.includes('monitor');
      });
    });

    const el = targetLink.asElement();
    if (!el) {
      const navItems = await page.$$('nav > ul > li, header > nav > ul > li, [class*="nav__item"], [class*="gnb__item"]');
      for (let i = 0; i < navItems.length; i++) {
        const text = await navItems[i].evaluate(el => el.textContent.trim().toLowerCase());
        if (text.includes('computer') || text.includes('display')) {
          await navItems[i].hover();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: path.join(dir, `${today}-gnb-hover.png`), fullPage: false });
          console.log('  GNB hover captured');
          return;
        }
      }
      console.log('  GNB: no matching item found');
      return;
    }

    await el.hover();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(dir, `${today}-gnb-hover.png`), fullPage: false });
    console.log('  GNB hover captured');

  } catch (err) {
    console.log(`  GNB hover failed: ${err.message}`);
  }
}

async function fullScroll(page) {
  let previousHeight = 0;
  let attempts = 0;

  while (attempts < 20) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    let pos = 0;

    while (pos < currentHeight) {
      await page.evaluate((y) => window.scrollTo(0, y), pos);
      try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        document.querySelectorAll('img').forEach(img => {
          img.removeAttribute('loading');
          if (img.dataset.src) img.src = img.dataset.src;
          if (img.dataset.lazySrc) img.src = img.dataset.lazySrc;
        });
      });
      pos += Math.floor(viewportHeight * 0.7);
    }

    await page.waitForTimeout(5000);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log(`  Scroll attempt ${attempts + 1}: ${previousHeight} -> ${newHeight}px`);
    if (newHeight === previousHeight) break;
    previousHeight = newHeight;
    attempts++;
  }

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

    // 1. 상단 뷰
    await page.screenshot({ path: path.join(dir, `${today}-top.png`), fullPage: false });
    console.log('  Top screenshot done');

    // 2. GNB Hover (홈페이지만)
    if (site.gnbHover) {
      await captureGNBHover(page, dir);
    }

    // 3. GNB hover 해제 후 전체 페이지 캡처
    // 페이지 좌상단 로고 쪽으로 마우스 이동해서 hover 해제
    await page.mouse.move(68, 177);
    await page.waitForTimeout(1000);

    console.log('  Scrolling to load all content...');
    await fullScroll(page);

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
