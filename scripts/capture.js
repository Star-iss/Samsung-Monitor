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
  // data-desktop-src / data-src 기반 lazy-load 이미지 강제 로드 (실패해도 무시)
  try {
    await page.evaluate(() => {
      document.querySelectorAll('img[data-desktop-src]').forEach(img => {
        img.src = img.getAttribute('data-desktop-src');
      });
      document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.getAttribute('data-src');
      });
      document.querySelectorAll('img[data-lazy-src]').forEach(img => {
        img.src = img.getAttribute('data-lazy-src');
      });
      document.querySelectorAll('.lazy-load').forEach(el => {
        el.classList.remove('lazy-load');
      });
    });
  } catch (e) {
    console.log(`    ⚠️ lazy-load 강제 로드 실패 (무시): ${e.message}`);
  }

  // body 클릭으로 포커스 확보
  await page.mouse.click(760, 400);
  await page.waitForTimeout(500);

  try {
    let previousScrollY = -1;
    let sameCount = 0;

    while (sameCount < 3) {
      const currentScrollY = await page.evaluate(() => window.scrollY);
      const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = await page.evaluate(() => window.innerHeight);

      await page.keyboard.press('Space');
      await page.waitForTimeout(600);

      const newScrollY = await page.evaluate(() => window.scrollY);
      console.log(`    ScrollY: ${currentScrollY} → ${newScrollY} / ${scrollHeight}px`);

      if (newScrollY === previousScrollY) {
        sameCount++;
      } else {
        sameCount = 0;
      }
      previousScrollY = newScrollY;

      if (newScrollY + viewportHeight >= scrollHeight - 10) break;
    }
  } catch (e) {
    console.log(`    ⚠️ 스크롤 중 페이지 변경 감지, 현재 상태로 캡처 진행: ${e.message}`);
  }

  try {
    await page.keyboard.press('Home');
    await page.waitForTimeout(1000);
  } catch (e) {}
}

async function captureSite(context, country, page_config) {
  const url = buildUrl(country.code, page_config.path);
  const siteId = `${country.code}-${page_config.id}`;
  const dir = path.join('docs', 'screenshots', siteId);
  fs.mkdirSync(dir, { recursive: true });

  const page = await context.newPage();

  // 홈페이지는 이미지 포함, Monitor PF는 이미지 차단 (용량 절약)
  const blockImages = page_config.id !== 'home';

  if (blockImages) {
    await page.route('**/*', route => {
      const reqUrl = route.request().url();
      const resourceType = route.request().resourceType();
      // 이미지 리소스 중 samsung 도메인만 허용, 나머지 이미지는 차단
      if (resourceType === 'image') {
        if (reqUrl.includes('images.samsung.com') || reqUrl.includes('samsung.com')) {
          route.continue();
        } else {
          route.abort();
        }
      } else {
        route.continue();
      }
    });
  }

  try {
    console.log(`  [${country.code}] ${page_config.name} ${blockImages ? '(이미지 차단)' : ''}`);

    // 봇 차단(Akamai 등) 감지 시 재시도
    let blocked = true;
    let lastErr = null;
    for (let retry = 0; retry < 3 && blocked; retry++) {
      if (retry > 0) {
        console.log(`    ⚠️ 차단 감지, 재시도 ${retry}/2...`);
        await page.waitForTimeout(5000 * retry);
      }
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // PF 페이지는 JS 렌더링이 느린 국가가 있어서 더 오래 대기
        await page.waitForTimeout(blockImages ? 12000 : 6000);

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

    // 쿠키 팝업 처리 후 URL이 바뀌었으면 원래 URL로 복귀 (BE 등 리다이렉트 방지)
    const currentUrl = page.url();
    if (!currentUrl.includes(page_config.path.replace(/\/$/, ''))) {
      console.log(`    ⚠️ URL 변경 감지 (${currentUrl}) → 원래 URL로 복귀`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(blockImages ? 8000 : 4000);
    }

    // 상단 뷰
    await page.screenshot({ path: path.join(dir, `${today}-top.png`), fullPage: false });

    // GNB Hover (홈페이지만)
    if (page_config.gnbHover) {
      await captureGNBHover(page, dir, country.code);
      await page.mouse.move(68, 177);
      await page.waitForTimeout(500);
      await page.mouse.move(0, 500);
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
    }

    // 전체 페이지
    if (page_config.captureFullPage) {
      console.log(`    Scrolling...`);
      await fullScroll(page);
      await page.screenshot({ path: path.join(dir, `${today}-full.png`), fullPage: true });
      console.log(`    Full screenshot done`);
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

    // Samsung 지역/언어 팝업 쿠키 미리 세팅 (팝업 억제)
    await context.addCookies([
      { name: 'samsung_localization', value: '1', domain: '.samsung.com', path: '/' },
      { name: 'gdpr_consent', value: '1', domain: '.samsung.com', path: '/' },
      { name: 'cookie_consent', value: 'accepted', domain: '.samsung.com', path: '/' },
      { name: 'countryCode', value: country.code.replace('_', '-'), domain: '.samsung.com', path: '/' },
    ]);

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      // Samsung 지역/언어 선택 팝업 숨김 처리
      const hidePopups = () => {
        const popupSelectors = [
          '.modal-selector', '.country-selector', '.location-selector',
          '[class*="country-layer"]', '[class*="location-layer"]',
          '[class*="languageSelector"]', '[id*="countrySelector"]',
          '.truste_overlay', '#truste-consent-track',
        ];
        popupSelectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            el.style.display = 'none';
          });
        });
      };

      // DOM 로드 즉시 + 변경될 때마다 팝업 숨김
      document.addEventListener('DOMContentLoaded', hidePopups);
      const observer = new MutationObserver(hidePopups);
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });

      // IntersectionObserver override: 모든 요소를 즉시 "뷰포트 진입"으로 처리
      const OriginalIntersectionObserver = window.IntersectionObserver;
      window.IntersectionObserver = function(callback, options) {
        const observer = new OriginalIntersectionObserver(callback, options);
        const originalObserve = observer.observe.bind(observer);
        observer.observe = (target) => {
          try {
            callback([{
              isIntersecting: true,
              intersectionRatio: 1,
              target,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
              time: performance.now(),
            }], observer);
          } catch(e) {}
          originalObserve(target);
        };
        return observer;
      };
      window.IntersectionObserver.prototype = OriginalIntersectionObserver.prototype;
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
