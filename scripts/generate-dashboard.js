const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const metaDir = path.join('docs', 'meta');
const indexPath = path.join(metaDir, 'index.json');

const dates = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
const latest = dates[0] || null;
const previous = dates[1] || null;

function getSiteCards() {
  if (!latest) return '<p style="text-align:center;color:#888;">아직 캡처된 데이터가 없습니다.</p>';

  return config.sites.map(site => {
    const topImg = `screenshots/${site.id}/${latest}-top.png`;
    const gnbImg = `screenshots/${site.id}/${latest}-gnb-hover.png`;
    const prevTopImg = previous ? `screenshots/${site.id}/${previous}-top.png` : null;
    const hasGnb = site.gnbHover === true;

    // 탭 구성: gnbHover 있는 사이트만 GNB Hover 탭 표시
    const tabs = [
      `<button class="tab active" onclick="switchTab(this, '${site.id}', 'top')">🖥️ 상단 뷰</button>`,
      hasGnb ? `<button class="tab" onclick="switchTab(this, '${site.id}', 'gnb')">📂 GNB Hover</button>` : '',
      prevTopImg ? `<button class="tab" onclick="switchTab(this, '${site.id}', 'compare')">📅 날짜 비교</button>` : '',
    ].filter(Boolean).join('');

    return `
    <div class="card">
      <div class="card-header">
        <div class="site-name">${site.name}</div>
        <a href="${site.url}" target="_blank" class="site-url">${site.url}</a>
      </div>

      <div class="tab-bar">${tabs}</div>

      <div class="tab-content" id="${site.id}-top">
        <div class="img-wrap">
          <div class="img-label">최신 (${latest})</div>
          <img src="${topImg}" onclick="openModal('${site.id}', '${latest}', 'top')" onerror="this.parentElement.innerHTML='<p class=no-img>이미지 없음</p>'"/>
        </div>
      </div>

      ${hasGnb ? `
      <div class="tab-content hidden" id="${site.id}-gnb">
        <div class="img-wrap">
          <div class="img-label">GNB Hover (${latest})</div>
          <img src="${gnbImg}" onclick="openModal('${site.id}', '${latest}', 'gnb')" onerror="this.parentElement.innerHTML='<p class=no-img>이미지 없음</p>'"/>
        </div>
      </div>` : ''}

      ${prevTopImg ? `
      <div class="tab-content hidden" id="${site.id}-compare">
        <div class="card-images">
          <div class="img-wrap">
            <div class="img-label">최신 (${latest})</div>
            <img src="${topImg}" onclick="openModal('${site.id}', '${latest}', 'top')"/>
          </div>
          <div class="img-wrap">
            <div class="img-label">이전 (${previous})</div>
            <img src="${prevTopImg}" onclick="openModal('${site.id}', '${previous}', 'top')"/>
          </div>
        </div>
      </div>` : ''}

      <div class="card-footer">
        <a href="screenshots/${site.id}/${latest}-full.png" target="_blank" class="badge">📄 전체 페이지 원본</a>
        <a href="screenshots/${site.id}/${latest}-top.png" target="_blank" class="badge">🖼️ 상단 원본</a>
        ${hasGnb ? `<a href="screenshots/${site.id}/${latest}-gnb-hover.png" target="_blank" class="badge">📂 GNB 원본</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

function getDateOptions() {
  return dates.map(d => `<option value="${d}">${d}</option>`).join('');
}

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Samsung Web Monitor Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #222; }

  header {
    background: #1428A0;
    color: white;
    padding: 20px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  header h1 { font-size: 1.4rem; font-weight: 700; }
  header .meta { font-size: 0.85rem; opacity: 0.8; }

  .toolbar {
    background: white;
    padding: 14px 32px;
    display: flex;
    gap: 12px;
    align-items: center;
    border-bottom: 1px solid #e0e0e0;
    flex-wrap: wrap;
  }
  .toolbar label { font-size: 0.88rem; color: #555; }
  .toolbar select { padding: 6px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.88rem; }
  .toolbar .total { margin-left: auto; font-size: 0.85rem; color: #888; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
    gap: 24px;
    padding: 28px 32px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    overflow: hidden;
  }

  .card-header { padding: 16px 20px 12px; border-bottom: 1px solid #f0f0f0; }
  .site-name { font-weight: 700; font-size: 1rem; color: #1428A0; }
  .site-url { font-size: 0.78rem; color: #888; text-decoration: none; display: block; margin-top: 2px; }
  .site-url:hover { color: #1428A0; }

  .tab-bar { display: flex; border-bottom: 1px solid #eee; background: #fafafa; }
  .tab {
    flex: 1; padding: 10px; border: none; background: none;
    font-size: 0.82rem; cursor: pointer; color: #666;
    border-bottom: 2px solid transparent; transition: all 0.15s;
  }
  .tab:hover { background: #f0f0f0; }
  .tab.active { color: #1428A0; border-bottom-color: #1428A0; font-weight: 600; background: white; }

  .tab-content { padding: 0; }
  .tab-content.hidden { display: none; }

  .img-wrap { position: relative; overflow: hidden; cursor: pointer; }
  .img-label {
    position: absolute; top: 8px; left: 8px;
    background: rgba(0,0,0,0.6); color: white;
    font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; z-index: 1;
  }
  .img-wrap img { width: 100%; height: 240px; object-fit: cover; object-position: top; display: block; transition: opacity 0.2s; }
  .img-wrap img:hover { opacity: 0.9; }
  .no-img { text-align: center; padding: 60px 0; color: #aaa; font-size: 0.85rem; }

  .card-images { display: flex; }
  .card-images .img-wrap { flex: 1; }
  .card-images .img-wrap + .img-wrap { border-left: 2px solid #f0f0f0; }

  .card-footer {
    padding: 12px 20px; background: #fafafa;
    border-top: 1px solid #f0f0f0; display: flex; gap: 8px; flex-wrap: wrap;
  }
  .badge {
    font-size: 0.75rem; background: #e8eaf6; color: #1428A0;
    padding: 4px 12px; border-radius: 20px; text-decoration: none; cursor: pointer;
  }
  .badge:hover { background: #1428A0; color: white; }

  .modal-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.75); z-index: 100;
    align-items: center; justify-content: center;
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: white; border-radius: 16px;
    width: 92vw; max-width: 1100px; max-height: 90vh;
    overflow-y: auto; padding: 28px; position: relative;
  }
  .modal-close {
    position: absolute; top: 16px; right: 20px;
    background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #555;
  }
  .modal h2 { font-size: 1.1rem; color: #1428A0; margin-bottom: 16px; }
  .modal-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .modal-tab-btn {
    padding: 6px 16px; border: 1px solid #ddd; border-radius: 20px;
    background: none; cursor: pointer; font-size: 0.82rem; color: #555;
  }
  .modal-tab-btn.active { background: #1428A0; color: white; border-color: #1428A0; }
  .modal img { width: 100%; border: 1px solid #eee; border-radius: 8px; }
  .open-btn {
    display: inline-block; margin-top: 10px; background: #1428A0; color: white;
    padding: 7px 18px; border-radius: 8px; font-size: 0.82rem; text-decoration: none;
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
  <label>날짜:</label>
  <select id="dateSelect">
    ${getDateOptions()}
  </select>
  <span class="total">총 ${config.sites.length}개 사이트 모니터링 중</span>
</div>

<div class="grid">${getSiteCards()}</div>

<div class="modal-overlay" id="modalOverlay" onclick="closeModal(event)">
  <div class="modal">
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h2 id="modalTitle"></h2>
    <div class="modal-tabs" id="modalTabs"></div>
    <div id="modalContent"></div>
  </div>
</div>

<script>
const sites = ${JSON.stringify(config.sites)};
const dates = ${JSON.stringify(dates)};

function switchTab(btn, siteId, tab) {
  btn.closest('.card').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  btn.closest('.card').querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(siteId + '-' + tab).classList.remove('hidden');
}

function openModal(siteId, date, type) {
  const site = sites.find(s => s.id === siteId);
  document.getElementById('modalTitle').textContent = site.name;

  const types = [
    { key: 'top', label: '🖥️ 상단 뷰' },
    ...(site.gnbHover ? [{ key: 'gnb', label: '📂 GNB Hover' }] : []),
    { key: 'full', label: '📄 전체 페이지' },
  ];

  document.getElementById('modalTabs').innerHTML = types.map(t =>
    \`<button class="modal-tab-btn \${t.key === type ? 'active' : ''}"
      onclick="switchModalTab(this, '\${siteId}', '\${date}', '\${t.key}')">\${t.label}</button>\`
  ).join('');

  showModalImg(siteId, date, type);
  document.getElementById('modalOverlay').classList.add('open');
}

function showModalImg(siteId, date, type) {
  const suffix = type === 'full' ? 'full' : type === 'gnb' ? 'gnb-hover' : 'top';
  const src = \`screenshots/\${siteId}/\${date}-\${suffix}.png\`;
  document.getElementById('modalContent').innerHTML = \`
    <img src="\${src}" alt="\${type}"/>
    <br/><a href="\${src}" target="_blank" class="open-btn">원본 크기로 보기 ↗</a>
  \`;
}

function switchModalTab(btn, siteId, date, type) {
  document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  showModalImg(siteId, date, type);
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
