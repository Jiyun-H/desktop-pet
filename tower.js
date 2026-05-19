const { ipcRenderer } = require('electron');

const canvas = document.getElementById('tower');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const img = new Image();
img.onload = () => ctx.drawImage(img, 0, 0, 64, 64);
img.src = './tower.png';

canvas.addEventListener('mousedown', (e) => {
  ipcRenderer.send('start-tower-drag', { x: e.clientX, y: e.clientY });
  e.preventDefault();
});

document.addEventListener('mouseup', () => {
  ipcRenderer.send('stop-tower-drag');
});
