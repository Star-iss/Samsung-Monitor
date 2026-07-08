'use strict';
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const metaDir = path.join('docs', 'meta');
const indexPath = path.join(metaDir, 'index.json');

const dates = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
const latest = dates[0] || null;

// 국가 코드 → 국기 이모지
const flagMap = {
  de: '🇩🇪', au: '🇦🇺', be: '🇧🇪', be_fr: '🇧🇪', fr: '🇫🇷',
  it: '🇮🇹', sec: '🇰🇷', nl: '🇳🇱', no: '🇳🇴', pt: '🇵🇹',
  es: '🇪🇸', se: '🇸🇪', tr: '🇹🇷', uk: '🇬🇧', us: '🇺🇸'
};

// 국가 코드 → 표시 이름
const labelMap = {
  de: 'Germany', au: 'Australia', be: 'Belgium', be_fr: 'Belgium (FR)',
  fr: 'France', it: 'Italy', sec: 'Korea', nl: 'Netherlands',
  no: 'Norway', pt: 'Portugal', es: 'Spain', se: 'Sweden',
  tr: 'Turkey', uk: 'United Kingdom', us: 'United States'
};

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Samsung Monitor Archiving DashBoard</title>
<style>
  /*
    다크 테마 색상을 CSS 변수로 관리.
    나중에 라이트 테마를 추가하려면, 예를 들어 body에 [data-theme="light"] 같은
    속성을 붙이고 그 안에서 아래 변수들을 라이트 색상으로 재정의하면 됨.
    포인트 컬러(Samsung 블루)는 --accent(버튼 등 채워진 배경용)와
    --accent-light(다크 배경 위 텍스트/링크/테두리용, 가독성을 위해 밝게 조정) 두 가지로 분리.
  */
  :root {
    --bg-color: #121212;
    --bg-secondary: #1a1a1a;
    --bg-card: #1e1e1e;
    --bg-placeholder: #262626;
    --text-color: #e8e8e8;
    --text-secondary: #b0b0b0;
    --text-muted: #8a8a8a;
    --border-color: #333333;
    --accent: #1428A0;
    --accent-light: #6c8eff;
    --shadow-color: rgba(0, 0, 0, 0.4);
    --overlay-bg: rgba(0, 0, 0, 0.75);
    --scrollbar-thumb: #444444;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: var(--bg-color); color: var(--text-color); }

  header {
    background: var(--accent); color: white;
    padding: 14px 24px; display: flex; justify-content: space-between; align-items: center;
  }
  header h1 { font-size: 1.1rem; font-weight: 700; }
  header .meta { font-size: 0.78rem; opacity: 0.8; margin-top: 2px; }

  .toolbar {
    background: var(--bg-secondary); padding: 10px 24px;
    display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid var(--border-color); font-size: 0.85rem;
  }
  .toolbar label { color: var(--text-secondary); }
  .toolbar select {
    border: 1px solid var(--border-color); border-radius: 6px;
    padding: 5px 10px; font-size: 0.85rem; cursor: pointer;
    background: var(--bg-card); color: var(--text-color);
  }
  .toolbar .right { margin-left: auto; color: var(--text-muted); font-size: 0.78rem; }

  .country-slicer {
    background: var(--bg-secondary); padding: 10px 24px;
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
    border-bottom: 1px solid var(--border-color);
  }
  .country-btn {
    padding: 5px 14px; border: 1px solid var(--border-color); border-radius: 20px;
    background: var(--bg-card); cursor: pointer; font-size: 0.82rem; color: var(--text-secondary);
    transition: all 0.15s;
  }
  .country-btn:hover { border-color: var(--accent-light); color: var(--accent-light); }
  .country-btn.active { background: var(--accent); color: white; border-color: var(--accent); }

  .grid {
    display: grid;
    grid-template-columns: repeat(${config.pages.length}, 1fr);
    gap: 20px; padding: 20px 24px;
  }

  .card {
    background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px;
    box-shadow: 0 2px 8px var(--shadow-color); overflow: hidden;
  }
  .card.hidden { display: none; }

  .card-header {
    padding: 12px 16px; display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid var(--border-color);
  }
  .card-flag { font-size: 1.2rem; }
  .card-country { font-weight: 700; font-size: 0.88rem; color: var(--accent-light); }
  .card-title { font-size: 0.82rem; color: var(--text-secondary); flex: 1; }
  .card-link {
    font-size: 0.75rem; color: var(--accent-light); text-decoration: none;
    padding: 3px 8px; border: 1px solid var(--accent-light); border-radius: 12px;
  }
  .card-link:hover { background: var(--accent); color: white; border-color: var(--accent); }

  .tab-bar {
    display: flex; gap: 0; border-bottom: 1px solid var(--border-color);
    padding: 0 12px; background: var(--bg-secondary);
  }
  .tab {
    padding: 8px 14px; border: none; background: none;
    cursor: pointer; font-size: 0.8rem; color: var(--text-muted);
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    transition: all 0.15s;
  }
  .tab:hover { color: var(--accent-light); }
  .tab.active { color: var(--accent-light); border-bottom-color: var(--accent-light); font-weight: 600; }

  .tab-content { display: none; }
  .tab-content.active { display: block; }

  .img-wrap {
    cursor: pointer; position: relative; overflow: hidden;
    background: var(--bg-placeholder);
  }
  .img-wrap:hover { opacity: 0.92; }
  .img-label {
    position: absolute; top: 8px; left: 8px; z-index: 2;
    background: rgba(0,0,0,0.6); color: white;
    font-size: 0.7rem; padding: 3px 8px; border-radius: 10px;
  }
  .img-wrap img {
    width: 100%; display: block;
    /* transition 제거 - 즉각 반응을 위해 */
  }
  .img-wrap img.loading {
    opacity: 0.4;
  }
  .no-img {
    text-align: center; padding: 40px; color: var(--text-muted); font-size: 0.85rem;
  }

  .card-footer {
    padding: 10px 14px; display: flex; gap: 8px; flex-wrap: wrap;
    border-top: 1px solid var(--border-color); background: var(--bg-secondary);
  }
  .badge {
    font-size: 0.75rem; color: var(--text-secondary); text-decoration: none;
    padding: 3px 10px; border: 1px solid var(--border-color); border-radius: 12px;
    background: var(--bg-card);
  }
  .badge:hover { border-color: var(--accent-light); color: var(--accent-light); }

  /* Modal */
  .modal-overlay {
    display: none; position: fixed; inset: 0;
    background: var(--overlay-bg); z-index: 1000;
    justify-content: center; align-items: center;
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px;
    width: 90vw; max-width: 1100px; max-height: 90vh;
    overflow-y: auto; padding: 24px; position: relative;
  }
  .modal-close {
    position: absolute; top: 14px; right: 18px;
    background: none; border: none; font-size: 1.4rem;
    cursor: pointer; color: var(--text-secondary);
  }
  .modal h2 { font-size: 1rem; color: var(--accent-light); margin-bottom: 14px; }
  .modal-tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .modal-tab-btn {
    padding: 5px 14px; border: 1px solid var(--border-color); border-radius: 20px;
    background: none; cursor: pointer; font-size: 0.8rem; color: var(--text-secondary);
  }
  .modal-tab-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
  .modal img { width: 100%; border: 1px solid var(--border-color); border-radius: 8px; }
  .modal-loading {
    text-align: center; padding: 60px; color: var(--text-muted); font-size: 0.95rem;
  }
  .open-btn {
    display: inline-block; margin-top: 10px; background: var(--accent); color: white;
    padding: 7px 16px; border-radius: 8px; font-size: 0.82rem; text-decoration: none;
  }

  ::-webkit-scrollbar { height: 4px; width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }

  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr; padding: 16px; }
    .country-slicer { padding: 10px 16px; }
  }
