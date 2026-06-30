const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const today = new Date().toISOString().split('T')[0];

const targetCountry = process.argv[2] || null;
const countries = targetCountry
  ? config.countries.filter(c => c.code === targetCountry)
  : config.countries;

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

async function captureGNBHover(page, dir, countryCode) {
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const mask = document.getElementById('appWebMask');
      if (mask) {
        mask.style.display = 'none';
        mask.style.pointerEvents = 'none';
      }
    });

    let el = null;

    if (countryCode === 'sec') {
      const target = await page.evaluateHandle(() => {
        return document.querySelector('a[data-texten="pc"], button[data-texten="pc"]');
      });
      el = target.asElement();
      if (el) console.log(`    GNB found via data-texten="pc" (KR)`);
    } else {
      const target = await page.evaluateHandle(() => {
        const allEls = Array.from(document.querySelectorAll('[an-la]'));
        return allEls.find(el => {
          const anLa = (el.getAttribute('an-la') || '').toLowerCase();
          return anLa.includes('computing and displays') ||
                 anLa.includes('computers and displays') ||
                 anLa.includes('l0_6_');
        });
      });
      el = target.asElement();
      if (el) {
        const anLa = await el.evaluate(e => e.getAttribute('an-la'));
        console.log(`    GNB found via an-la: "${anLa}"`);
      }
    }

    if (el) {
      await el.evaluate(node => {
        node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        node.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(dir, `${today}-gnb-hover.png`), fullPage: false });
      console.log(`    GNB hover captured`);
    } else {
      console.log(`    GNB not found for [${countryCode}]`);
    }
  } catch (err) {
    console.log(`    GNB hover failed: ${err.message}`);
  }
}

async function fullScroll(page) {
  // CSS 애니메이션/트랜지션 강제 비활성화
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(style);
  });

  // 스크롤하며 lazy load 트리거 + 이미지 로딩 대기
  let previousHeight = 0;
  let attempts = 0;

  while (attempts < 20) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    let pos = 0;

    while (pos < currentHeight) {
      await page.evaluate((y) => window.scrollTo(0, y), pos);

      // 뷰포트 내 이미지 로딩 대기 (최대 5초)
      await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return Promise.all(
          imgs.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
              setTimeout(resolve, 5000);
            });
          })
        );
      });

      await page.waitForTimeout(1000);
      pos += Math.floor(viewportHeight * 0.8);
    }

    await page.waitForTimeout(3000);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log(`    Scroll ${attempts + 1}: ${previousHeight} → ${newHeight}px`);
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

  // 홈페이지는 이미지 포함, Monitor Product Finder는 이미지 차단 (용량 절약)
  const blockImages = page_config.id !== 'home';

  if (blockImages) {
    await page.route('**/*.{png,jpg,jpeg,webp,gif,svg,avif}', route => {
      const url = route.request().url();
      if (url.includes('logo') || url.includes('gnb')) {
        route.continue();
      } else {
        route.abort();
      }
    });
  }

  try {
    console.log(`  [${country.code}] ${page_config.name} ${blockImages ? '(이미지 차단)' : ''}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    await acceptCookies(page);
    await page.waitForTimeout(2000);

    // 상단 뷰
    await page.screenshot({ path: path.join(dir, `${today}-top.png`), fullPage: false });

    // GNB Hover (홈페이지만)
    if (page_config.gnbHover) {
      await captureGNBHover(page, dir, country.code);
      // GNB 닫기: 빈 영역으로 마우스 이동 후 충분히 대기
      await page.mouse.move(68, 177);
      await page.waitForTimeout(500);
      await page.mouse.move(0, 500); // 페이지 중앙으로 한 번 더 이동
      await page.waitForTimeout(2000); // GNB 완전히 닫힐 때까지 대기
      await page.evaluate(() => window.scrollTo(0, 0));
      // 메인 배너/캐러셀 렌더링 추가 대기
      await page.waitForTimeout(3000);
    }

    // 전체 페이지
    console.log(`    Scrolling...`);
    await fullScroll(page);
    await page.screenshot({ path: path.join(dir, `${today}-full.png`), fullPage: true });
    console.log(`    Full screenshot done`);

    console.log(`    ✅ Done`);
    return { siteId, country: country.code, page: page_config.id, url, date: today, success: true };

  } catch (err) {
    console.error(`    ❌ Failed: ${err.message}`);
    return { siteId, country: country.code, page: page_config.id, url, date: today, success: false };
  } finally {
    await page.close();
  }
}

async function main() {
  const results = [];

  for (const country of countries) {
    console.log(`\n📍 ${country.name} (${country.code})`);
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

  const metaDir = path.join('docs', 'meta');
  fs.mkdirSync(metaDir, { recursive: true });

  const countryCode = targetCountry || 'all';
  const metaPath = path.join(metaDir, `${today}-${countryCode}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(results, null, 2));

  console.log('\n📊 Summary:');
  results.forEach(r => console.log(`  ${r.success ? '✅' : '❌'} [${r.country}] ${r.page}`));
}

main();
