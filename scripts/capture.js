const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const today = new Date().toISOString().split('T')[0];

// 실행 시 국가 코드 인자 받기 (병렬 실행용)
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

async function captureGNBHover(page, dir, gnbText) {
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    const target = await page.evaluateHandle((text) => {
      const allEls = Array.from(document.querySelectorAll('nav a, header a, nav button, header button, nav li, [class*="gnb"] li, [class*="nav"] li'));
      return allEls.find(el => el.textContent.trim() === text);
    }, gnbText);

    const el = target.asElement();
    if (el) {
      await el.hover();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(dir, `${today}-gnb-hover.png`), fullPage: false });
      console.log(`    GNB hover captured: "${gnbText}"`);
    } else {
      console.log(`    GNB not found: "${gnbText}"`);
    }
  } catch (err) {
    console.log(`    GNB hover failed: ${err.message}`);
  }
}

// Scroll-triggered Animation + lazy load 완전 대응 스크롤
async function fullScroll(page) {
  // 1단계: 모든 애니메이션 CSS 비활성화 (스크롤 전에 미리)
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0.01ms !important;
        transition-delay: 0ms !important;
      }
    `
  });

  let previousHeight = 0;
  let attempts = 0;

  while (attempts < 20) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    let pos = 0;

    // 2단계: 천천히 스크롤하며 scroll-trigger 이벤트 발동
    while (pos < currentHeight) {
      await page.evaluate((y) => window.scrollTo(0, y), pos);
      try { await page.waitForLoadState('networkidle', { timeout: 4000 }); } catch {}
      await page.waitForTimeout(800);

      // 3단계: 강화된 lazy load 처리
      await page.evaluate(() => {
        // 일반 lazy img
        document.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy-src], img[data-lazysrc]').forEach(img => {
          img.removeAttribute('loading');
          if (img.dataset.src) img.src = img.dataset.src;
          if (img.dataset.lazySrc) img.src = img.dataset.lazySrc;
          if (img.dataset.lazysrc) img.src = img.dataset.lazysrc;
        });

        // picture > source lazy
        document.querySelectorAll('source[data-srcset], source[data-lazy-srcset]').forEach(src => {
          if (src.dataset.srcset) src.srcset = src.dataset.srcset;
          if (src.dataset.lazySrcset) src.srcset = src.dataset.lazySrcset;
        });

        // background-image lazy (공통 패턴)
        document.querySelectorAll('[data-bg], [data-background]').forEach(el => {
          if (el.dataset.bg) el.style.backgroundImage = `url(${el.dataset.bg})`;
          if (el.dataset.background) el.style.backgroundImage = `url(${el.dataset.background})`;
        });

        // Intersection Observer 강제 트리거 (스크롤 이벤트 발사)
        window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));
      });

      pos += Math.floor(viewportHeight * 0.6); // 더 세밀하게 스크롤
    }

    await page.waitForTimeout(4000);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === previousHeight) break;
    previousHeight = newHeight;
    attempts++;
  }

  // 맨 위로 복귀 후 안정화
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
    console.log(`  [${country.code}] ${page_config.name}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    await acceptCookies(page);
    await page.waitForTimeout(2000);

    // 상단 뷰 캡처
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(dir, `${today}-top.png`), fullPage: false });

    // GNB Hover 캡처 (Homepage만)
    if (page_config.gnbHover && country.gnbText) {
      await captureGNBHover(page, dir, country.gnbText);
    }

    // 전체 스크롤 (lazy load + scroll animation 트리거)
    await page.mouse.move(68, 177);
    await page.waitForTimeout(1000);
    await fullScroll(page);

    // Monitors 페이지는 전체 스크린샷 추가 캡처
    if (page_config.captureFullPage) {
      await page.screenshot({ path: path.join(dir, `${today}-full.png`), fullPage: true });
      console.log(`    Full page captured`);
    }

    // Homepage도 full 저장 (기존 유지)
    if (!page_config.captureFullPage) {
      await page.screenshot({ path: path.join(dir, `${today}-full.png`), fullPage: true });
    }

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

  // 메타데이터 저장
  const metaDir = path.join('docs', 'meta');
  fs.mkdirSync(metaDir, { recursive: true });

  const todayMetaPath = path.join(metaDir, `${today}.json`);
  let existing = [];
  if (fs.existsSync(todayMetaPath)) {
    existing = JSON.parse(fs.readFileSync(todayMetaPath, 'utf8'));
  }
  const merged = [...existing.filter(r => !results.find(nr => nr.siteId === r.siteId)), ...results];
  fs.writeFileSync(todayMetaPath, JSON.stringify(merged, null, 2));

  const indexPath = path.join(metaDir, 'index.json');
  let index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
  if (!index.includes(today)) { index.unshift(today); fs.writeFileSync(indexPath, JSON.stringify(index, null, 2)); }

  console.log('\n📊 Summary:');
  results.forEach(r => console.log(`  ${r.success ? '✅' : '❌'} [${r.country}] ${r.page}`));
}

main();
