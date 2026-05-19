const { ipcRenderer } = require("electron");
const path = require("path");

// ── 설정
let moveMode = "horizontal";
let catName = "";

ipcRenderer.invoke("get-settings").then((s) => {
  moveMode = s.moveMode;
  catName = s.catName || "";
  loadSprites(() => {
    drawSprite("idle");
    stateTimer = 30;
    gameLoop();
    startTaskChecker();
    scheduleGreeting();
  });
});

ipcRenderer.on("move-mode-changed", (_, mode) => {
  moveMode = mode;
});
ipcRenderer.on("settings-changed", (_, s) => {
  moveMode = s.moveMode;
  catName = s.catName || "";
});

const canvas = document.getElementById("cat");
const ctx = canvas.getContext("2d");
const bubble = document.getElementById("bubble");

// ── 스프라이트 로드
const SPRITE_NAMES = ["idle", "idle2", "walk1", "walk2", "walk3", "walk4", "walk5", "walk6", "walk7", "back", "sleep"];
const sprites = {};

function loadSprites(callback) {
  let loadedCount = 0;
  const done = () => { if (++loadedCount === SPRITE_NAMES.length) callback(); };
  for (const name of SPRITE_NAMES) {
    const img = new Image();
    img.onload  = done;
    img.onerror = done;
    img.src = path.join(__dirname, "sprites", `${name}.png`);
    sprites[name] = img;
  }
}

function drawSprite(name, flipH = false) {
  const img = sprites[name];
  if (!img || !img.complete || img.naturalWidth === 0) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (flipH) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
}

// ── 상태 머신
const STATE = {
  IDLE: "idle",
  WALK: "walk",
  SIT: "sit",
  REACT: "react",
  ON_TOWER: "on_tower",
  BACK: "back",
};
let state = STATE.IDLE;
let facing = 1;
let walkTick = 0;
let walkFrame = 0;
let idleTick = 0;
let stateTimer = 0;
let bubbleTimer = null;
let pos = { x: 0, y: 0 };
let targetX = 0;
let targetY = 0;
const walkSpeed = 1.5;

// 캣타워 골골송
const PURR_MESSAGES = [
  "골골골골~",
  "냐~암~",
  "꾹꾹꾹~",
  "골골골♪",
  "여기가 제일 좋냥 😸",
  "따뜻하다냥~",
  "냐암냐암~",
  "꾹꾹꾙~",
  "...골골...",
  "행복하다냥 🐾",
];
let purrTimer = 0; // 남은 틱 카운트

const MESSAGES = [
  "냥~",
  "밥줘",
  "...",
  "심심해",
  "졸려",
  "하앍",
  "꾹꾹",
  "할퀼거야",
  "생선먹고싶다",
  "냐옹",
  "뿡",
];

function showBubble(text, duration = 2500) {
  bubble.textContent = text;
  bubble.classList.add("show");
  clearTimeout(bubbleTimer);
  if (duration > 0) {
    bubbleTimer = setTimeout(() => bubble.classList.remove("show"), duration);
  }
}

async function getPos() {
  return await ipcRenderer.invoke("get-window-pos");
}

function moveWindow(x, y) {
  ipcRenderer.send("move-window", { x, y });
}

async function pickNewTarget() {
  const info = await getPos();
  if (!info) return;
  pos.x = info.x;
  pos.y = info.y;
  targetX = info.minX + Math.random() * (info.maxX - info.minX - 200);
  targetY =
    moveMode === "diagonal"
      ? info.minY + Math.random() * (info.maxY - info.minY - 200)
      : pos.y;
  facing = targetX > pos.x ? 1 : -1;
}

// ── 메인 루프 (setTimeout 기반 10fps — rAF 대비 CPU 유휴 허용)
let loopActive = true;

