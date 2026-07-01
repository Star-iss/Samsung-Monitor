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
  // CSS 애니메이션/트랜지션 강제 비활성화 + 숨겨진 콘텐츠 강제 표시
  await page.evaluate(() => {
    // 1. CSS 애니메이션/트랜지션 0초로
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

    // 2. Waypoint 라이브러리 비활성화 (trigger queue 초기화 + disable)
    if (window.Waypoint) {
      try {
        window.Waypoint.destroyAll();
      } catch (e) {}
    }
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.waypoint) {
      try {
        window.jQuery('[data-waypoint]').waypoint('destroy');
      } catch (e) {}
    }

    // 3. 스크롤 트리거로 나타나는 요소들 강제 표시
    //    (보통 opacity:0, visibility:hidden, transform으로 숨겨져 있다가 클래스 추가로 나타남)
    const hiddenSelectors = [
      '[class*="animated"]',
      '[class*="fade"]',
      '[class*="reveal"]',
      '[class*="animate"]',
      '[class*="scroll-"]',
      '[data-aos]',           // AOS 라이브러리
      '[data-wow]',           // WOW.js
      '.wow',
      '.aos-init',
    ];
    hiddenSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.style.transform = 'none';
        el.style.transition = 'none';
        el.style.animation = 'none';
        // AOS 클래스 강제 적용
        el.classList.add('aos-animate');
        el.setAttribute('data-aos-delay', '0');
      });
    });

    // 4. IntersectionObserver 기반 lazy load 강제 트리거
    if (window.AOS) {
      try { window.AOS.refresh(); } catch (e) {}
    }
  });

  // 스크롤하며 lazy load 트리거
  let previousHeight = 0;
  let attempts = 0;
  const MIN_CYCLES = 2;

  await page.mouse.move(400, 400);

  while (attempts < 20) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    let pos = 0;

    while (pos < currentHeight) {
      const before = await page.evaluate(() => window.scrollY);
      const targetDelta = Math.floor(viewportHeight * 0.8);

      // 실제 휠 이벤트로 스크롤 (Waypoint 라이브러리 트리거)
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        await page.mouse.wheel(0, targetDelta / steps);
        await page.waitForTimeout(50);
      }

      const after = await page.evaluate(() => window.scrollY);
      pos = after;

      // 맨 아래 도달 시 scrollTo 보정
      if (after === before) {
        await page.evaluate((y) => window.scrollTo(0, y), pos + targetDelta);
        await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
      }

      // 각 스크롤 위치에서 렌더링 대기 (1초)
      await page.waitForTimeout(1000);

      if (pos >= currentHeight - viewportHeight - 5) break;
    }

    await page.waitForTimeout(2000);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log(`    Scroll ${attempts + 1}: ${previousHeight} → ${newHeight}px`);
    if (newHeight === previousHeight && attempts + 1 >= MIN_CYCLES) break;
    previousHeight = newHeight;
    attempts++;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);
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

    // 봇 차단(Akamai 등) 감지 시 재시도하며 goto
    let blocked = true;
    let lastErr = null;
    for (let retry = 0; retry < 3 && blocked; retry++) {
      if (retry > 0) {
        console.log(`    ⚠️ 차단 감지, 재시도 ${retry}/2...`);
        await page.waitForTimeout(5000 * retry); // 점점 더 길게 대기 후 재시도
      }
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(4000);

        const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
        const isBlocked =
          bodyText.includes("don't have permission") ||
          bodyText.includes('edgesuite.net') ||
          bodyText.includes('Reference #') ||
          bodyText.includes('Access Denied');

        if (!isBlocked) {
          blocked = false;
        } else {
          lastErr = new Error('Akamai/봇 차단 페이지 감지됨');
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (blocked) {
      throw lastErr || new Error('차단 페이지에서 재시도 모두 실패');
    }

    await acceptCookies(page);
    await page.waitForTimeout(2000);

    // 네트워크 안정화 대기 (느린 국가 대응, 실패해도 무시하고 진행)
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {}

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
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
      } catch {}
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
