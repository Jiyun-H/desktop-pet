# Desktop Pet 🐱

macOS 화면 위를 자유롭게 돌아다니는 픽셀아트 고양이 데스크탑 펫입니다.  
Electron 기반으로 제작되었으며, 투명 창 위에서 스프라이트 애니메이션으로 동작합니다.

## 기능

- **자유로운 이동** — 화면을 가로 또는 대각선으로 랜덤하게 걷고, 멈추고, 뒤돌아봄
- **애니메이션** — 걷기(7프레임), 아이들(2프레임 교차), 자기, 뒤돌아보기
- **좌우 방향 전환** — 이동 방향에 따라 스프라이트를 자동으로 좌우반전
- **드래그 이동** — 마우스로 집어서 화면 어디든 옮길 수 있음
- **캣타워** — 별도 창으로 표시되는 캣타워 위에 올려놓으면 골골송 출력
- **말풍선** — 시간대별 인사, 랜덤 메시지, 할 일 알림을 말풍선으로 표시
- **할 일 알림** — 등록한 일정 시간대에 주기적으로 잔소리
- **트레이 메뉴** — 메뉴바 아이콘으로 이동 방식 변경, 캣타워 토글, 종료

## 스프라이트 구성

```
sprites/
  idle.png    — 기본 대기 (프레임 1)
  idle2.png   — 기본 대기 (프레임 2, idle과 교차 재생)
  walk1~7.png — 걷기 애니메이션 7프레임
  back.png    — 뒤돌아보기
  sleep.png   — 앉기 / 캣타워 위 휴식
```

## 실행 방법

```bash
npm install
npm start
```

## 빌드 (macOS DMG)

```bash
npm run build
```

`dist/` 폴더에 `.dmg` 파일이 생성됩니다.

## 파일 구조

```
├── main.js          # Electron 메인 프로세스 (창 관리, IPC, 트레이)
├── renderer.js      # 펫 렌더러 (상태머신, 애니메이션, 이동 로직)
├── index.html       # 펫 창
├── schedule.html    # 할 일 팝업 UI
├── schedule.js      # 할 일 팝업 로직
├── tower.html       # 캣타워 창
├── tower.js         # 캣타워 드래그 로직
├── sprites/         # 스프라이트 이미지
├── tower.png        # 캣타워 이미지
├── icon.png         # 앱 아이콘
└── tray-icon.png    # 메뉴바 트레이 아이콘
```

## 기술 스택

- [Electron](https://www.electronjs.org/) v28
- HTML5 Canvas (픽셀아트 렌더링)
- electron-builder (macOS 패키징)
