const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let petWindow;
let scheduleWindow;
let towerWindow;
let tray;

// ── 설정 로드/저장
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const TASKS_PATH    = path.join(app.getPath('userData'), 'tasks.json');

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch { return { moveMode: 'horizontal', catName: '', showTower: true }; }
}
function saveSettings(s) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

function loadTasks() {
  try {
    const raw = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
    const today = new Date().toISOString().slice(0, 10);
    return raw.map(t => {
      let r = t;
      // 구형 포맷(time 필드) → 신형(startTime/endTime) 마이그레이션
      if (!r.startTime && r.time) {
        const [h, m] = r.time.split(':').map(Number);
        const endH = String(Math.min(h + 1, 23)).padStart(2, '0');
        r = { ...r, startTime: r.time, endTime: `${endH}:${String(m).padStart(2,'0')}`, lastShownAt: null };
      }
      // createdDate 없으면 오늘 날짜로 초기화 (내일부터 만료 대상)
      if (!r.createdDate) r = { ...r, createdDate: today };
      return r;
    });
  } catch { return []; }
}
function saveTasks(tasks) {
  fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2));
}

let settings = loadSettings();
let tasks    = loadTasks();
let nextId   = tasks.length ? Math.max(...tasks.map(t => t.id)) + 1 : 1;

function broadcastTasks() {
  if (petWindow)      petWindow.webContents.send('tasks-updated', tasks);
  if (scheduleWindow) scheduleWindow.webContents.send('tasks-updated', tasks);
}

// ── 펫 창
function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  petWindow = new BrowserWindow({
    width: 200, height: 200,
    x: Math.floor(width / 2),
    y: Math.floor(height - 220),
    transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, hasShadow: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  petWindow.loadFile('index.html');
  petWindow.webContents.on('console-message', (_, level, msg, line) => {
    if (level >= 2) console.error(`[pet] ${msg} (line ${line})`);
  });
  petWindow.on('ready-to-show', () => petWindow.show());
}

// ── 캣타워 창
function createTowerWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const tx = settings.towerX ?? Math.floor(width / 2) + 80;
  const ty = settings.towerY ?? Math.floor(height - 220);
  towerWindow = new BrowserWindow({
    width: 64, height: 64,
    x: tx, y: ty,
    transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, hasShadow: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  towerWindow.loadFile('tower.html');
  towerWindow.on('ready-to-show', () => towerWindow.show());
  towerWindow.on('closed', () => { towerWindow = null; });
}

// ── 스케줄 팝업 창
function createScheduleWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  scheduleWindow = new BrowserWindow({
    width: 300,
    height: 420,
    x: width - 320,
    y: 28,                    // 메뉴바 아래
    transparent: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  scheduleWindow.loadFile('schedule.html');

  // 포커스 잃으면 닫기
  scheduleWindow.on('blur', () => {
    if (scheduleWindow) scheduleWindow.hide();
  });
}

function toggleScheduleWindow() {
  if (!scheduleWindow || scheduleWindow.isDestroyed()) {
    createScheduleWindow();
    return;
  }
  if (scheduleWindow.isVisible()) {
    scheduleWindow.hide();
  } else {
    scheduleWindow.show();
    scheduleWindow.focus();
    scheduleWindow.webContents.send('tasks-updated', tasks);
  }
}

// ── 트레이
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: '📋 일정 편집',
      click: () => toggleScheduleWindow(),
    },
    { type: 'separator' },
    {
      label: '펫 보이기/숨기기',
      click: () => petWindow && (petWindow.isVisible() ? petWindow.hide() : petWindow.show()),
    },
    {
      label: '캣타워',
      type: 'checkbox',
      checked: settings.showTower !== false,
      click: (item) => {
        settings.showTower = item.checked;
        saveSettings(settings);
        if (!towerWindow || towerWindow.isDestroyed()) {
          if (settings.showTower) createTowerWindow();
        } else {
          settings.showTower ? towerWindow.show() : towerWindow.hide();
        }
        tray.setContextMenu(buildTrayMenu());
      },
    },
    {
      label: '이동 방식',
      submenu: [
        {
          label: '가로만', type: 'radio',
          checked: settings.moveMode === 'horizontal',
          click: () => setMoveMode('horizontal'),
        },
        {
          label: '대각선 (전체 화면)', type: 'radio',
          checked: settings.moveMode === 'diagonal',
          click: () => setMoveMode('diagonal'),
        },
      ],
    },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);
}

