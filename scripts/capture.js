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

async function slowScroll(page) {
  // 페이지 전체 높이만큼 천천히 스크롤 - lazy load 이미지 트리거
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const distance = 200;   // 한 번에 스크롤할 픽셀
      const delay = 300;      // 각 스크롤 사이 대기 시간 (ms)
      let currentPos = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        currentPos += distance;

        if (currentPos >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0); // 맨 위로 복귀
          resolve();
        }
      }, delay);
    });
  });

  // 스크롤 후 이미지/컴포넌트 렌더링 완료 대기
  await page.waitForTimeout(3000);
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

    // 상단 뷰포트 캡처 (쿠키창 닫힌 후)
    const dir = path.join('docs', 'screenshots', site.id);
    fs.mkdirSync(dir, { recursive: true });

    await page.screenshot({
      path: path.join(dir, `${today}-top.png`),
      fullPage: false
    });
    console.log('  Top screenshot done');

    // 천천히 스크롤해서 모든 lazy load 콘텐츠 로딩
    console.log('  Scrolling to load all content...');
    await slowScroll(page);

    // 2차 스크롤 (혹시 첫 번째 스크롤로 로딩된 컨텐츠에 또 lazy load가 있을 경우)
    await slowScroll(page);

    // 전체 페이지 캡처
    await page.screenshot({
      path: path.join(dir, `${today}-full.png`),
      fullPage: true
    });
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
