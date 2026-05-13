const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const today = new Date().toISOString().split('T')[0];

function buildUrl(countryCode, pagePath) {
  return `https://www.samsung.com/${countryCode}${pagePath}`;
}

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
        await page.waitForTimeout(2000);
        return true;
      }
    } catch {}
  }
  return false;
}

async function captureGNBHover(page, dir) {
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    const targetLink = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('nav a, header a, [class*="nav"] a, [class*="gnb"] a, [role="menuitem"]'));
      return links.find(a => {
        const text = a.textContent.trim().toLowerCase();
        return text.includes('computer') || text.includes('display') || text.includes('monitor');
      });
    });

    const el = targetLink.asElement();
    if (el) {
      await el.hover();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(dir, `${today}-gnb-hover.png`), fullPage: false });
      console.log('    GNB hover captured');
    } else {
      console.log('    GNB: no matching item found');
    }
  } catch (err) {
    console.log(`    GNB hover failed: ${err.message}`);
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
    if (newHeight === previousHeight) break;
    previousHeight = newHeight;
    attempts++;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(3000);
}

async function captureSite(context, country, page_config) {
  const url = buildUrl(country.code, page_config.path);
  const siteId = `${country.code}-${page_config.id}`;
  const dir = path.join('docs', 'screenshots', siteId);
  fs.mkdirSync(dir, { recursive: true });

  const page = await context.newPage();
  try {
    console.log(`  [${country.code}] ${page_config.name} - ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    await acceptCookies(page);
    await page.waitForTimeout(2000);

    // 상단 뷰
    await page.screenshot({ path: path.join(dir, `${today}-top.png`), fullPage: false });

    // GNB Hover (홈페이지만)
    if (page_config.gnbHover) {
      await captureGNBHover(page, dir);
    }

    // hover 해제
    await page.mouse.move(68, 177);
    await page.waitForTimeout(1000);

    // 전체 페이지
    await fullScroll(page);
    await page.screenshot({ path: path.join(dir, `${today}-full.png`), fullPage: true });

    console.log(`    ✅ Done`);
    return { siteId, country: country.code, page: page_config.id, url, date: today, success: true };

  } catch (err) {
    console.error(`    ❌ Failed: ${err.message}`);
    return { siteId, country: country.code, page: page_config.id, url, date: today, success: false, error: err.message };
  } finally {
    await page.close();
  }
}

async function main() {
  const results = [];

  for (const country of config.countries) {
    console.log(`\n📍 Country: ${country.name}`);

    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' }
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    for (const page_config of config.pages) {
      const result = await captureSite(context, country, page_config);
      results.push(result);
    }

    await browser.close();
  }

  // 메타데이터 저장
  const metaDir = path.join('docs', 'meta');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, `${today}.json`), JSON.stringify(results, null, 2));

  const indexPath = path.join(metaDir, 'index.json');
  let index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
  if (!index.includes(today)) { index.unshift(today); fs.writeFileSync(indexPath, JSON.stringify(index, null, 2)); }

  console.log('\n📊 Summary:');
  results.forEach(r => console.log(`  ${r.success ? '✅' : '❌'} [${r.country}] ${r.page}`));
}

main();
