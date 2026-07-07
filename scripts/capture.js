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

// ── PF 디버깅 헬퍼 함수들 ──────────────────────────────────────────

// 스크롤 전/중/후 페이지 상태 스냅샷 (언어 무관)
async function logPageState(page, label) {
  try {
    const state = await page.evaluate(() => {
      return {
        href: location.href,
        readyState: document.readyState,
        scrollY: window.scrollY,
        bodyScrollHeight: document.body.scrollHeight,
        docScrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        imgCount: document.querySelectorAll('img').length,
        imgLoadedCount: Array.from(document.querySelectorAll('img'))
          .filter(i => i.complete && i.naturalWidth > 0).length,
        visibleTextSample: document.body.innerText.slice(0, 150).replace(/\s+/g, ' '),
      };
    });
    console.log(`    [STATE:${label}]`, JSON.stringify(state));
  } catch (e) {
    console.log(`    [STATE:${label}] ⚠️ evaluate 실패: ${e.message}`);
  }
}

// 언어 무관 Product Card 존재 여부 탐지 (통화기호 + 반복 형제 구조)
async function probeProductCards(page, label) {
  try {
    const probe = await page.evaluate(() => {
      const priceLike = document.body.innerText.match(/[\d.,]+\s?(€|\$|£|kr|TL|zł|₩)/g) || [];

      function findRepeatedSiblingGroups() {
        const groups = [];
        document.querySelectorAll('*').forEach(parent => {
          const children = Array.from(parent.children);
          if (children.length < 5) return;
          const classMap = {};
          children.forEach(c => {
            const key = c.tagName + ':' + (c.className || '').toString().split(' ')[0];
            classMap[key] = (classMap[key] || 0) + 1;
          });
          Object.entries(classMap).forEach(([key, count]) => {
            if (count >= 5) {
              groups.push({
                parentTag: parent.tagName,
                parentClass: (parent.className || '').toString().slice(0, 50),
                key, count,
              });
            }
          });
        });
        return groups;
      }

      return {
        imgCount: document.querySelectorAll('img').length,
        imgWithSrcCount: document.querySelectorAll('img[src]:not([src=""])').length,
        priceLikeMatches: priceLike.length,
        priceSample: priceLike.slice(0, 5),
        repeatedGroups: findRepeatedSiblingGroups().slice(0, 8),
        bodyTextLength: document.body.innerText.length,
      };
    });
    console.log(`    [CARD PROBE:${label}]`, JSON.stringify(probe));
    return probe;
  } catch (e) {
    console.log(`    [CARD PROBE:${label}] ⚠️ evaluate 실패: ${e.message}`);
    return null;
  }
}

// window가 아닌 내부 scroll container 후보 탐지
async function probeScrollContainers(page) {
  try {
    const containers = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      return all
        .filter(el => {
          const style = getComputedStyle(el);
          return (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight + 50
          );
        })
        .map(el => ({
          tag: el.tagName,
          cls: (el.className || '').toString().slice(0, 80),
          id: el.id,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          scrollTop: el.scrollTop,
        }))
        .sort((a, b) => b.scrollHeight - a.scrollHeight)
        .slice(0, 8);
    });
    console.log(`    [SCROLL CONTAINER 후보]`, JSON.stringify(containers));
    return containers;
  } catch (e) {
    console.log(`    [SCROLL CONTAINER 후보] ⚠️ evaluate 실패: ${e.message}`);
    return [];
  }
}

