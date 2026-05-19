const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 64, H = 64;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, W, H);

const PL = '#E8C98A';  // platform highlight
const PM = '#C8963C';  // platform body
const PD = '#7A5A1A';  // platform shadow
const RL = '#F5C07A';  // rope light
const RM = '#E8883A';  // rope medium
const RD = '#A85C18';  // rope shadow

function rect(x, y, w, h, c) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

function platform(x1, w, y, h) {
  rect(x1 + 1, y, w - 2, 1, PL);         // top highlight
  rect(x1 + 1, y + 1, w - 2, h - 2, PM); // body
  rect(x1 + 1, y + h - 1, w - 2, 1, PD); // bottom shadow
  rect(x1, y, 1, h, PD);                  // left edge
  rect(x1 + w - 1, y, 1, h, PD);          // right edge
}

function post(x1, w, y1, h) {
  for (let y = y1; y < y1 + h; y++) {
    const s = Math.floor((y - y1) / 3) % 2;
    const base = s === 0 ? RM : RL;
    rect(x1 + 1, y, w - 2, 1, base);
    rect(x1, y, 1, 1, RD);
    rect(x1 + w - 1, y, 1, 1, RD);
  }
}

// Base platform (y=52~63, x=4~59)
platform(4, 56, 52, 12);
// Lower post (y=38~51, x=27~36)
post(27, 10, 38, 14);
// Middle platform (y=30~37, x=18~45)
platform(18, 28, 30, 8);
// Upper post (y=12~29, x=27~36)
post(27, 10, 12, 18);
// Top perch — cat sits here (y=4~11, x=12~51)
platform(12, 40, 4, 8);

const outPath = path.join(__dirname, 'tower.png');
fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
console.log('tower.png 생성 완료!');
