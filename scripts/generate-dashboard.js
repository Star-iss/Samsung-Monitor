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
<title>Samsung Web Monitor</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; color: #222; }

  header {
    background: #1428A0; color: white;
    padding: 14px 24px; display: flex; justify-content: space-between; align-items: center;
  }
  header h1 { font-size: 1.1rem; font-weight: 700; }
  header .meta { font-size: 0.78rem; opacity: 0.8; margin-top: 2px; }

  .toolbar {
    background: white; padding: 10px 24px;
    display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid #e0e0e0; font-size: 0.85rem;
  }
  .toolbar label { color: #555; }
  .toolbar select {
    border: 1px solid #ccc; border-radius: 6px;
    padding: 5px 10px; font-size: 0.85rem; cursor: pointer;
    background: white;
  }
  .toolbar .right { margin-left: auto; color: #888; font-size: 0.78rem; }

  .country-slicer {
    background: white; padding: 10px 24px;
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
    border-bottom: 1px solid #e0e0e0;
  }
  .country-btn {
    padding: 5px 14px; border: 1px solid #ddd; border-radius: 20px;
    background: white; cursor: pointer; font-size: 0.82rem; color: #444;
    transition: all 0.15s;
  }
  .country-btn:hover { border-color: #1428A0; color: #1428A0; }
  .country-btn.active { background: #1428A0; color: white; border-color: #1428A0; }

  .grid {
    display: grid;
    grid-template-columns: repeat(${config.pages.length}, 1fr);
    gap: 20px; padding: 20px 24px;
  }

  .card {
    background: white; border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;
  }
  .card.hidden { display: none; }

  .card-header {
    padding: 12px 16px; display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid #f0f0f0;
  }
  .card-flag { font-size: 1.2rem; }
  .card-country { font-weight: 700; font-size: 0.88rem; color: #1428A0; }
  .card-title { font-size: 0.82rem; color: #666; flex: 1; }
  .card-link {
    font-size: 0.75rem; color: #1428A0; text-decoration: none;
    padding: 3px 8px; border: 1px solid #1428A0; border-radius: 12px;
  }
  .card-link:hover { background: #1428A0; color: white; }

  .tab-bar {
    display: flex; gap: 0; border-bottom: 1px solid #eee;
    padding: 0 12px; background: #fafafa;
  }
  .tab {
    padding: 8px 14px; border: none; background: none;
    cursor: pointer; font-size: 0.8rem; color: #888;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    transition: all 0.15s;
  }
  .tab:hover { color: #1428A0; }
  .tab.active { color: #1428A0; border-bottom-color: #1428A0; font-weight: 600; }

  .tab-content { display: none; }
  .tab-content.active { display: block; }

  .img-wrap {
    cursor: pointer; position: relative; overflow: hidden;
    background: #f5f5f5;
  }
  .img-wrap:hover { opacity: 0.92; }
  .img-label {
    position: absolute; top: 8px; left: 8px; z-index: 2;
    background: rgba(0,0,0,0.6); color: white;
    font-size: 0.7rem; padding: 3px 8px; border-radius: 10px;
  }
  .img-wrap img {
    width: 100%; display: block;
    transition: opacity 0.2s ease;
  }
  .no-img {
    text-align: center; padding: 40px; color: #aaa; font-size: 0.85rem;
  }

  .card-footer {
    padding: 10px 14px; display: flex; gap: 8px; flex-wrap: wrap;
    border-top: 1px solid #f0f0f0; background: #fafafa;
  }
  .badge {
    font-size: 0.75rem; color: #555; text-decoration: none;
    padding: 3px 10px; border: 1px solid #ddd; border-radius: 12px;
    background: white;
  }
  .badge:hover { border-color: #1428A0; color: #1428A0; }

  /* Modal */
  .modal-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.7); z-index: 1000;
    justify-content: center; align-items: center;
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: white; border-radius: 12px;
    width: 90vw; max-width: 1100px; max-height: 90vh;
    overflow-y: auto; padding: 24px; position: relative;
  }
  .modal-close {
    position: absolute; top: 14px; right: 18px;
    background: none; border: none; font-size: 1.4rem;
    cursor: pointer; color: #555;
  }
  .modal h2 { font-size: 1rem; color: #1428A0; margin-bottom: 14px; }
  .modal-tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .modal-tab-btn {
    padding: 5px 14px; border: 1px solid #ddd; border-radius: 20px;
    background: none; cursor: pointer; font-size: 0.8rem; color: #555;
  }
  .modal-tab-btn.active { background: #1428A0; color: white; border-color: #1428A0; }
  .modal img { width: 100%; border: 1px solid #eee; border-radius: 8px; }
  .open-btn {
    display: inline-block; margin-top: 10px; background: #1428A0; color: white;
    padding: 7px 16px; border-radius: 8px; font-size: 0.82rem; text-decoration: none;
  }

  ::-webkit-scrollbar { height: 4px; width: 4px; }
  ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }

  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr; padding: 16px; }
    .country-slicer { padding: 10px 16px; }
  }
</style>
</head>
<body>

<header>
  <div>
    <h1>🖥️ Samsung Web Monitor</h1>
    <div class="meta">팀 내부용 웹 변경 모니터링 대시보드</div>
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
}

function changeDate(date) {
  currentDate = date;
  config.countries.forEach(country => {
    config.pages.forEach(page => {
      const siteId = country.code + '-' + page.id;

      function swapImg(wrap, newSrc, labelText) {
        if (!wrap) return;
        let img = wrap.querySelector('img');
        if (!img) {
          wrap.innerHTML = '<div class="img-label"></div><img/>';
          img = wrap.querySelector('img');
        }
        const lbl = wrap.querySelector('.img-label');
        if (lbl) lbl.textContent = labelText;
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

      // 상단 뷰
      swapImg(
        document.querySelector('#' + siteId + '-top .img-wrap'),
        'screenshots/' + siteId + '/' + date + '-top.png',
        date
      );

      // GNB Hover
      if (page.gnbHover) {
        swapImg(
          document.querySelector('#' + siteId + '-gnb .img-wrap'),
          'screenshots/' + siteId + '/' + date + '-gnb-hover.png',
          'GNB Hover · ' + date
        );
      }

      // 전체 페이지
      if (page.captureFullPage) {
        swapImg(
          document.querySelector('#' + siteId + '-full .img-wrap'),
          'screenshots/' + siteId + '/' + date + '-full.png',
          '전체 페이지 · ' + date
        );
      }

      // footer 배지 링크 업데이트
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
  document.getElementById('modalContent').innerHTML = \`
    <img src="\${src}" onerror="this.src=''" alt="\${type}"/>
    <br/><a href="\${src}" target="_blank" class="open-btn">원본 크기로 보기 ↗</a>
  \`;
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