// 가장 큰 scroll container 위에 마우스를 놓고 사람처럼 wheel 스크롤
async function humanLikeWheelScroll(page, { maxMs = 8000, step = 700, pauseMs = 180 } = {}) {
  let box = null;
  try {
    const target = await page.evaluateHandle(() => {
      const all = Array.from(document.querySelectorAll('*'));
      let best = document.scrollingElement || document.documentElement;
      let bestScrollable = best.scrollHeight - best.clientHeight;
      all.forEach(el => {
        const style = getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          const scrollable = el.scrollHeight - el.clientHeight;
          if (scrollable > bestScrollable) {
            bestScrollable = scrollable;
            best = el;
          }
        }
      });
      return best;
    });
    const el = target.asElement();
    if (el) box = await el.boundingBox();
  } catch (e) {
    console.log(`    ⚠️ scroll container 탐색 실패: ${e.message}`);
  }

  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 400));
    console.log(`    마우스를 scroll container 위로 이동: (${Math.round(box.x)}, ${Math.round(box.y)})`);
  } else {
    await page.mouse.move(720, 400);
    console.log(`    scroll container 없음 → 화면 중앙에서 스크롤`);
  }

  const start = Date.now();
  let lastMetric = -1;
  let stable = 0;

  while (Date.now() - start < maxMs) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(pauseMs);

    let metric;
    try {
      metric = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        let maxScrollTop = 0;
        all.forEach(el => {
          const style = getComputedStyle(el);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollTop > maxScrollTop) {
            maxScrollTop = el.scrollTop;
          }
        });
        return document.body.scrollHeight + window.scrollY + maxScrollTop;
      });
    } catch (e) {
      console.log(`    ⚠️ 스크롤 중 컨텍스트 소실: ${e.message}`);
      break;
    }

    if (metric === lastMetric) {
      stable++;
      if (stable >= 4) break;
    } else {
      stable = 0;
      lastMetric = metric;
    }
  }
}

// Product Card가 실제로 렌더링될 때까지 대기 (언어 무관, 가격 텍스트 3개 이상)
async function waitForProductCards(page, { timeout = 6000 } = {}) {
  try {
    await page.waitForFunction(() => {
      const priceLike = (document.body.innerText.match(/[\d.,]+\s?(€|\$|£|kr|TL|zł|₩)/g) || []).length;
      return priceLike >= 3;
    }, { timeout });
    return true;
  } catch (e) {
    console.log(`    ⚠️ waitForProductCards 타임아웃: ${e.message}`);
    return false;
  }
}

// "더 보기" 버튼을 찾아 클릭 (언어 무관, class/attribute 영어 키워드 기반)
async function findAndClickLoadMore(page) {
  return await page.evaluate(() => {
    const keywordPattern = /load-?more|show-?more|view-?more|see-?more|more-?products|btn-?more|loadmore|showmore/i;

    const candidates = Array.from(
      document.querySelectorAll('button, a[role="button"], a.button, [role="button"]')
    ).filter(el => {
      if (!el.offsetParent) return false; // 화면에 안 보이면 제외
      const attrs = [
        el.className,
        el.id,
        el.getAttribute('data-js-action') || '',
        el.getAttribute('data-action') || '',
        el.getAttribute('aria-label') || '',
      ].join(' ').toLowerCase();
      return keywordPattern.test(attrs);
    });

    if (candidates.length === 0) return false;

    const btn = candidates[0];
    btn.scrollIntoView({ block: 'center' });
    btn.click();
    return true;
  });
}

// 현재 렌더링된 상품 카드 수 추정 (통화기호 텍스트 개수 기반, 언어 무관)
async function countProductLike(page) {
  try {
    return await page.evaluate(() => {
      const priceLike = document.body.innerText.match(/[\d.,]+\s?(€|\$|£|kr|TL|zł|₩)/g) || [];
      return priceLike.length;
    });
  } catch (e) {
    return -1;
  }
}

