const { ipcRenderer } = require('electron');

const taskList     = document.getElementById('task-list');
const nameInput    = document.getElementById('task-name-input');
const startInput   = document.getElementById('task-start-input');
const endInput     = document.getElementById('task-end-input');
const addBtn       = document.getElementById('add-btn');
const closeBtn     = document.getElementById('close-btn');
const catNameInput = document.getElementById('cat-name-input');
const saveNameBtn  = document.getElementById('save-name-btn');

closeBtn.addEventListener('click', () => ipcRenderer.send('close-schedule'));

// ── 이름 저장
saveNameBtn.addEventListener('click', () => {
  ipcRenderer.invoke('save-cat-name', catNameInput.value);
});
catNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') ipcRenderer.invoke('save-cat-name', catNameInput.value);
});

function applySettings(s) {
  if (s.catName) catNameInput.value = s.catName;
}

ipcRenderer.on('settings-changed', (_, s) => applySettings(s));
ipcRenderer.invoke('get-settings').then(applySettings);

// 기본 시간: 현재 시각으로 초기화
function nowTimeStr(offsetMin = 0) {
  const d = new Date(Date.now() + offsetMin * 60000);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
startInput.value = nowTimeStr(0);
endInput.value   = nowTimeStr(60);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeStr() {
  return nowTimeStr(0);
}

function renderTasks(tasks) {
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    taskList.innerHTML = '<div id="empty-msg">오늘 할 일을 추가해봐요 🐾</div>';
    return;
  }

  const today = todayStr();
  const now   = currentTimeStr();
  const sorted = [...tasks].sort((a, b) => a.startTime.localeCompare(b.startTime));

  // 오늘 태스크 / 지연(미완료된 과거) 태스크 분리
  const todayTasks   = sorted.filter(t => !t.createdDate || t.createdDate >= today);
  const expiredTasks = sorted.filter(t => t.createdDate && t.createdDate < today && t.doneDate !== t.createdDate);

  function makeItem(task, expired) {
    const isDone     = !expired && task.doneDate === today;
    const isActive   = !expired && !isDone && task.startTime <= now && now <= task.endTime;
    const isUpcoming = !expired && !isDone && !isActive && task.startTime > now;

    const item = document.createElement('div');
    item.className = 'task-item' + (isDone ? ' done' : '') + (expired ? ' expired' : '');

    let badge = '';
    if (expired)          badge = '<span class="badge badge-expired">미완료</span>';
    else if (isActive)    badge = '<span class="badge badge-active">진행중</span>';
    else if (isUpcoming)  badge = '<span class="badge badge-upcoming">예정</span>';

    item.innerHTML = `
      <div class="task-check">${isDone ? '✓' : ''}</div>
      <div class="task-time">${task.startTime}~${task.endTime}</div>
      <div class="task-name">${task.name}</div>
      ${badge}
      <button class="delete-btn" data-id="${task.id}">×</button>
    `;

    if (!expired) {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        ipcRenderer.invoke('toggle-task-done', task.id, today);
      });
    }
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      ipcRenderer.invoke('delete-task', task.id);
    });

    return item;
  }

  for (const task of todayTasks) taskList.appendChild(makeItem(task, false));

  if (expiredTasks.length > 0) {
    const sep = document.createElement('div');
    sep.className = 'expired-sep';
    sep.textContent = '⏰ 완료하지 못한 지난 일정';
    taskList.appendChild(sep);
    for (const task of expiredTasks) taskList.appendChild(makeItem(task, true));
  }
}

function addTask() {
  const name      = nameInput.value.trim();
  const startTime = startInput.value;
  const endTime   = endInput.value;
  if (!name || !startTime || !endTime) return;
  if (startTime >= endTime) {
    alert('종료 시간은 시작 시간보다 늦어야 해요!');
    return;
  }
  ipcRenderer.invoke('add-task', { name, startTime, endTime });
  nameInput.value  = '';
  startInput.value = nowTimeStr(0);
  endInput.value   = nowTimeStr(60);
  nameInput.focus();
}

addBtn.addEventListener('click', addTask);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) addTask(); });

ipcRenderer.on('tasks-updated', (_, tasks) => renderTasks(tasks));
ipcRenderer.invoke('get-tasks').then(renderTasks);
