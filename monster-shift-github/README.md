# MONSTER SHIFT — GitHub & Server Deploy Guide

이 폴더(`monster-shift-github`)를 그대로 GitHub 저장소에 올리면 **웹 배포 + 실시간 멀티플레이어 서버 + CrazyGames 호환**까지 바로 동작합니다!

---

## 방법 1: GitHub Pages로 1분 만에 무료 게임 사이트 열기 (가장 쉬움!)
1. GitHub에서 새 저장소(Repository)를 생성합니다. (예: `monster-shift`)
2. 이 폴더 안의 **모든 파일과 폴더** (`index.html`, `styles.css`, `.nojekyll`, `vendor/`, `src/`, `server.js`, `package.json`)를 저장소에 업로드(Push)합니다.
3. 저장소 상단 **Settings → Pages**로 이동합니다.
4. **Build and deployment → Source**를 `Deploy from a branch`, Branch를 `main` / `/ (root)`로 선택하고 **Save**를 누릅니다.
5. 약 1분 뒤 `https://<내-깃허브-아이디>.github.io/<저장소이름>/` 주소로 접속하면 모바일/PC 어디서나 즉시 플레이 가능합니다!

---

## 방법 2: 전 세계 실시간 멀티플레이어 WebSocket 서버까지 함께 배포 (Render 무료 플랜)
GitHub Pages는 정적 파일 호스팅이므로, **다른 기기끼리 실시간 `/ws` 방 멀티플레이**까지 쓰고 싶다면:
1. 위 방법 1처럼 이 폴더를 GitHub 저장소에 올립니다.
2. [Render.com](https://render.com)에서 **New + → Web Service**를 클릭하고 방금 만든 GitHub 저장소를 선택합니다.
3. 아래 설정을 확인하고 **Deploy**를 누릅니다:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. 배포가 끝나면 발급된 `https://<서비스명>.onrender.com` 주소에서 **웹 게임 + 실시간 멀티플레이어(`/ws`)**가 동시에 동작합니다!

---

## 방법 3: CrazyGames 출시 (SDK v3 내장 완료!)
- `index.html`, `styles.css`, `vendor/`, `src/` 4개 항목만 ZIP으로 압축해 CrazyGames Developer Portal에 업로드하면 됩니다.
- `CrazyGames SDK v3` (`loadingStart/Stop`, `gameplayStart/Stop`, `happytime`, `muteAudio` 설정 동기화, `requestAd`)가 이미 통합되어 있습니다.