// "더 보기" 버튼을 반복 클릭해서 모든 상품 로드
async function loadAllProducts(page, { maxClicks = 20, waitAfterClick = 1200 } = {}) {
  let clicks = 0;
  let lastCount = await countProductLike(page);
  console.log(`    초기 상품 카드 수(추정): ${lastCount}`);

  while (clicks < maxClicks) {
    let clicked = false;
    try {
      clicked = await findAndClickLoadMore(page);
    } catch (e) {
      console.log(`    ⚠️ 버튼 클릭 중 오류: ${e.message}`);
      break;
    }

    if (!clicked) {
      console.log(`    더 보기 버튼 없음 → 모든 상품 로드 완료`);
      break;
    }

    await page.waitForTimeout(waitAfterClick);
    clicks++;

    const newCount = await countProductLike(page);
    if (newCount === -1) {
      console.log(`    ⚠️ 클릭 후 컨텍스트 소실, 종료`);
      break;
    }
    console.log(`    클릭 ${clicks}회 → 상품 카드 수: ${lastCount} → ${newCount}`);

    if (newCount <= lastCount) {
      console.log(`    카드 수 증가 없음 → 종료 (안전장치)`);
      break;
    }
    lastCount = newCount;
  }

  return { clicks, finalCount: lastCount };
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

  // PF 페이지 디버깅: 네트워크 요청/실패 로그 (API 호출 여부 확인용)
  if (page_config.id !== 'home') {
    page.on('response', (res) => {
      const resUrl = res.url();
      if (resUrl.includes('monitor') || resUrl.includes('product') || resUrl.includes('/api/') || resUrl.includes('/pd21')) {
        console.log(`    [NETWORK] ${res.status()} ${resUrl.slice(0, 120)}`);
      }
    });
    page.on('requestfailed', (req) => {
      console.log(`    [REQ FAILED] ${req.url().slice(0, 120)} - ${req.failure()?.errorText}`);
    });
  }

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
        // PF 페이지 초기 렌더링 안정화 대기
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
        // PF 페이지: "더 보기" 버튼을 반복 클릭해서 전체 상품 로드 후 캡처
        console.log(`    Loading all products (Load More)...`);
        blockNavigation = true; // 안전장치: 리다이렉트 시도 시 차단

        try {
          // 초기 렌더링 안정화를 위해 살짝 스크롤 (첫 배치 lazy-load 트리거 대비)
          await page.mouse.wheel(0, 600);
          await page.waitForTimeout(500);
          await page.mouse.wheel(0, 600);
          await page.waitForTimeout(800);
        } catch (e) {}

        try {
          await loadAllProducts(page, { maxClicks: 20, waitAfterClick: 1200 });
        } catch (e) {
          console.log(`    ⚠️ 상품 로드 중 예외 (현재 상태로 캡처): ${e.message}`);
        }

        // data-src 강제 적용
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

        // 맨 위로 복귀
        try {
          await page.evaluate(() => {
            window.scrollTo(0, 0);
            document.querySelectorAll('*').forEach(el => {
              const style = getComputedStyle(el);
              if (style.overflowY === 'auto' || style.overflowY === 'scroll') el.scrollTop = 0;
            });
          });
        } catch (e) {}
        await page.waitForTimeout(1000);
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

      document.addEventListener('DOMContentLoaded', hidePopups);
      const observer = new MutationObserver(hidePopups);
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });

      // ⚠️ IntersectionObserver override는 Homepage(lazy-load 이미지)에만 필요.
      // PF 페이지는 scroll 기반으로 카드 DOM을 "생성"하는 구조로 추정되며,
      // 이 override가 실제 스크롤 위치와 무관하게 관찰자를 즉시 종료시켜
      // 진짜 스크롤 트리거에 반응하지 못하게 만들 가능성이 있어 PF에서는 비활성화한다.
      const isPFPage = location.pathname.includes('all-monitors');

      if (!isPFPage) {
        const OriginalIntersectionObserver = window.IntersectionObserver;
        window.IntersectionObserver = function(callback, options) {
          const obs = new OriginalIntersectionObserver(callback, options);
          const originalObserve = obs.observe.bind(obs);
          obs.observe = (target) => {
            try {
              callback([{
                isIntersecting: true,
                intersectionRatio: 1,
                target,
                boundingClientRect: target.getBoundingClientRect(),
                intersectionRect: target.getBoundingClientRect(),
                rootBounds: null,
                time: performance.now(),
              }], obs);
            } catch (e) {}
            originalObserve(target);
          };
          return obs;
        };
        window.IntersectionObserver.prototype = OriginalIntersectionObserver.prototype;
      }
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
