const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 32, H = 32;

// ── 색 팔레트 3종
const PALETTES = {
  cheese: {              // 치즈태비 (주황)
    '.': null,
    'D': '#B85A10', 'O': '#E8883A', 'o': '#F5AC6E', 'l': '#FAC896',
    'B': '#1E1E2E', 'W': '#FFFEF0', 'P': '#FF9EAA',
  },
  mackerel: {            // 고등어 (회색)
    '.': null,
    'D': '#4A4A4A', 'O': '#808080', 'o': '#B0B0B0', 'l': '#D0D0D0',
    'B': '#1E1E2E', 'W': '#FFFEF0', 'P': '#FF9EAA',
  },
  black: {               // 깜냥이 (검정)
    '.': null,
    'D': '#111118', 'O': '#1E1E2E', 'o': '#2E2E42', 'l': '#3E3E58',
    'B': '#FFD700', 'W': '#FFD700', 'P': '#FF6B8A',  // 금색 눈
  },
};

function makeGrid() {
  return Array.from({ length: H }, () => Array(W).fill('.'));
}
function set(g, r, c, col) {
  if (r >= 0 && r < H && c >= 0 && c < W) g[r][c] = col;
}
function hline(g, r, c1, c2, col) {
  for (let c = c1; c <= c2; c++) set(g, r, c, col);
}
function rect(g, r1, c1, r2, c2, col) {
  for (let r = r1; r <= r2; r++) hline(g, r, c1, c2, col);
}
function ellipse(g, cr, cc, rx, ry, col) {
  for (let r = cr - ry; r <= cr + ry; r++)
    for (let c = cc - rx; c <= cc + rx; c++)
      if (((r - cr) / ry) ** 2 + ((c - cc) / rx) ** 2 <= 1)
        set(g, r, c, col);
}

