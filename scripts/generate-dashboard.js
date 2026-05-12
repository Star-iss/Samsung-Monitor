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
    const latestImg = `screenshots/${site.id}/${latest}-top.png`;
    const prevImg = previous ? `screenshots/${site.id}/${previous}-top.png` : null;

    return `
    <div class="card" onclick="openModal('${site.id}', '${latest}')">
      <div class="card-header">
        <div class="site-name">${site.name}</div>
        <a href="${site.url}" target="_blank" class="site-url">${site.url}</a>
      </div>
      <div class="card-images">
        <div class="img-wrap">
          <div class="img-label">최신 (${latest})</div>
          <img src="${latestImg}" alt="${site.name}" onerror="this.src='placeholder.png'"/>
        </div>
        ${prevImg ? `
        <div class="img-wrap">
          <div class="img-label">이전 (${previous})</div>
          <img src="${prevImg}" alt="${site.name} previous" onerror="this.src='placeholder.png'"/>
        </div>` : ''}
      </div>
      <div class="card-footer">
        <span class="badge">전체보기 클릭</span>
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
  header h1 { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.5px; }
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
  .toolbar select {
    padding: 6px 12px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 0.88rem;
  }
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
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .card:hover { transform: translateY(-3px); box-shadow: 0 6px 18px rgba(0,0,0,0.12); }

  .card-header { padding: 16px 20px 12px; border-bottom: 1px solid #f0f0f0; }
  .site-name { font-weight: 700; font-size: 1rem; color: #1428A0; }
  .site-url { font-size: 0.78rem; color: #888; text-decoration: none; display: block; margin-top: 2px; }
  .site-url:hover { color: #1428A0; }

  .card-images {
    display: flex;
    gap: 0;
  }
  .img-wrap { flex: 1; overflow: hidden; position: relative; }
  .img-wrap + .img-wrap { border-left: 2px solid #f0f0f0; }
  .img-label {
    position: absolute;
    top: 8px; left: 8px;
    background: rgba(0,0,0,0.6);
    color: white;
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 4px;
    z-index: 1;
  }
  .img-wrap img { width: 100%; height: 220px; object-fit: cover; object-position: top; display: block; }

  .card-footer {
    padding: 10px 20px;
    background: #fafafa;
    border-top: 1px solid #f0f0f0;
  }
  .badge {
    font-size: 0.75rem;
    background: #e8eaf6;
    color: #1428A0;
    padding: 3px 10px;
    border-radius: 20px;
  }

  /* Modal */
  .modal-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 100;
    align-items: center;
    justify-content: center;
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: white;
    border-radius: 16px;
    width: 90vw;
    max-width: 1100px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 28px;
    position: relative;
  }
  .modal-close {
    position: absolute; top: 16px; right: 20px;
    background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #555;
  }
  .modal h2 { font-size: 1.2rem; color: #1428A0; margin-bottom: 16px; }
  .modal-dates { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .modal-dates select { padding: 6px 12px; border: 1px solid #ccc; border-radius: 6px; }
  .modal-img-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .modal-img-grid img { width: 100%; border: 1px solid #eee; border-radius: 8px; }
  .modal-img-label { font-size: 0.8rem; color: #666; margin-bottom: 6px; font-weight: 600; }
  .full-btn {
    display: inline-block; margin-top: 12px;
    background: #1428A0; color: white;
    padding: 8px 20px; border-radius: 8px;
    font-size: 0.85rem; text-decoration: none;
  }

  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr; padding: 16px; }
    header { padding: 16px; }
    .modal-img-grid { grid-template-columns: 1fr; }
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
  <label>날짜 선택:</label>
  <select id="dateSelect" onchange="filterByDate(this.value)">
    ${getDateOptions()}
  </select>
  <span class="total">총 ${config.sites.length}개 사이트 모니터링 중</span>
</div>

<div class="grid" id="grid">
  ${getSiteCards()}
</div>

<!-- Modal -->
<div class="modal-overlay" id="modalOverlay" onclick="closeModal(event)">
  <div class="modal" id="modal">
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h2 id="modalTitle">-</h2>
    <div id="modalContent"></div>
  </div>
</div>

<script>
const allDates = ${JSON.stringify(dates)};
const sites = ${JSON.stringify(config.sites)};

function openModal(siteId, date) {
  const site = sites.find(s => s.id === siteId);
  document.getElementById('modalTitle').textContent = site.name;

  const dateOptions = allDates.map(d => \`<option value="\${d}" \${d === date ? 'selected' : ''}>\${d}</option>\`).join('');

  document.getElementById('modalContent').innerHTML = \`
    <div class="modal-dates">
      <div>
        <label style="font-size:0.85rem;color:#555">날짜 선택: </label>
        <select onchange="updateModalDate('\${siteId}', this.value)">\${dateOptions}</select>
      </div>
      <a href="\${site.url}" target="_blank" class="full-btn">🔗 실제 사이트 방문</a>
    </div>
    <div class="modal-img-grid">
      <div>
        <div class="modal-img-label">🖥️ 상단 뷰 (${latest})</div>
        <img src="screenshots/\${siteId}/\${date}-top.png" alt="top"/>
        <a href="screenshots/\${siteId}/\${date}-top.png" target="_blank" class="full-btn" style="margin-top:8px">원본 크기로 보기</a>
      </div>
      <div>
        <div class="modal-img-label">📄 전체 페이지 (${latest})</div>
        <img src="screenshots/\${siteId}/\${date}-full.png" alt="full"/>
        <a href="screenshots/\${siteId}/\${date}-full.png" target="_blank" class="full-btn" style="margin-top:8px">원본 크기로 보기</a>
      </div>
    </div>
  \`;

  document.getElementById('modalOverlay').classList.add('open');
}

function updateModalDate(siteId, date) {
  openModal(siteId, date);
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay')) {
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

function filterByDate(date) {
  // 날짜 필터링 - 선택한 날짜의 스크린샷으로 카드 업데이트
  const imgs = document.querySelectorAll('.img-wrap img');
  // Re-render would need full page reload in static setup
  // For now, just scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>
</body>
</html>`;

fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync(path.join('docs', 'index.html'), html);
console.log('✅ Dashboard generated: docs/index.html');
