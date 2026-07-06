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
  const targetPath = page_config.path.replace(/\/$/, '');

  // 네비게이션 차단 활성화 플래그 (초기 로드는 허용, 스크롤 시작 직전부터 차단)
  let blockNavigation = false;

  await page.route('**', async (route) => {
    const req = route.request();
    const reqUrl = req.url();
    const resourceType = req.resourceType();

    // 스크롤 시작 후에만 잘못된 URL로의 이동 차단
    if (blockNavigation && req.isNavigationRequest() && req.frame() === page.mainFrame()) {
      if (reqUrl.includes(targetPath) || targetPath === '') {
        await route.continue();
      } else {
        console.log(`    🚫 리다이렉트 차단: ${reqUrl}`);
        await route.abort();
      }
      return;
    }

    // 타사 이미지 차단 (Samsung 이미지는 허용)
    if (resourceType === 'image' && !reqUrl.includes('samsung.com')) {
      await route.abort();
      return;
    }

    await route.continue();
  });

  try {
    console.log(`  [${country.code}] ${page_config.name}`);

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
        // PF는 초기 대기를 짧게! (12초 대기 중 redirect 타이머가 임박해짐)
        await page.waitForTimeout(page_config.id !== 'home' ? 4000 : 6000);

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
      if (page_config.id === 'home') {
        // 홈페이지: Space 키 스크롤로 lazy-load 트리거 후 캡처
        console.log(`    Scrolling...`);
        blockNavigation = true;
        await fullScroll(page);
      } else {
        // PF 페이지: evaluate 내부에서 빠른 스크롤로 카드 DOM 생성 트리거
        // round-trip 없이 브라우저 JS 엔진 내에서 직접 실행 → redirect 전에 완료
        console.log(`    PF scroll (fast internal)...`);
        try {
          await page.evaluate(async () => {
            await new Promise((resolve) => {
              const STEP = 500;        // 스크롤 step (px)
              const INTERVAL = 120;    // step 간격 (ms) - 너무 빠르면 Samsung JS가 못 따라옴
              const TIMEOUT = 18000;   // 최대 허용 시간 (ms)
              const STABLE_MS = 1500;  // 카드 수 안정화 판단 시간

              let pos = 0;
              let lastCardCount = 0;
              let stableTimer = null;
              let done = false;

              const finish = () => {
                if (done) return;
                done = true;
                observer.disconnect();
                window.scrollTo(0, 0);
                setTimeout(resolve, 800);
              };

              // MutationObserver로 카드 DOM 생성 감지
              const observer = new MutationObserver(() => {
                const count = document.querySelectorAll(
                  '[class*="pd21"], [class*="product-card"], [class*="item-product"], [class*="card-product"]'
                ).length;
                if (count > lastCardCount) {
                  lastCardCount = count;
                  clearTimeout(stableTimer);
                  stableTimer = setTimeout(finish, STABLE_MS);
                }
              });
              observer.observe(document.body, { childList: true, subtree: true });

              // 전체 타임아웃
              const globalTimer = setTimeout(finish, TIMEOUT);

              // 스크롤 루프
              const step = () => {
                if (done) return;
                const h = document.body.scrollHeight;
                const vh = window.innerHeight;

                window.scrollTo(0, pos);
                // scroll + wheel 이벤트 모두 dispatch (Samsung JS가 어느 것을 듣는지 불확실)
                window.dispatchEvent(new Event('scroll', { bubbles: true }));
                window.dispatchEvent(new WheelEvent('wheel', {
                  deltaY: STEP, bubbles: true, cancelable: true
                }));

                pos += STEP;

                if (pos >= h + vh) {
                  clearTimeout(globalTimer);
                  finish();
                } else {
                  setTimeout(step, INTERVAL);
                }
              };

              step();
            });
          });
        } catch (e) {
          console.log(`    ⚠️ PF 스크롤 중 페이지 변경 감지 (현재 상태로 캡처): ${e.message}`);
        }

        // data-src 강제 적용 (스크롤 완료 후)
        try {
          await page.evaluate(() => {
            document.querySelectorAll('img[data-desktop-src]').forEach(img => {
              img.src = img.getAttribute('data-desktop-src');
            });
            document.querySelectorAll('img[data-src]').forEach(img => {
              img.src = img.getAttribute('data-src');
            });
          });
        } catch (e) {}

        await page.waitForTimeout(2000);
      }
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
