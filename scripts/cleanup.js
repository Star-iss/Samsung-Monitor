const fs = require('fs');
const path = require('path');

const KEEP_DAYS = 7;
const screenshotsDir = path.join('docs', 'screenshots');
const metaDir = path.join('docs', 'meta');
const indexPath = path.join(metaDir, 'index.json');

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
const cutoffStr = cutoff.toISOString().split('T')[0];

console.log(`🧹 Cleaning up screenshots older than ${cutoffStr} (${KEEP_DAYS} days)`);

// 인덱스에서 오래된 날짜 제거
if (fs.existsSync(indexPath)) {
  let index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const before = index.length;
  index = index.filter(d => d >= cutoffStr);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`  Index: ${before} → ${index.length} dates`);
}

// 오래된 메타 JSON 삭제
if (fs.existsSync(metaDir)) {
  const metaFiles = fs.readdirSync(metaDir).filter(f => f.endsWith('.json') && f !== 'index.json');
  let deletedMeta = 0;
  for (const file of metaFiles) {
    const dateStr = file.replace('.json', '');
    if (dateStr < cutoffStr) {
      fs.unlinkSync(path.join(metaDir, file));
      deletedMeta++;
    }
  }
  console.log(`  Meta files deleted: ${deletedMeta}`);
}

// 오래된 스크린샷 이미지 삭제
let deletedImgs = 0;
let deletedBytes = 0;

if (fs.existsSync(screenshotsDir)) {
  const siteDirs = fs.readdirSync(screenshotsDir);
  for (const siteId of siteDirs) {
    const siteDir = path.join(screenshotsDir, siteId);
    if (!fs.statSync(siteDir).isDirectory()) continue;

    const files = fs.readdirSync(siteDir);
    for (const file of files) {
      // 파일명 형식: YYYY-MM-DD-xxx.png
      const match = file.match(/^(\d{4}-\d{2}-\d{2})-/);
      if (match && match[1] < cutoffStr) {
        const filePath = path.join(siteDir, file);
        const size = fs.statSync(filePath).size;
        fs.unlinkSync(filePath);
        deletedImgs++;
        deletedBytes += size;
      }
    }
  }
}

const deletedMB = (deletedBytes / 1024 / 1024).toFixed(1);
console.log(`  Screenshots deleted: ${deletedImgs} files (${deletedMB} MB freed)`);
console.log('✅ Cleanup complete');
