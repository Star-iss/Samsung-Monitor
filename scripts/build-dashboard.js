const fs = require('fs');
const path = require('path');
const config = require('../urls.config.json');

function getDatesForTarget(targetId) {
  const dir = path.join('screenshots', targetId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.png'))
    .map(f => f.replace('.png', ''))
    .sort((a, b) => b.localeCompare(a)); // newest first
}

function buildDashboard() {
  fs.mkdirSync('docs', { recursive: true });

  // Copy screenshots to docs
  for (const target of config.urls) {
    const src = path.join('screenshots', target.id);
    const dest = path.join('docs', 'screenshots', target.id);
    if (fs.existsSync(src)) {
      fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach(file => {
        fs.copyFileSync(path.join(src, file), path.join(dest, file));
      });
    }
  }

  const targetsData = config.urls.map(target => ({
    ...target,
    dates: getDatesForTarget(target.id)
  }));

  const categories = [...new Set(config.urls.map(t => t.category))];

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Samsung Web Monitor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #111118;
      --surface2: #1a1a24;
      --border: #2a2a3a;
      --accent: #1428A0;
      --accent-bright: #3d5afe;
      --accent-glow: rgba(61, 90, 254, 0.15);
      --text: #e8e8f0;
      --text-muted: #6b6b85;
      --success: #00e676;
      --error: #ff5252;
      --mono: 'DM Mono', monospace;
      --sans: 'Syne', sans-serif;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--sans);
      min-height: 100vh;
    }

    /* Header */
    header {
      border-bottom: 1px solid var(--border);
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      position: sticky;
      top: 0;
      background: rgba(10,10,15,0.95);
      backdrop-filter: blur(12px);
      z-index: 100;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: var(--accent-bright);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .header-meta {
      font-family: var(--mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      text-align: right;
    }

    .status-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
      margin-right: 6px;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Layout */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    /* Category tabs */
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0;
    }

    .tab {
      font-family: var(--mono);
      font-size: 0.75rem;
      padding: 8px 16px;
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: all 0.2s;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .tab:hover { color: var(--text); }
    .tab.active {
      color: var(--accent-bright);
      border-bottom-color: var(--accent-bright);
    }

    /* Cards grid */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      transition: border-color 0.2s, transform 0.2s;
    }

    .card:hover {
      border-color: var(--accent-bright);
      transform: translateY(-2px);
    }

    .card-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-label {
      font-size: 0.85rem;
      font-weight: 600;
    }

    .card-category {
      font-family: var(--mono);
      font-size: 0.65rem;
      color: var(--accent-bright);
      background: var(--accent-glow);
      padding: 2px 8px;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }

    .card-url {
      font-family: var(--mono);
      font-size: 0.65rem;
      color: var(--text-muted);
      padding: 6px 1.25rem;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Screenshot viewer */
    .viewer {
      position: relative;
      background: var(--surface2);
    }

    .screenshot-wrap {
      height: 240px;
      overflow: hidden;
      cursor: zoom-in;
      position: relative;
    }

    .screenshot-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      display: block;
      transition: transform 0.3s;
    }

    .screenshot-wrap:hover img { transform: scale(1.02); }

    .no-screenshot {
      height: 240px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
      color: var(--text-muted);
      font-family: var(--mono);
      font-size: 0.75rem;
    }

    .no-screenshot .icon { font-size: 2rem; opacity: 0.3; }

    /* Date selector */
    .date-controls {
      padding: 0.75rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 8px;
      border-top: 1px solid var(--border);
      flex-wrap: wrap;
    }

    .date-label {
      font-family: var(--mono);
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-right: 4px;
    }

    .date-btn {
      font-family: var(--mono);
      font-size: 0.7rem;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
    }

    .date-btn:hover { border-color: var(--accent-bright); color: var(--text); }
    .date-btn.active {
      background: var(--accent-glow);
      border-color: var(--accent-bright);
      color: var(--accent-bright);
    }

    /* Full screen modal */
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.92);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .modal.open { display: flex; }

    .modal-content {
      max-width: 90vw;
      max-height: 90vh;
      position: relative;
    }

    .modal-content img {
      max-width: 100%;
      max-height: 85vh;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .modal-close {
      position: absolute;
      top: -40px;
      right: 0;
      background: none;
      border: none;
      color: var(--text);
      font-size: 1.5rem;
      cursor: pointer;
      font-family: var(--mono);
    }

    .modal-meta {
      margin-top: 12px;
      font-family: var(--mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      text-align: center;
    }

    /* Stats bar */
    .stats {
      display: flex;
      gap: 2rem;
      margin-bottom: 2rem;
      padding: 1rem 1.5rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--accent-bright);
    }

    .stat-label {
      font-family: var(--mono);
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .hidden { display: none !important; }
  </style>
</head>
<body>

<header>
  <div class="logo">
    <div class="logo-icon">📸</div>
    Samsung Web Monitor
  </div>
  <div class="header-meta">
    <span class="status-dot"></span>AUTO CAPTURING DAILY<br>
    Last updated: <span id="last-updated">—</span>
  </div>
</header>

<div class="container">
  <div class="stats">
    <div class="stat">
      <span class="stat-value">${targetsData.length}</span>
      <span class="stat-label">Tracked Pages</span>
    </div>
    <div class="stat">
      <span class="stat-value">${Math.max(...targetsData.map(t => t.dates.length), 0)}</span>
      <span class="stat-label">Days of History</span>
    </div>
    <div class="stat">
      <span class="stat-value">${categories.length}</span>
      <span class="stat-label">Categories</span>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="filterCategory('all', this)">All</button>
    ${categories.map(c => `<button class="tab" onclick="filterCategory('${c}', this)">${c}</button>`).join('')}
  </div>

  <div class="cards" id="cards-container">
    ${targetsData.map(target => `
    <div class="card" data-category="${target.category}" data-id="${target.id}">
      <div class="card-header">
        <span class="card-label">${target.label}</span>
        <span class="card-category">${target.category}</span>
      </div>
      <div class="card-url">${target.url}</div>
      <div class="viewer">
        ${target.dates.length > 0 ? `
        <div class="screenshot-wrap" onclick="openModal('screenshots/${target.id}/${target.dates[0]}.png', '${target.label}', '${target.dates[0]}')">
          <img id="img-${target.id}" src="screenshots/${target.id}/${target.dates[0]}.png" alt="${target.label}" loading="lazy">
        </div>
        ` : `
        <div class="no-screenshot">
          <span class="icon">🕐</span>
          Waiting for first capture...
        </div>
        `}
      </div>
      ${target.dates.length > 1 ? `
      <div class="date-controls">
        <span class="date-label">History</span>
        ${target.dates.slice(0, 7).map((date, i) => `
          <button class="date-btn ${i === 0 ? 'active' : ''}"
            onclick="switchDate('${target.id}', '${date}', this)">
            ${date}
          </button>
        `).join('')}
      </div>
      ` : ''}
    </div>
    `).join('')}
  </div>
</div>

<!-- Modal -->
<div class="modal" id="modal" onclick="closeModal(event)">
  <div class="modal-content">
    <button class="modal-close" onclick="document.getElementById('modal').classList.remove('open')">✕ close</button>
    <img id="modal-img" src="" alt="">
    <div class="modal-meta" id="modal-meta"></div>
  </div>
</div>

<script>
  // Set last updated
  const allDates = ${JSON.stringify(targetsData.flatMap(t => t.dates))};
  if (allDates.length > 0) {
    const latest = allDates.sort((a,b) => b.localeCompare(a))[0];
    document.getElementById('last-updated').textContent = latest;
  }

  function filterCategory(cat, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.card').forEach(card => {
      card.classList.toggle('hidden', cat !== 'all' && card.dataset.category !== cat);
    });
  }

  function switchDate(targetId, date, btn) {
    const img = document.getElementById('img-' + targetId);
    if (img) img.src = 'screenshots/' + targetId + '/' + date + '.png';
    btn.closest('.date-controls').querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  function openModal(src, label, date) {
    document.getElementById('modal-img').src = src;
    document.getElementById('modal-meta').textContent = label + ' · ' + date;
    document.getElementById('modal').classList.add('open');
  }

  function closeModal(e) {
    if (e.target === document.getElementById('modal')) {
      document.getElementById('modal').classList.remove('open');
    }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('modal').classList.remove('open');
  });
</script>
</body>
</html>`;

  fs.writeFileSync('docs/index.html', html);
  console.log('✅ Dashboard built: docs/index.html');
}

buildDashboard();