</style>
</head>
<body>

<header>
  <div>
    <h1>🖥️ Samsung Monitor Archiving DashBoard</h1>
  </div>
  <div class="meta">마지막 업데이트: ${latest || '-'}</div>
</header>

<div class="toolbar">
  <label>📅 날짜:</label>
  <select id="dateSelect" onchange="changeDate(this.value)">
    ${dates.map(d => `<option value="${d}">${d}</option>`).join('')}
  </select>
  <span class="right">총 ${config.countries.length}개 국가 × ${config.pages.length}개 페이지</span>
</div>

<div class="country-slicer">
  ${config.countries.map(c => {
    const flag = flagMap[c.code] || '🌐';
    const label = labelMap[c.code] || c.name;
    return `<button class="country-btn${c.code === config.countries[0].code ? ' active' : ''}" data-country="${c.code}" onclick="filterCountry('${c.code}', this)">${flag} ${label}</button>`;
  }).join('')}
</div>

<div class="grid" id="grid">
  ${config.countries.map(country => {
    const flag = flagMap[country.code] || '🌐';
    const label = labelMap[country.code] || country.name;
    return config.pages.map(page_config => {
      const siteId = `${country.code}-${page_config.id}`;
      const topImg = `screenshots/${siteId}/${latest}-top.png`;
      const gnbImg = `screenshots/${siteId}/${latest}-gnb-hover.png`;
      const fullImg = `screenshots/${siteId}/${latest}-full.png`;

      const tabs = [
        `<button class="tab active" onclick="switchTab(this, '${siteId}', 'top')">🖥️ 상단 뷰</button>`,
        page_config.gnbHover ? `<button class="tab" onclick="switchTab(this, '${siteId}', 'gnb')">📂 GNB Hover</button>` : '',
        page_config.captureFullPage ? `<button class="tab" onclick="switchTab(this, '${siteId}', 'full')">📄 전체 페이지</button>` : '',
      ].filter(Boolean).join('');

      const badges = [
        `<a href="${topImg}" target="_blank" class="badge">🖼️ 상단 원본</a>`,
        page_config.gnbHover ? `<a href="${gnbImg}" target="_blank" class="badge">📂 GNB 원본</a>` : '',
        page_config.captureFullPage ? `<a href="${fullImg}" target="_blank" class="badge">📄 전체 페이지</a>` : '',
      ].filter(Boolean).join('');

      return `
      <div class="card" data-country="${country.code}">
        <div class="card-header">
          <span class="card-flag">${flag}</span>
          <span class="card-country">${label}</span>
          <span class="card-title">${page_config.name}</span>
          <a href="https://www.samsung.com/${country.code}${page_config.path}" target="_blank" class="card-link">↗ 방문</a>
        </div>
        <div class="tab-bar">${tabs}</div>

        <div class="tab-content active" id="${siteId}-top">
          <div class="img-wrap" onclick="openModal('${siteId}', 'top')">
            <div class="img-label">${latest}</div>
            <img src="${topImg}" onerror="this.parentElement.innerHTML='<p class=no-img>캡처 없음</p>'"/>
          </div>
        </div>

        ${page_config.gnbHover ? `
        <div class="tab-content" id="${siteId}-gnb">
          <div class="img-wrap" onclick="openModal('${siteId}', 'gnb')">
            <div class="img-label">GNB Hover · ${latest}</div>
            <img src="${gnbImg}" onerror="this.parentElement.innerHTML='<p class=no-img>캡처 없음</p>'"/>
          </div>
        </div>` : ''}

        ${page_config.captureFullPage ? `
        <div class="tab-content" id="${siteId}-full">
          <div class="img-wrap" onclick="openModal('${siteId}', 'full')">
            <div class="img-label">전체 페이지 · ${latest}</div>
            <img src="${fullImg}" onerror="this.parentElement.innerHTML='<p class=no-img>캡처 없음</p>'"/>
          </div>
        </div>` : ''}

        <div class="card-footer">${badges}</div>
      </div>`;
    }).join('');
  }).join('')}
