const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
const scale = canvas.width / GRID_WIDTH;

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


function ddaPixels(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  const pixels = [];
  const log = [];

  if (steps === 0) {
    pixels.push({ x: x1, y: y1 });
    log.push({ step: 0, xRaw: x1, yRaw: y1, px: x1, py: y1 });
    return { pixels, log };
  }

  const xStep = dx / steps;
  const yStep = dy / steps;

  let x = x1;
  let y = y1;

  for (let i = 0; i <= steps; i += 1) {
    const px = Math.round(x);
    const py = Math.round(y);

    pixels.push({ x: px, y: py });
    log.push({ step: i, xRaw: x, yRaw: y, px, py });

    x += xStep;
    y += yStep;
  }

  return { pixels, log };
}


function lineDDA(x1, y1, x2, y2) {
  const { pixels } = ddaPixels(x1, y1, x2, y2);
  for (const p of pixels) putPixel(p.x, p.y);
}

// ---------- Брезенхем ----------
function bresenhamPixels(x1, y1, x2, y2) {
  let x = x1;
  let y = y1;

  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);

  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;

  let error = dx - dy;

  const pixels = [];
  const log = [];
  let step = 0;

  while (true) {
    pixels.push({ x, y });

    const errorBefore = error;
    const error2 = 2 * error;
    let changedX = false;
    let changedY = false;

    const isLast = x === x2 && y === y2;

    if (!isLast) {
      if (error2 > -dy) {
        error -= dy;
        x += sx;
        changedX = true;
      }
      if (error2 < dx) {
        error += dx;
        y += sy;
        changedY = true;
      }
    }

    log.push({
      step,
      x: pixels[pixels.length - 1].x,
      y: pixels[pixels.length - 1].y,
      error: errorBefore,
      error2,
      changedX,
      changedY,
    });

    if (isLast) break;
    step += 1;
  }

  return { pixels, log };
}

function lineBresenham(x1, y1, x2, y2) {
  const { pixels } = bresenhamPixels(x1, y1, x2, y2);
  for (const p of pixels) putPixel(p.x, p.y);
}

// ---------- Отрисовка по форме ----------
function getInputs() {
  return {
    x1: Number(document.querySelector('#x1').value),
    y1: Number(document.querySelector('#y1').value),
    x2: Number(document.querySelector('#x2').value),
    y2: Number(document.querySelector('#y2').value),
  };
}

function renderPixelList(pixels) {
  const el = document.querySelector('#pixelList');
  el.textContent = pixels.map((p) => `(${p.x}, ${p.y})`).join('\n');
}

function renderBresenhamTable(x1, y1, x2, y2) {
  let x = x1;
  let y = y1;

  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;

  let error = dx - dy;
  const body = document.querySelector('#bresenhamBody');
  body.innerHTML = '';

  let step = 0;

  while (true) {
    const errorBefore = error;
    const error2 = 2 * error;
    const isLast = x === x2 && y === y2;

    let changedX = false;
    let changedY = false;

    if (!isLast) {
      if (error2 > -dy) {
        error -= dy;
        x += sx;
        changedX = true;
      }
      if (error2 < dx) {
        error += dx;
        y += sy;
        changedY = true;
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${step}</td><td>${changedX ? x - sx : x}</td><td>${changedY ? y - sy : y}</td>
      <td>${errorBefore}</td><td>${error2}</td>
      <td>${changedX ? 'да' : 'нет'}</td><td>${changedY ? 'да' : 'нет'}</td>
    `;
    body.appendChild(tr);

    if (isLast) break;
    step += 1;
  }
}

function build() {
  const { x1, y1, x2, y2 } = getInputs();
  const algorithm = document.querySelector('#algorithm').value;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  const result = algorithm === 'dda'
    ? ddaPixels(x1, y1, x2, y2)
    : bresenhamPixels(x1, y1, x2, y2);

  for (const p of result.pixels) putPixel(p.x, p.y);

  renderPixelList(result.pixels);
  renderBresenhamTable(x1, y1, x2, y2);
}

document.querySelector('#build').addEventListener('click', build);

const COMPARE_SEGMENTS = [
  { label: 'горизонтальный', x1: 2, y1: 5, x2: 20, y2: 5 },
  { label: 'вертикальный', x1: 7, y1: 2, x2: 7, y2: 20 },
  { label: 'пологий', x1: 2, y1: 2, x2: 25, y2: 8 },
  { label: 'крутой', x1: 3, y1: 2, x2: 7, y2: 25 },
  { label: 'обратное направление', x1: 20, y1: 8, x2: 2, y2: 3 },
];

function pixelsKey(p) {
  return `${p.x},${p.y}`;
}

function compareAlgorithms() {
  const body = document.querySelector('#compareBody');
  body.innerHTML = '';

  for (const seg of COMPARE_SEGMENTS) {
    const dda = ddaPixels(seg.x1, seg.y1, seg.x2, seg.y2).pixels;
    const bres = bresenhamPixels(seg.x1, seg.y1, seg.x2, seg.y2).pixels;

    const ddaSet = new Set(dda.map(pixelsKey));
    const bresSet = new Set(bres.map(pixelsKey));

    const diff = [];
    for (const key of ddaSet) if (!bresSet.has(key)) diff.push(key);
    for (const key of bresSet) if (!ddaSet.has(key)) diff.push(key);

    const matched = diff.length === 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>(${seg.x1},${seg.y1}) → (${seg.x2},${seg.y2})</td>
      <td>${seg.label}</td>
      <td>${dda.length}</td>
      <td>${bres.length}</td>
      <td>${matched ? 'да' : 'нет'}</td>
      <td>${matched ? '—' : diff.join('; ')}</td>
    `;
    body.appendChild(tr);
  }
}

document.querySelector('#compare').addEventListener('click', compareAlgorithms);

function randomSegment() {
  return {
    x1: Math.floor(Math.random() * GRID_WIDTH),
    y1: Math.floor(Math.random() * GRID_HEIGHT),
    x2: Math.floor(Math.random() * GRID_WIDTH),
    y2: Math.floor(Math.random() * GRID_HEIGHT),
  };
}

function runExperiment() {
  const count = Number(document.querySelector('#experimentCount').value);
  const runs = Number(document.querySelector('#experimentRuns').value);

  const segments = [];
  for (let i = 0; i < count; i += 1) segments.push(randomSegment());

  const ddaTimes = [];
  const bresTimes = [];

  for (let r = 0; r < runs; r += 1) {
    const startDda = performance.now();
    for (const s of segments) ddaPixels(s.x1, s.y1, s.x2, s.y2);
    ddaTimes.push(performance.now() - startDda);

    const startBres = performance.now();
    for (const s of segments) bresenhamPixels(s.x1, s.y1, s.x2, s.y2);
    bresTimes.push(performance.now() - startBres);
  }

  const average = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const result = document.querySelector('#experimentResult');
  result.textContent =
    `Отрезков за прогон: ${count}, прогонов: ${runs}\n\n` +
    `ЦДА:       ${ddaTimes.map((t) => t.toFixed(2)).join(', ')} мс  (среднее ${average(ddaTimes).toFixed(2)} мс)\n` +
    `Брезенхем: ${bresTimes.map((t) => t.toFixed(2)).join(', ')} мс  (среднее ${average(bresTimes).toFixed(2)} мс)`;
}

document.querySelector('#runExperiment').addEventListener('click', runExperiment);

build();
