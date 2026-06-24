const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const metaDir = path.join('docs', 'meta');
const indexPath = path.join(metaDir, 'index.json');

const dates = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
const latest = dates[0] || null;

// 국가 코드별 국기 이모지 직접 매핑
const flagMap = {
  de: '🇩🇪', au: '🇦🇺', be: '🇧🇪', be_fr: '🇧🇪',
  fr: '🇫🇷', it: '🇮🇹', sec: '🇰🇷', nl: '🇳🇱',
  no: '🇳🇴', pt: '🇵🇹', es: '🇪🇸', se: '🇸🇪',
  tr: '🇹🇷', uk: '🇬🇧', us: '🇺🇸'
};

const labelMap = {
  de: 'DE', au: 'AU', be: 'BE', be_fr: 'BE-FR',
  fr: 'FR', it: 'IT', sec: 'KR', nl: 'NL',
  no: 'NO', pt: 'PT', es: 'ES', se: 'SE',
  tr: 'TR', uk: 'UK', us: 'US'
};

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
    background: white; padding: 12px 32px;
    border-bottom: 1px solid #e0e0e0;
    display: flex; gap: 16px; align-items: center;
  }
  .toolbar label { font-size: 0.85rem; color: #555; font-weight: 600; }
  .toolbar select { padding: 6px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
  .toolbar .right { margin-left: auto; font-size: 0.82rem; color: #888; }

  /* 국가 슬라이서 */
  .country-slicer {
    background: white; padding: 0 32px;
    border-bottom: 2px solid #e0e0e0;
    display: flex; gap: 0; align-items: stretch; overflow-x: auto;
  }
  .country-btn {
    padding: 10px 16px; border: none; border-bottom: 3px solid transparent;
    background: none; cursor: pointer; color: #666;
    transition: all 0.15s; display: flex; align-items: center; gap: 6px;
    white-space: nowrap; font-size: 0.83rem;
  }
  .country-btn:hover { color: #1428A0; background: #f5f7ff; }
  .country-btn.active { color: #1428A0; border-bottom-color: #1428A0; font-weight: 700; background: #f0f3ff; }
  .country-btn .flag { font-size: 1.3rem; line-height: 1; }
  .country-btn .code { font-size: 0.78rem; font-weight: 600; }

  /* 그리드 */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
    gap: 20px; padding: 24px 32px;
    max-width: 1600px; margin: 0 auto;
  }

  .card {
    background: white; border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    overflow: hidden; transition: transform 0.15s, box-shadow 0.15s;
  }
  .card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.11); }
  .card.hidden { display: none; }

  .card-header {
    padding: 14px 18px 10px; border-bottom: 1px solid #f0f0f0;
    display: flex; align-items: center; gap: 8px;
  }
  .card-flag { font-size: 1.5rem; line-height: 1; }
  .card-country { background: #1428A0; color: white; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
  .card-title { font-weight: 700; font-size: 0.95rem; color: #222; }
  .card-link { font-size: 0.75rem; color: #aaa; margin-left: auto; text-decoration: none; }
  .card-link:hover { color: #1428A0; }

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
  .img-wrap img { width: 100%; height: 220px; object-fit: cover; object-position: top; display: block; }
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

  ::-webkit-scrollbar { height: 4px; }
  ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
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
  ${config.countries.map((c, i) => {
    const flag = flagMap[c.code] || '🌐';
    const label = labelMap[c.code] || c.code.toUpperCase();
    return `<button class="country-btn${i === 0 ? ' active' : ''}" data-country="${c.code}" onclick="filterCountry('${c.code}', this)">
      <span class="flag">${flag}</span>
      <span class="code">${label}</span>
    </button>`;
  }).join('')}
</div>

<div class="grid" id="grid">
  ${config.countries.map((country, ci) => {
    const flag = flagMap[country.code] || '🌐';
    const label = labelMap[country.code] || country.code.toUpperCase();
    return config.pages.map(page_config => {
      const siteId = `${country.code}-${page_config.id}`;
      const topImg = `screenshots/${siteId}/${latest}-top.png`;
      const gnbImg = `screenshots/${siteId}/${latest}-gnb-hover.png`;
      const fullImg = `screenshots/${siteId}/${latest}-full.png`;

      const tabs = [
        `<button class="tab active" onclick="switchTab(this, '${siteId}', 'top')">🖥️ 상단 뷰</button>`,
        page_config.gnbHover ? `<button class="tab" onclick="switchTab(this, '${siteId}', 'gnb')">📂 GNB Hover</button>` : '',
      ].filter(Boolean).join('');

      return `
      <div class="card${ci === 0 ? '' : ' hidden'}" data-country="${country.code}">
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

        <div class="card-footer">
          <a href="${fullImg}" target="_blank" class="badge">📄 전체 페이지</a>
          <a href="${topImg}" target="_blank" class="badge">🖼️ 상단 원본</a>
          ${page_config.gnbHover ? `<a href="${gnbImg}" target="_blank" class="badge">📂 GNB 원본</a>` : ''}
        </div>
      </div>`;
    }).join('');
  }).join('')}
</div>

<div class="modal-overlay" id="modalOverlay" onclick="closeModal(event)">
  <div class="modal">
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h2 id="modalTitle"></h2>
    <div class="modal-tabs" id="modalTabs"></div>
    <div id="modalContent"></div>
  </div>
</div>

<script>
const config = ${JSON.stringify({...config, flagMap: flagMap, labelMap: labelMap})};
const dates = ${JSON.stringify(dates)};
let currentDate = dates[0] || '';

function filterCountry(code, btn) {
  document.querySelectorAll('.country-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.card').forEach(card => {
    card.classList.toggle('hidden', card.dataset.country !== code);
  });
}

function changeDate(date) {
  currentDate = date;
  config.countries.forEach(country => {
    config.pages.forEach(page => {
      const siteId = country.code + '-' + page.id;
      const topEl = document.querySelector('#' + siteId + '-top img');
      if (topEl) topEl.src = 'screenshots/' + siteId + '/' + date + '-top.png';
      if (page.gnbHover) {
        const gnbEl = document.querySelector('#' + siteId + '-gnb img');
        if (gnbEl) gnbEl.src = 'screenshots/' + siteId + '/' + date + '-gnb-hover.png';
      }
      const card = topEl ? topEl.closest('.card') : null;
      if (card) {
        card.querySelectorAll('.badge').forEach(b => {
          if (b.href.includes('-full.png')) b.href = 'screenshots/' + siteId + '/' + date + '-full.png';
          if (b.href.includes('-top.png')) b.href = 'screenshots/' + siteId + '/' + date + '-top.png';
          if (b.href.includes('-gnb-hover.png')) b.href = 'screenshots/' + siteId + '/' + date + '-gnb-hover.png';
        });
        card.querySelectorAll('.img-label').forEach(lbl => {
          lbl.textContent = lbl.textContent.replace(/\d{4}-\d{2}-\d{2}/, date);
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
  const flag = config.flagMap[countryCode] || '';
  const label = config.labelMap[countryCode] || countryCode;

  document.getElementById('modalTitle').textContent = flag + ' ' + label + ' · ' + (page ? page.name : pageId);

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
console.log('Dashboard generated!');