</div>

<!-- Modal -->
<div class="modal-overlay" id="modalOverlay" onclick="closeModal(event)">
  <div class="modal">
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h2 id="modalTitle"></h2>
    <div class="modal-tabs" id="modalTabs"></div>
    <div id="modalContent"></div>
  </div>
</div>

<script>
const config = ${JSON.stringify({...config, flagMap, labelMap})};
const dates = ${JSON.stringify(dates)};
let currentDate = dates[0] || '';
let currentCountry = config.countries[0]?.code || '';

// 초기 로드 시 첫 번째 국가만 표시
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.card').forEach(card => {
    if (card.dataset.country !== currentCountry) {
      card.classList.add('hidden');
    }
  });
});

function filterCountry(code, btn) {
  currentCountry = code;
  document.querySelectorAll('.country-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.card').forEach(card => {
    if (code === 'all' || card.dataset.country === code) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
  // 국가 전환 시 해당 국가 이미지 즉시 프리로드 (브라우저 캐시 워밍)
  document.querySelectorAll('.card:not(.hidden) .img-wrap img').forEach(img => {
    if (img.dataset.src && img.src !== img.dataset.src) {
      img.src = img.dataset.src;
    }
  });
}

function changeDate(date) {
  currentDate = date;
  config.countries.forEach(country => {
    config.pages.forEach(page => {
      const siteId = country.code + '-' + page.id;
      const isCurrentCountry = country.code === currentCountry;

      function swapImg(wrap, newSrc, labelText) {
        if (!wrap) return;
        let img = wrap.querySelector('img');
        if (!img) {
          wrap.innerHTML = '<div class="img-label"></div><img/>';
          img = wrap.querySelector('img');
        }
        const lbl = wrap.querySelector('.img-label');
        if (lbl) lbl.textContent = labelText;

        if (isCurrentCountry) {
          // 현재 국가: 즉시 src 교체 (프리로드 없이 바로)
          img.src = newSrc;
          img.style.display = '';
          const noImg = wrap.querySelector('.no-img');
          if (noImg) noImg.remove();
          img.onerror = () => {
            img.style.display = 'none';
            if (!wrap.querySelector('.no-img')) {
              const p = document.createElement('p');
              p.className = 'no-img';
              p.textContent = '캡처 없음';
              wrap.appendChild(p);
            }
          };
        } else {
          // 다른 국가: 백그라운드에서 조용히 프리로드
          const preloader = new Image();
          preloader.onload = () => {
            img.src = newSrc;
            img.style.display = '';
            const noImg = wrap.querySelector('.no-img');
            if (noImg) noImg.remove();
          };
          preloader.onerror = () => {
            img.style.display = 'none';
            if (!wrap.querySelector('.no-img')) {
              const p = document.createElement('p');
              p.className = 'no-img';
              p.textContent = '캡처 없음';
              wrap.appendChild(p);
            }
          };
          preloader.src = newSrc;
        }
      }

      swapImg(
        document.querySelector('#' + siteId + '-top .img-wrap'),
        'screenshots/' + siteId + '/' + date + '-top.png',
        date
      );
      if (page.gnbHover) {
        swapImg(
          document.querySelector('#' + siteId + '-gnb .img-wrap'),
          'screenshots/' + siteId + '/' + date + '-gnb-hover.png',
          'GNB Hover · ' + date
        );
      }
      if (page.captureFullPage) {
        swapImg(
          document.querySelector('#' + siteId + '-full .img-wrap'),
          'screenshots/' + siteId + '/' + date + '-full.png',
          '전체 페이지 · ' + date
        );
      }

      // 배지 링크 업데이트
      const card = document.querySelector('[data-country="' + country.code + '"][data-id]') ||
        document.querySelector('[data-country="' + country.code + '"]');
      if (card) {
        card.querySelectorAll('.badge').forEach(a => {
          if (a.href.includes('-top.png')) {
            a.href = 'screenshots/' + siteId + '/' + date + '-top.png';
          } else if (a.href.includes('-gnb-hover.png')) {
            a.href = 'screenshots/' + siteId + '/' + date + '-gnb-hover.png';
          } else if (a.href.includes('-full.png')) {
            a.href = 'screenshots/' + siteId + '/' + date + '-full.png';
          }
        });
      }
    });
  });
}

function switchTab(btn, siteId, type) {
  // 같은 카드 내 탭 버튼 처리
  const card = btn.closest('.card');
  card.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  // 탭 콘텐츠 전환
  card.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  const target = document.getElementById(siteId + '-' + type);
  if (target) target.classList.add('active');
}

function openModal(siteId, type) {
  const flag = config.countries.find(c => siteId.startsWith(c.code + '-'));
  const country = flag ? (config.flagMap[flag.code] || '') + ' ' + (config.labelMap[flag.code] || flag.name) : siteId;
  const page = config.pages.find(p => siteId.endsWith('-' + p.id));
  const pageName = page ? page.name : '';

  document.getElementById('modalTitle').textContent = country + ' · ' + pageName;

  const tabTypes = [
    { key: 'top', label: '🖥️ 상단 뷰' },
    ...(page && page.gnbHover ? [{ key: 'gnb', label: '📂 GNB Hover' }] : []),
    ...(page && page.captureFullPage ? [{ key: 'full', label: '📄 전체 페이지' }] : []),
  ];

  document.getElementById('modalTabs').innerHTML = tabTypes.map(t =>
    \`<button class="modal-tab-btn \${t.key === type ? 'active' : ''}"
      onclick="switchModalTab(this, '\${siteId}', '\${t.key}')">\${t.label}</button>\`
  ).join('');

  showModalImg(siteId, currentDate, type);
  document.getElementById('modalOverlay').classList.add('open');
}

function showModalImg(siteId, date, type) {
  const suffix = type === 'full' ? 'full' : type === 'gnb' ? 'gnb-hover' : 'top';
  const src = \`screenshots/\${siteId}/\${date}-\${suffix}.png\`;
  const content = document.getElementById('modalContent');

  // 기존 img 태그 재사용 (새로 innerHTML 교체하면 캐시 무효화됨)
  let img = content.querySelector('img');
  let link = content.querySelector('a.open-btn');

  if (!img) {
    // 처음 열 때만 구조 생성
    content.innerHTML = \`
      <div class="modal-loading">⏳ 로딩 중...</div>
      <img style="display:none" alt=""/>
      <br/><a href="" target="_blank" class="open-btn" style="display:none">원본 크기로 보기 ↗</a>
    \`;
    img = content.querySelector('img');
    link = content.querySelector('a.open-btn');
  }

  const loading = content.querySelector('.modal-loading');
  if (loading) loading.style.display = 'block';
  img.style.display = 'none';
  if (link) link.style.display = 'none';

  // 이미 같은 src면 즉시 표시 (캐시 활용)
  if (img.src === location.origin + '/' + src || img.src === src) {
    if (loading) loading.style.display = 'none';
    img.style.display = 'block';
    if (link) link.style.display = 'inline-block';
    return;
  }

  img.onload = () => {
    if (loading) loading.style.display = 'none';
    img.style.display = 'block';
    if (link) { link.href = src; link.style.display = 'inline-block'; }
  };
  img.onerror = () => {
    if (loading) loading.textContent = '❌ 이미지를 불러올 수 없습니다.';
  };
  img.src = src;
  if (link) link.href = src;
}

function switchModalTab(btn, siteId, type) {
  document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  showModalImg(siteId, currentDate, type);
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay')) {
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

// 키보드 ESC로 모달 닫기
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
</script>
</body>
</html>`;

fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync(path.join('docs', 'index.html'), html);
console.log('✅ Dashboard generated: docs/index.html');