async function gameLoop() {
  if (!loopActive) return;
  setTimeout(gameLoop, 100); // 10fps, CPU sleep 가능
  stateTimer--;

  if (state === STATE.IDLE) {
    idleTick++;
    drawSprite(Math.floor(idleTick / 8) % 2 === 0 ? "idle" : "idle2");
    if (stateTimer <= 0) {
      idleTick = 0;
      const roll = Math.random();
      if (roll < 0.2) {
        state = STATE.SIT;
        stateTimer = 20 + Math.floor(Math.random() * 30);
      } else if (roll < 0.35) {
        state = STATE.BACK;
        stateTimer = 15 + Math.floor(Math.random() * 20);
      } else if (roll < 0.8) {
        state = STATE.WALK;
        stateTimer = 40 + Math.floor(Math.random() * 60);
        await pickNewTarget();
      } else {
        showBubble(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
        stateTimer = 15;
      }
    }
  } else if (state === STATE.WALK) {
    walkTick++;
    walkFrame = Math.floor(walkTick / 4) % 7;
    // 스프라이트는 왼쪽방향 기준 → 오른쪽으로 갈 때 좌우반전
    drawSprite(`walk${walkFrame + 1}`, facing === 1);

    const info = await getPos();
    if (!info) {
      state = STATE.IDLE;
      stateTimer = 20;
      return;
    }
    pos.x = info.x;
    pos.y = info.y;

    const dx = targetX - pos.x;
    const dy = targetY - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < walkSpeed + 1 || stateTimer <= 0) {
      state = STATE.IDLE;
      stateTimer = 20 + Math.floor(Math.random() * 20);
    } else {
      const newX = Math.max(
        info.minX,
        Math.min(info.maxX - 200, pos.x + (dx / dist) * walkSpeed),
      );
      const newY = Math.max(
        info.minY,
        Math.min(info.maxY - 200, pos.y + (dy / dist) * walkSpeed),
      );
      moveWindow(newX, newY);
    }
  } else if (state === STATE.SIT) {
    drawSprite("sleep");
    if (stateTimer <= 0) {
      state = STATE.IDLE;
      stateTimer = 20;
    }
  } else if (state === STATE.REACT) {
    drawSprite("idle");
    if (stateTimer <= 0) {
      state = STATE.IDLE;
      stateTimer = 20;
    }
  } else if (state === STATE.BACK) {
    drawSprite("back");
    if (stateTimer <= 0) {
      state = STATE.IDLE;
      stateTimer = 20;
    }
  } else if (state === STATE.ON_TOWER) {
    drawSprite("sleep");
    purrTimer--;
    if (purrTimer <= 0) {
      showBubble(
        PURR_MESSAGES[Math.floor(Math.random() * PURR_MESSAGES.length)],
        4000,
      );
      purrTimer = 20 + Math.floor(Math.random() * 30); // 2~5초 랜덤 간격
    }
    if (stateTimer <= 0) {
      state = STATE.IDLE;
      stateTimer = 20;
    }
  }
}

// ── 마우스 이벤트 (드래그 vs 클릭 구분)
let dragStartPos = null;
let isDragging = false;
const DRAG_THRESHOLD = 5;

canvas.addEventListener("mousedown", (e) => {
  dragStartPos = { x: e.clientX, y: e.clientY };
  isDragging = false;
  ipcRenderer.send("start-drag", { x: e.clientX, y: e.clientY });
  document.body.style.cursor = "grabbing";
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!dragStartPos) return;
  if (!isDragging) {
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      isDragging = true;
      state = STATE.REACT; // 들려있는 표정
      stateTimer = 999;
    }
  }
});

document.addEventListener("mouseup", async () => {
  if (!dragStartPos) return;
  ipcRenderer.send("stop-drag");
  document.body.style.cursor = "";

  if (!isDragging) {
    // 클릭으로 처리
    state = STATE.REACT;
    stateTimer = 15;
    showBubble(MESSAGES[Math.floor(Math.random() * MESSAGES.length)], 2000);
  } else {
    // 캣타워 충돌 검사
    const [catInfo, towerInfo] = await Promise.all([
      ipcRenderer.invoke("get-window-pos"),
      ipcRenderer.invoke("get-tower-pos"),
    ]);

    if (towerInfo && catInfo && isOnTower(catInfo, towerInfo)) {
      // 타워 퍼치 위에 스냅 (cat window y = towerY - 188, x = towerX - 68)
      ipcRenderer.send("move-window", {
        x: towerInfo.x - 68,
        y: Math.max(catInfo.minY, towerInfo.y - 188),
      });
      state = STATE.ON_TOWER;
      stateTimer = 15 * 60 * 10; // 15분 (10fps 기준 9000틱)
      purrTimer = 5; // 0.5초 후 첫 골골
      showBubble("골골골~", 3000);
    } else {
      // 드래그 끝 → idle로 복귀
      state = STATE.IDLE;
      stateTimer = 20;
    }
  }

  dragStartPos = null;
  isDragging = false;
});

// 고양이 스프라이트 영역(200x200 창 내 약 68~132, 128~192)이 타워와 겹치는지 확인
function isOnTower(cat, tower) {
  const cl = cat.x + 68,
    cr = cat.x + 132;
  const ct = cat.y + 128,
    cb = cat.y + 192;
  return cl < tower.x + 64 && cr > tower.x && ct < tower.y + 64 && cb > tower.y;
}

