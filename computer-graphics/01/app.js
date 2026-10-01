const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');

const scale = canvas.width / GRID_WIDTH; // логический пиксель -> пиксели экрана

const stepsBody = document.querySelector('#stepsBody');

function putPixel(x, y, color = 'black') {
  ctx.fillStyle = color;
  ctx.fillRect(x * scale, y * scale, scale, scale);
}

function drawGrid() {
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;

  for (let x = 0; x <= GRID_WIDTH; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * scale, 0);
    ctx.lineTo(x * scale, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= GRID_HEIGHT; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * scale);
    ctx.lineTo(canvas.width, y * scale);
    ctx.stroke();
  }
}


function lineDDA(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  const log = [];

  if (steps === 0) {
    putPixel(x1, y1);
    log.push({
      step: 0,
      xRaw: x1,
      yRaw: y1,
      px: x1,
      py: y1,
    });
    return log;
  }

  const xStep = dx / steps;
  const yStep = dy / steps;

  let x = x1;
  let y = y1;

  for (let i = 0; i <= steps; i += 1) {
    const px = Math.round(x);
    const py = Math.round(y);

    putPixel(px, py);

    log.push({
      step: i,
      xRaw: x,
      yRaw: y,
      px,
      py,
    });

    x += xStep;
    y += yStep;
  }

  return log;
}

function renderStepsTable(log) {
  stepsBody.innerHTML = '';

  for (const row of log) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.step}</td>
      <td>${row.xRaw.toFixed(2)}</td>
      <td>${row.yRaw.toFixed(2)}</td>
      <td>${row.px}</td>
      <td>${row.py}</td>
    `;
    stepsBody.appendChild(tr);
  }
}

function build() {
  const x1 = Number(document.querySelector('#x1').value);
  const y1 = Number(document.querySelector('#y1').value);
  const x2 = Number(document.querySelector('#x2').value);
  const y2 = Number(document.querySelector('#y2').value);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  const log = lineDDA(x1, y1, x2, y2);
  renderStepsTable(log);
}

document.querySelector('#build').addEventListener('click', build);

build();
