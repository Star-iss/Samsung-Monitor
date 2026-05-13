const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const metaDir = path.join('docs', 'meta');
const indexPath = path.join(metaDir, 'index.json');

const dates = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
const latest = dates[0] || null;

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Samsung Web Monitor</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #222; }

  header {
    background: #1428A0; color: white;
    padding: 18px 32px; display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  header h1 { font-size: 1.3rem; font-weight: 700; }
  header .meta { font-size: 0.82rem; opacity: 0.8; }

  .toolbar {
    background: white; padding: 14px 32px;
    border-bottom: 1px solid #e0e0e0;
    display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
  }

  /* 날짜 선택 */
  .toolbar label { font-size: 0.85rem; color: #555; font-weight: 600; }
  .toolbar select {
    padding: 6px 12px; border: 1px solid #ccc;
    border-radius: 6px; font-size: 0.85rem; cursor: pointer;
  }

  /* 국가 슬라이서 */
  .country-slicer {
    background: white; padding: 12px 32px;
    border-bottom: 1px solid #e0e0e0;
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
  }
  .slicer-label { font-size: 0.82rem; color: #555; font-weight: 600; margin-right: 4px; }
  .country-btn {
    padding: 5px 14px; border: 1.5px solid #ddd;
    border-radius: 20px; background: white;
    font-size: 0.8rem; cursor: pointer; color: #444;
    transition: all 0.15s;
  }
  .country-btn:hover { border-color: #1428A0; color: #1428A0; }
  .country-btn.active { background: #1428A0; color: white; border-color: #1428A0; font-weight: 600; }
  .country-btn.all { background: #f0f2f5; }
  .country-btn.all.active { background: #1428A0; color: white; }

  /* 그리드 */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
    gap: 20px; padding: 24px 32px;
    max-width: 1600px; margin: 0 auto;
  }

  .card {
    background: white; border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    overflow: hidden; transition: transform 0.15s;
  }
  .card:hover { transform: translateY(-2px); }
  .card.hidden { display: none; }

  .card-header { padding: 14px 18px 10px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 10px; }
  .country-badge {
    background: #e8eaf6; color: #1428A0;
    font-size: 0.75rem; font-weight: 700;
    padding: 2px 8px; border-radius: 4px;
  }
  .site-name { font-weight: 700; font-size: 0.95rem; color: #222; }
  .site-url { font-size: 0.75rem; color: #aaa; margin-left: auto; text-decoration: none; }
  .site-url:hover { color: #1428A0; }

  .tab-bar { display: flex; border-bottom: 1px solid #eee; background: #fafafa; }
  .tab {
    flex: 1; padding: 9px; border: none; background: none;
    font-size: 0.8rem; cursor: pointer; color: #666;
    border-bottom: 2px solid transparent; transition: all 0.15s;
  }
  .tab:hover { background: #f0f0f0; }
  .tab.active { color: #1428A0; border-bottom-color: #1428A0; font-weight: 600; background: white; }

  .tab-content { display: none; }
  .tab-content.active { display: block; }

  .img-wrap { position: relative; cursor: pointer; overflow: hidden; }
  .img-label {
    position: absolute; top: 8px; left: 8px;
    background: rgba(0,0,0,0.55); color: white;
    font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; z-index: 1;
  }
  .img-wrap img {
    width: 100%; height: 220px;
    object-fit: cover; object-position: top; display: block;
  }
  .no-img { text-align:center; padding: 50px 0; color: #bbb; font-size: 0.82rem; }

  .card-footer {
    padding: 10px 18px; background: #fafafa;
    border-top: 1px solid #f0f0f0; display: flex; gap: 6px; flex-wrap: wrap;
  }
  .badge {
    font-size: 0.72rem; background: #e8eaf6; color: #1428A0;
    padding: 3px 10px; border-radius: 20px; text-decoration: none;
  }
  .badge:hover { background: #1428A0; color: white; }

  /* Modal */
  .modal-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.75); z-index: 100;
    align-items: center; justify-content: center;
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: white; border-radius: 16px;
    width: 92vw; max-width: 1100px; max-height: 90vh;
    overflow-y: auto; padding: 24px; position: relative;
  }
  .modal-close {
    position: absolute; top: 14px; right: 18px;
    background: none; border: none; font-size: 1.4rem; cursor: pointer; color: #555;
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

  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr; padding: 16px; }
    .country-slicer { padding: 12px 16px; }
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
  <label>📅 날짜 선택:</label>
  <select id="dateSelect" onchange="changeDate(this.value)">
    ${dates.map(d => `<option value="${d}">${d}</option>`).join('')}
  </select>
  <span style="margin-left:auto;font-size:0.82rem;color:#888;">총 ${config.countries.length}개 국가 × ${config.pages.length}개 페이지</span>
</div>

<div class="country-slicer">
  <span class="slicer-label">🌍 국가:</span>
  <button class="country-btn all active" onclick="filterCountry('all', this)">전체</button>
  ${config.countries.map(c => `<button class="country-btn" data-country="${c.code}" onclick="filterCountry('${c.code}', this)">${c.name}</button>`).join('')}
</div>

<div class="grid" id="grid">
  ${config.countries.map(country =>
    config.pages.map(page_config => {
      const siteId = `${country.code}-${page_config.id}`;
      const topImg = `screenshots/${siteId}/${latest}-top.png`;
      const gnbImg = `screenshots/${siteId}/${latest}-gnb-hover.png`;
      const fullImg = `screenshots/${siteId}/${latest}-full.png`;

      const tabs = [
        `<button class="tab active" onclick="switchTab(this, '${siteId}', 'top')">🖥️ 상단 뷰</button>`,
        page_config.gnbHover ? `<button class="tab" onclick="switchTab(this, '${siteId}', 'gnb')">📂 GNB Hover</button>` : '',
      ].filter(Boolean).join('');

      return `
      <div class="card" data-country="${country.code}">
        <div class="card-header">
          <span class="country-badge">${country.name}</span>
          <span class="site-name">${page_config.name}</span>
          <a href="https://www.samsung.com/${country.code}${page_config.path}" target="_blank" class="site-url">↗ 방문</a>
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

        <div class="card-footer">
          <a href="${fullImg}" target="_blank" class="badge">📄 전체 페이지</a>
          <a href="${topImg}" target="_blank" class="badge">🖼️ 상단 원본</a>
          ${page_config.gnbHover ? `<a href="${gnbImg}" target="_blank" class="badge">📂 GNB 원본</a>` : ''}
        </div>
      </div>`;
    }).join('')
  ).join('')}
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
const config = ${JSON.stringify(config)};
const dates = ${JSON.stringify(dates)};
let currentDate = dates[0] || '';
let currentCountry = 'all';

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
  // 모든 카드 이미지 업데이트
  config.countries.forEach(country => {
    config.pages.forEach(page => {
      const siteId = country.code + '-' + page.id;
      const topEl = document.querySelector('#' + siteId + '-top img');
      if (topEl) topEl.src = 'screenshots/' + siteId + '/' + date + '-top.png';
      if (page.gnbHover) {
        const gnbEl = document.querySelector('#' + siteId + '-gnb img');
        if (gnbEl) gnbEl.src = 'screenshots/' + siteId + '/' + date + '-gnb-hover.png';
      }
      // 카드 footer 링크 업데이트
      const card = topEl ? topEl.closest('.card') : null;
      if (card) {
        const badges = card.querySelectorAll('.badge');
        badges.forEach(b => {
          if (b.href.includes('-full.png')) b.href = 'screenshots/' + siteId + '/' + date + '-full.png';
          if (b.href.includes('-top.png')) b.href = 'screenshots/' + siteId + '/' + date + '-top.png';
          if (b.href.includes('-gnb-hover.png')) b.href = 'screenshots/' + siteId + '/' + date + '-gnb-hover.png';
        });
        // img-label 업데이트
        card.querySelectorAll('.img-label').forEach(lbl => {
          lbl.textContent = lbl.textContent.replace(/\\d{4}-\\d{2}-\\d{2}/, date);
        });
      }
    });
  });
}

function switchTab(btn, siteId, tab) {
  btn.closest('.card').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  btn.closest('.card').querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(siteId + '-' + tab).classList.add('active');
}

function openModal(siteId, type) {
  const parts = siteId.split('-');
  const countryCode = parts[0];
  const pageId = parts.slice(1).join('-');
  const country = config.countries.find(c => c.code === countryCode);
  const page = config.pages.find(p => p.id === pageId);

  document.getElementById('modalTitle').textContent = (country ? country.name : countryCode) + ' · ' + (page ? page.name : pageId);

  const types = [
    { key: 'top', label: '🖥️ 상단 뷰' },
    ...(page && page.gnbHover ? [{ key: 'gnb', label: '📂 GNB Hover' }] : []),
    { key: 'full', label: '📄 전체 페이지' },
  ];

  document.getElementById('modalTabs').innerHTML = types.map(t =>
    '<button class="modal-tab-btn ' + (t.key === type ? 'active' : '') + '" onclick="switchModalTab(this, \\'' + siteId + '\\', \\'' + t.key + '\\')">' + t.label + '</button>'
  ).join('');

  showModalImg(siteId, type);
  document.getElementById('modalOverlay').classList.add('open');
}

function showModalImg(siteId, type) {
  const suffix = type === 'full' ? 'full' : type === 'gnb' ? 'gnb-hover' : 'top';
  const src = 'screenshots/' + siteId + '/' + currentDate + '-' + suffix + '.png';
  document.getElementById('modalContent').innerHTML =
    '<img src="' + src + '" alt="' + type + '"/><br/><a href="' + src + '" target="_blank" class="open-btn">원본 크기로 보기 ↗</a>';
}

function switchModalTab(btn, siteId, type) {
  document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  showModalImg(siteId, type);
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay')) {
    document.getElementById('modalOverlay').classList.remove('open');
  }
}
</script>
</body>
</html>`;

fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync(path.join('docs', 'index.html'), html);
console.log('Dashboard generated: docs/index.html');