function setMoveMode(mode) {
  settings.moveMode = mode;
  saveSettings(settings);
  tray.setContextMenu(buildTrayMenu());
  if (petWindow) petWindow.webContents.send('move-mode-changed', mode);
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray-icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  // macOS 메뉴바 아이콘은 16×16 (또는 @2x=32×32)이어야 표시됨
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  } else {
    icon = icon.resize({ width: 16, height: 16 });
  }
  tray = new Tray(icon);
  tray.setToolTip('Desktop Pet');
  tray.setContextMenu(buildTrayMenu());
}

// ── IPC
ipcMain.on('move-window', (_, { x, y }) => {
  if (petWindow) petWindow.setPosition(Math.round(x), Math.round(y));
});

let dragInterval = null;

ipcMain.on('start-drag', (_, offset) => {
  if (dragInterval) clearInterval(dragInterval);
  dragInterval = setInterval(() => {
    if (!petWindow) return;
    const { x: cx, y: cy } = screen.getCursorScreenPoint();
    petWindow.setPosition(Math.round(cx - offset.x), Math.round(cy - offset.y));
  }, 16); // ~60fps
});

ipcMain.on('stop-drag', () => {
  if (dragInterval) { clearInterval(dragInterval); dragInterval = null; }
});

let towerDragInterval = null;

ipcMain.on('start-tower-drag', (_, offset) => {
  if (towerDragInterval) clearInterval(towerDragInterval);
  towerDragInterval = setInterval(() => {
    if (!towerWindow || towerWindow.isDestroyed()) return;
    const { x: cx, y: cy } = screen.getCursorScreenPoint();
    towerWindow.setPosition(Math.round(cx - offset.x), Math.round(cy - offset.y));
  }, 16);
});

ipcMain.on('stop-tower-drag', () => {
  if (towerDragInterval) { clearInterval(towerDragInterval); towerDragInterval = null; }
  // 위치 저장
  if (towerWindow && !towerWindow.isDestroyed()) {
    const [tx, ty] = towerWindow.getPosition();
    settings.towerX = tx;
    settings.towerY = ty;
    saveSettings(settings);
  }
});

ipcMain.handle('get-tower-pos', () => {
  if (!towerWindow || towerWindow.isDestroyed() || !towerWindow.isVisible()) return null;
  const [x, y] = towerWindow.getPosition();
  return { x, y };
});

ipcMain.handle('get-window-pos', () => {
  if (!petWindow) return null;
  const [x, y] = petWindow.getPosition();

  // 연결된 모든 모니터의 전체 작업 영역 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of screen.getAllDisplays()) {
    minX = Math.min(minX, d.workArea.x);
    minY = Math.min(minY, d.workArea.y);
    maxX = Math.max(maxX, d.workArea.x + d.workArea.width);
    maxY = Math.max(maxY, d.workArea.y + d.workArea.height);
  }
  return { x, y, minX, minY, maxX, maxY };
});

ipcMain.handle('get-settings', () => settings);

ipcMain.handle('save-cat-name', (_, name) => {
  settings.catName = name.trim();
  saveSettings(settings);
  if (petWindow) petWindow.webContents.send('settings-changed', settings);
  if (scheduleWindow) scheduleWindow.webContents.send('settings-changed', settings);
});

ipcMain.handle('get-tasks', () => tasks);

ipcMain.on('close-schedule', () => {
  if (scheduleWindow) scheduleWindow.hide();
});

ipcMain.handle('add-task', (_, { name, startTime, endTime }) => {
  const createdDate = new Date().toISOString().slice(0, 10);
  tasks.push({ id: nextId++, name, startTime, endTime, doneDate: null, lastShownAt: null, createdDate });
  saveTasks(tasks);
  broadcastTasks();
});

ipcMain.handle('delete-task', (_, id) => {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);
  broadcastTasks();
});

ipcMain.handle('toggle-task-done', (_, id, todayStr) => {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.doneDate = task.doneDate === todayStr ? null : todayStr;
  saveTasks(tasks);
  broadcastTasks();
});

// 말풍선 표시 후 timestamp 업데이트
ipcMain.handle('mark-task-shown', (_, id) => {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.lastShownAt = Date.now();
    saveTasks(tasks);
  }
});

// ── 앱 시작
app.whenReady().then(() => {
  createPetWindow();
  createTray();
  if (settings.showTower !== false) createTowerWindow();
});

app.on('window-all-closed', (e) => e.preventDefault());