function drawCat(opts = {}) {
  const g = makeGrid();
  const { eyeExpr = 'normal', legPose = 'stand', tail = 'up' } = opts;

  // 귀
  const earColor = [['D','D','.','.'],['D','O','D','.'],['D','O','P','D'],['D','O','P','D']];
  for (let dr = 0; dr < 4; dr++) {
    for (let dc = 0; dc < 4; dc++) {
      if (earColor[dr][dc] !== '.') { set(g, 2+dr, 7+dc, earColor[dr][dc]); set(g, 2+dr, 19+(3-dc), earColor[dr][3-dc]); }
    }
  }

  // 머리
  ellipse(g, 11, 15, 8, 7, 'D');
  ellipse(g, 11, 15, 7, 6, 'O');
  ellipse(g, 11, 15, 5, 5, 'o');
  hline(g, 5, 8, 22, 'O');

  // 눈
  if (eyeExpr === 'normal') {
    rect(g, 8, 10, 10, 12, 'W'); rect(g, 8, 18, 10, 20, 'W');
    rect(g, 9, 11, 10, 11, 'B'); rect(g, 9, 19, 10, 19, 'B');
    hline(g, 8, 10, 12, 'D'); hline(g, 10, 10, 12, 'D'); set(g, 9, 10, 'D'); set(g, 9, 12, 'D');
    hline(g, 8, 18, 20, 'D'); hline(g, 10, 18, 20, 'D'); set(g, 9, 18, 'D'); set(g, 9, 20, 'D');
  } else if (eyeExpr === 'happy') {
    set(g, 10, 10, 'D'); set(g, 9, 11, 'D'); set(g, 10, 12, 'D');
    set(g, 10, 18, 'D'); set(g, 9, 19, 'D'); set(g, 10, 20, 'D');
  } else if (eyeExpr === 'sleepy') {
    hline(g, 10, 10, 12, 'D'); hline(g, 10, 18, 20, 'D');
  }

  // 코·수염
  set(g, 13, 14, 'P'); set(g, 13, 15, 'P'); set(g, 13, 16, 'P'); set(g, 14, 15, 'D');
  set(g, 13, 8, 'D'); set(g, 13, 9, 'D'); set(g, 13, 21, 'D'); set(g, 13, 22, 'D');

  // 몸통
  const bodyTop = legPose === 'sit' ? 17 : 16;
  const bodyBot = legPose === 'sit' ? 24 : 22;
  const bmid = (bodyTop + bodyBot) / 2, bry = (bodyBot - bodyTop) / 2;
  ellipse(g, bmid, 15, 8, bry + 1, 'D');
  ellipse(g, bmid, 15, 7, bry,     'O');
  ellipse(g, bmid, 15, 5, bry - 1, 'o');

  // 꼬리
  if (tail === 'up') {
    vline(g, 14, 22, 23, 'D'); vline(g, 14, 21, 23, 'O');
    set(g, 13, 23, 'D'); set(g, 12, 23, 'D'); set(g, 12, 24, 'D');
    set(g, 13, 22, 'O'); set(g, 12, 22, 'O'); set(g, 11, 23, 'O');
  } else {
    hline(g, 23, 22, 26, 'D'); hline(g, 23, 23, 25, 'O');
    set(g, 22, 26, 'D'); set(g, 21, 26, 'D'); set(g, 22, 25, 'O'); set(g, 21, 25, 'O');
  }

  // 다리
  if (legPose === 'stand') {
    rect(g, 22, 9, 26, 10, 'O'); hline(g, 22, 9, 10, 'D');
    rect(g, 22, 12, 26, 13, 'O'); hline(g, 22, 12, 13, 'D');
    rect(g, 22, 18, 26, 19, 'O'); hline(g, 22, 18, 19, 'D');
    rect(g, 22, 21, 26, 22, 'O'); hline(g, 22, 21, 22, 'D');
    [[27,9],[27,12],[27,19],[27,22]].forEach(([r,c]) => { ellipse(g,r,c,2,1,'D'); ellipse(g,r,c,1,1,'O'); });
  } else if (legPose === 'walk1') {
    rect(g, 21, 8, 26, 10, 'O'); hline(g, 21, 8, 10, 'D');
    rect(g, 22, 12, 26, 13, 'O'); hline(g, 22, 12, 13, 'D');
    rect(g, 23, 18, 26, 20, 'O'); hline(g, 23, 18, 20, 'D');
    rect(g, 21, 21, 25, 22, 'O'); hline(g, 21, 21, 22, 'D');
    [[27,9],[27,12],[27,19],[26,21]].forEach(([r,c]) => { ellipse(g,r,c,2,1,'D'); ellipse(g,r,c,1,1,'O'); });
  } else if (legPose === 'walk2') {
    rect(g, 23, 8, 26, 10, 'O'); hline(g, 23, 8, 10, 'D');
    rect(g, 21, 12, 25, 13, 'O'); hline(g, 21, 12, 13, 'D');
    rect(g, 21, 18, 25, 20, 'O'); hline(g, 21, 18, 20, 'D');
    rect(g, 23, 21, 26, 22, 'O'); hline(g, 23, 21, 22, 'D');
    [[27,9],[26,12],[26,19],[27,22]].forEach(([r,c]) => { ellipse(g,r,c,2,1,'D'); ellipse(g,r,c,1,1,'O'); });
  } else if (legPose === 'sit') {
    rect(g, 25, 9, 28, 11, 'D'); rect(g, 25, 10, 28, 10, 'O');
    rect(g, 25, 19, 28, 21, 'D'); rect(g, 25, 20, 28, 20, 'O');
    [[29,10],[29,20]].forEach(([r,c]) => { ellipse(g,r,c,2,1,'D'); ellipse(g,r,c,1,1,'O'); });
  }

  return g;
}

function vline(g, r1, r2, c, col) {
  for (let r = r1; r <= r2; r++) set(g, r, c, col);
}

function saveSprite(grid, palette, name, outDir) {
  const C = PALETTES[palette];
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const color = C[grid[r][c]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(c, r, 1, 1);
    }
  fs.writeFileSync(path.join(outDir, `${name}.png`), canvas.toBuffer('image/png'));
}

const FRAMES = [
  { name: 'idle',  opts: { eyeExpr: 'normal', legPose: 'stand', tail: 'up' } },
  { name: 'walk1', opts: { eyeExpr: 'normal', legPose: 'walk1', tail: 'up' } },
  { name: 'walk2', opts: { eyeExpr: 'normal', legPose: 'walk2', tail: 'up' } },
  { name: 'sit',   opts: { eyeExpr: 'sleepy', legPose: 'sit',   tail: 'curl' } },
  { name: 'happy', opts: { eyeExpr: 'happy',  legPose: 'walk1', tail: 'up' } },
];

for (const palette of Object.keys(PALETTES)) {
  const dir = path.join(__dirname, 'sprites', palette);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  for (const { name, opts } of FRAMES) {
    saveSprite(drawCat(opts), palette, name, dir);
  }
  console.log(`생성됨: sprites/${palette}/`);
}
console.log('\n완료!');
