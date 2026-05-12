# 🖥️ Samsung Web Monitor

삼성 웹사이트 자동 스크린샷 & 변경 모니터링 도구
팀 내부용 | GitHub Actions + GitHub Pages 기반

## 📁 구조
```
samsung-monitor/
├── .github/workflows/capture.yml   # 자동 실행 설정
├── scripts/
│   ├── capture.js                  # 스크린샷 캡처
│   └── generate-dashboard.js       # 대시보드 생성
├── docs/                           # GitHub Pages 배포 폴더
├── urls.json                       # ⭐ URL 목록 관리
└── package.json
```

## 🚀 설치 방법 (처음 한 번만)

### 1. GitHub 저장소 생성
- GitHub.com → `+` → `New repository`
- 이름: `samsung-monitor`, **Private** 선택

### 2. 파일 업로드
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/[내아이디]/samsung-monitor.git
git push -u origin main
```

### 3. GitHub Pages 설정
- 저장소 → Settings → Pages
- Source: `gh-pages` branch 선택 → Save

### 4. Actions 권한 설정
- 저장소 → Settings → Actions → General
- Workflow permissions → **Read and write permissions** 선택 → Save

### 5. 첫 번째 테스트 실행
- 저장소 → Actions → `Daily Screenshot Capture` → `Run workflow`

## 🌐 팀 공유 URL
```
https://[내아이디].github.io/samsung-monitor/
```

## ➕ URL 추가/삭제
`urls.json` 파일만 수정:
```json
{
  "sites": [
    {
      "name": "표시될 이름",
      "url": "https://모니터링할URL",
      "id": "unique-id-영문만"
    }
  ]
}
```

## ✅ 기능
| 기능 | 설명 |
|------|------|
| 자동 캡처 | 매일 정해진 시간 자동 실행 |
| 전체/상단 캡처 | 상단 뷰 + 전체 페이지 2종 저장 |
| 날짜별 비교 | 오늘 vs 어제 나란히 비교 |
| 팀 공유 | URL 하나로 팀원 전체 접근 |
| 완전 무료 | GitHub Free 플랜으로 운영 가능 |
