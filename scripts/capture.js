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

async function fullScroll(page) {
  // 페이지 전체 높이를 파악하면서 끝까지 스크롤
  let previousHeight = 0;
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);

    // 100px씩 아주 천천히 스크롤
    await page.evaluate(async (height) => {
      await new Promise((resolve) => {
        let pos = window.scrollY;
        const timer = setInterval(() => {
          window.scrollBy(0, 100);
          pos += 100;
          if (pos >= height) {
            clearInterval(timer);
            resolve();
          }
        }, 150); // 150ms마다 100px 스크롤
      });
    }, currentHeight);

    // 새 컨텐츠 로딩 대기
    await page.waitForTimeout(2000);

    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log(`  Scroll attempt ${attempts + 1}: height ${previousHeight} -> ${newHeight}`);

    // 높이가 더 이상 안 늘어나면 완료
    if (newHeight === previousHeight) break;

    previousHeight = newHeight;
    attempts++;
  }

  // 맨 위로 복귀
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
}

async function capture(site) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    console.log(`\nCapturing: ${site.name}`);
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // 쿠키 동의
    await acceptCookies(page);
    await page.waitForTimeout(1500);

    const dir = path.join('docs', 'screenshots', site.id);
    fs.mkdirSync(dir, { recursive: true });

    // 상단 캡처
    await page.screenshot({ path: path.join(dir, `${today}-top.png`), fullPage: false });
    console.log('  Top screenshot done');

    // 전체 스크롤해서 lazy load 트리거
    console.log('  Scrolling to load all content...');
    await fullScroll(page);

    // 전체 페이지 캡처
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