document.addEventListener("mouseenter", () => {
  if (state !== STATE.REACT) drawSprite("idle");
});
document.addEventListener("mouseleave", () => {
  if (!isDragging && state !== STATE.REACT) drawSprite("idle");
});

// ── 시간대별 인사 (1~2시간마다)
function getTimeGreetings() {
  const h = new Date().getHours();
  const n = catName ? `${catName}` : "냥";
  if (h >= 0 && h < 5)
    return [`이 시간에 안 자냥?! 😴`, `야식 먹냥? 🌙`, `${n}도 졸려...`];
  if (h >= 5 && h < 9)
    return [`좋은 아침이다냥! ☀️`, `오늘도 화이팅이냥!`, `밥은 먹었냥? 🍳`];
  if (h >= 9 && h < 12)
    return [
      `열심히 하는 중이냥~ 💪`,
      `간식 먹고 싶다냥 🐟`,
      `오전 파이팅이냥!`,
    ];
  if (h >= 12 && h < 14)
    return [`점심 먹었냥? 🍚`, `밥 먹으러 가야하지 않냥?`, `배고프다냥~ 🐱`];
  if (h >= 14 && h < 18)
    return [
      `오후도 파이팅이냥! ✨`,
      `나른하다냥... 😪`,
      `${n} 옆에 있어줄게냥`,
    ];
  if (h >= 18 && h < 21)
    return [
      `퇴근했냥? 수고했다냥~ 🌆`,
      `오늘 하루 어땠냥?`,
      `저녁 뭐 먹냥? 🍜`,
    ];
  return [
    `슬슬 쉬어야 하지 않냥? 🌙`,
    `오늘도 고생했다냥~`,
    `${n}도 잘 준비냥 💤`,
  ];
}

function scheduleGreeting() {
  // 60~120분 사이 랜덤 간격
  const delay = (60 + Math.random() * 60) * 60 * 1000;
  setTimeout(() => {
    const msgs = getTimeGreetings();
    showBubble(msgs[Math.floor(Math.random() * msgs.length)], 5000);
    scheduleGreeting();
  }, delay);
}

// ── 일정 알림
const TWENTY_MIN_MS = 20 * 60 * 1000;

const TASK_NAGS = [
  (name) => `너 ${name} 하고있냥? 딴짓 금지냥!`,
  (name) => `${name} 아직 안 끝났냥? 집중해야냥!`,
  (name) => `지금 ${name} 할 시간이냥! 빨리빨리냥!`,
  (name) => `${name} 잊어버린 거 아니냥? 어서해야냥!`,
  (name) => `냥냥! ${name} 파이팅이냥~ 할 수 있냥!`,
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function checkTasks() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nowMs = Date.now();

  ipcRenderer.invoke("get-tasks").then((tasks) => {
    for (const task of tasks) {
      const isDone = task.doneDate === todayStr();
      const isInRange =
        task.startTime <= currentTime && currentTime <= task.endTime;
      const cooldownOk =
        !task.lastShownAt || nowMs - task.lastShownAt >= TWENTY_MIN_MS;

      if (!isDone && isInRange && cooldownOk) {
        const msg = TASK_NAGS[Math.floor(Math.random() * TASK_NAGS.length)](
          task.name,
        );
        showBubble(msg, 5000);
        ipcRenderer.invoke("mark-task-shown", task.id);
        break; // 한 번에 하나만
      }
    }
  });
}

// 매 분 정각에 체크
function startTaskChecker() {
  const now = new Date();
  const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  setTimeout(() => {
    checkTasks();
    setInterval(checkTasks, 60 * 1000);
  }, msToNextMinute);
}

// 창 숨김/표시에 따라 루프 일시정지
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    loopActive = false;
  } else {
    loopActive = true;
    gameLoop();
  }
});

// ── 자동 업데이트
let updateReady = false;

ipcRenderer.on("update-available", (_, version) => {
  showBubble(`v${version} 업데이트가 있다냥! 클릭해서 받아냥 🐾`, 10000);
  updateReady = false;
  // 10초 후 자동으로 다운로드 시작
  setTimeout(() => ipcRenderer.send("start-update-download"), 10000);
});

ipcRenderer.on("update-downloaded", () => {
  updateReady = true;
  showBubble("다운로드 완료냥! 클릭하면 재시작할게냥 ✨", 0); // 0 = 클릭 전까지 유지
});

canvas.addEventListener("click", () => {
  if (updateReady) ipcRenderer.send("install-update");
});

// 시작은 get-settings 응답 후 loadSprites 콜백에서 처리됨 (상단 참조)
