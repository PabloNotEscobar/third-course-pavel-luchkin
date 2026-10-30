const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;

const SYMMETRY_COLOR = '#e74c3c';
const BASE_COLOR = '#2d7ff9';

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
const scale = canvas.width / GRID_WIDTH;

const cxInput = document.querySelector('#cx');
const cyInput = document.querySelector('#cy');
const rInput = document.querySelector('#r');
const symmetryOn = document.querySelector('#symmetryOn');
const stepInput = document.querySelector('#stepInput');
const messageElement = document.querySelector('#message');
const symmetryInfo = document.querySelector('#symmetryInfo');
const stepsBody = document.querySelector('#stepsBody');

// Текущая построенная окружность: { cx, cy, r, steps } или null
let current = null;


// 1. Пиксели и сетка

function putPixel(x, y, color = 'black') {
  // Пиксели за границами логической области просто не рисуются.
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
    return;
  }

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


// 2. Симметрия

// Восемь точек, получаемых из одной базовой точки (x, y)
// для окружности с центром в начале координат.
function symmetric8(x, y) {
  return [
    [x, y], [y, x],
    [-x, y], [-y, x],
    [x, -y], [y, -x],
    [-x, -y], [-y, -x]
  ];
}

function plot8(cx, cy, x, y, color) {
  for (const [dx, dy] of symmetric8(x, y)) {
    putPixel(cx + dx, cy + dy, color);
  }
}


// 3. Алгоритм средней точки

// Вычисляет базовые точки одной восьмой окружности (центр в начале координат).
// Если передан массив log, в него добавляются строки для таблицы шагов.
function midpointBasePoints(r, log) {
  const points = [];

  let x = 0;
  let y = r;
  let d = 1 - r;

  while (x <= y) {
    points.push({ x, y });

    const dBefore = d;
    const baseY = y;
    let choice;

    if (d < 0) {
      d += 2 * x + 3;
      choice = 'E';
    } else {
      d += 2 * (x - y) + 5;
      y -= 1;
      choice = 'SE';
    }

    if (log) {
      log.push({
        step: log.length,
        x,
        y: baseY,
        dBefore,
        choice,
        dAfter: d
      });
    }

    x += 1;
  }

  return points;
}

function midpointSteps(r) {
  const log = [];
  midpointBasePoints(r, log);
  return log;
}

// Строит окружность на Canvas. Возвращает шаги алгоритма.
function circleMidpoint(cx, cy, r) {
  const steps = midpointSteps(r);

  for (const step of steps) {
    plot8(cx, cy, step.x, step.y);
  }

  return steps;
}


// 4. Способ через формулу y = round(sqrt(r^2 - x^2))

function formulaBasePoints(r) {
  const points = [];

  for (let x = 0; ; x += 1) {
    const y = Math.round(Math.sqrt(r * r - x * x));

    if (x > y) {
      break;
    }

    points.push({ x, y });
  }

  return points;
}

// Множество пикселей окружности с центром в (0, 0) по базовым точкам.
function pixelSet(basePoints) {
  const set = new Set();

  for (const point of basePoints) {
    for (const [dx, dy] of symmetric8(point.x, point.y)) {
      set.add(`${dx},${dy}`);
    }
  }

  return set;
}


// 5. Отображение окружности

function readInteger(input) {
  const raw = input.value.trim();

  if (raw === '') {
    return NaN;
  }

  const value = Number(raw);
  return Number.isInteger(value) ? value : NaN;
}

function showMessage(text, kind = '') {
  messageElement.textContent = text;
  messageElement.className = kind ? `message ${kind}` : 'message';
}

function getSelectedStep() {
  if (!current) {
    return 0;
  }

  const value = Number(stepInput.value);
  const last = current.steps.length - 1;

  if (!Number.isInteger(value) || value < 0) {
    return 0;
  }

  return Math.min(value, last);
}

function showSymmetry() {
  const index = getSelectedStep();
  const step = current.steps[index];
  const { cx, cy } = current;

  plot8(cx, cy, step.x, step.y, SYMMETRY_COLOR);
  putPixel(cx + step.x, cy + step.y, BASE_COLOR);

  const points = symmetric8(step.x, step.y);
  const unique = new Set(points.map(([dx, dy]) => `${dx},${dy}`)).size;
  const text = points
    .map(([dx, dy]) => `(${cx + dx}, ${cy + dy})`)
    .join(' ');

  symmetryInfo.textContent =
    `Шаг ${index}: базовая точка (${step.x}, ${step.y}) синяя, ` +
    `восемь точек красные. Различных точек: ${unique} из 8. ${text}`;

  for (const row of stepsBody.children) {
    row.classList.toggle('selected', Number(row.dataset.step) === index);
  }
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  symmetryInfo.textContent = '';

  for (const row of stepsBody.children) {
    row.classList.remove('selected');
  }

  if (!current) {
    return;
  }

  current.steps = circleMidpoint(current.cx, current.cy, current.r);

  if (symmetryOn.checked) {
    showSymmetry();
  }
}

function renderStepsTable() {
  stepsBody.innerHTML = '';

  if (!current) {
    return;
  }

  for (const step of current.steps) {
    const tr = document.createElement('tr');
    tr.dataset.step = step.step;

    for (const value of [
      step.step, step.x, step.y, step.dBefore, step.choice, step.dAfter
    ]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    }

    tr.addEventListener('click', () => {
      stepInput.value = step.step;
      symmetryOn.checked = true;
      redraw();
    });

    stepsBody.appendChild(tr);
  }
}

function countOutside(cx, cy, steps) {
  const outside = new Set();

  for (const step of steps) {
    for (const [dx, dy] of symmetric8(step.x, step.y)) {
      const x = cx + dx;
      const y = cy + dy;

      if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
        outside.add(`${x},${y}`);
      }
    }
  }

  return outside.size;
}

function build() {
  const cx = readInteger(cxInput);
  const cy = readInteger(cyInput);
  const r = readInteger(rInput);

  if (Number.isNaN(cx) || Number.isNaN(cy) || Number.isNaN(r)) {
    showMessage('Введите целые числа cx, cy и r.', 'error');
    return;
  }

  if (r <= 0) {
    showMessage('Радиус должен быть больше 0.', 'error');
    return;
  }

  current = { cx, cy, r, steps: [] };
  redraw();
  renderStepsTable();

  if (symmetryOn.checked) {
    showSymmetry();
  }

  const outside = countOutside(cx, cy, current.steps);

  if (outside > 0) {
    showMessage(
      `Окружность выходит за границы области ${GRID_WIDTH} x ${GRID_HEIGHT}: ` +
      `не показано пикселей: ${outside}. Остальная часть построена.`,
      'warning'
    );
  } else {
    showMessage(
      `Построено: центр (${cx}, ${cy}), r = ${r}, ` +
      `базовых точек: ${current.steps.length}.`
    );
  }
}

function clearCanvas() {
  current = null;
  stepInput.value = 0;
  symmetryOn.checked = false;
  stepsBody.innerHTML = '';
  showMessage('');
  redraw();
}


// 6. Сравнение с формулой

const COMPARE_RADII = [1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 100, 200];

function compareMethods(r) {
  const mid = midpointBasePoints(r);
  const formula = formulaBasePoints(r);

  const midSet = pixelSet(mid);
  const formulaSet = pixelSet(formula);

  const diff = [];

  for (const key of midSet) {
    if (!formulaSet.has(key)) {
      diff.push(`(${key}) только у средней точки`);
    }
  }

  for (const key of formulaSet) {
    if (!midSet.has(key)) {
      diff.push(`(${key}) только у формулы`);
    }
  }

  return {
    r,
    midBase: mid.length,
    formulaBase: formula.length,
    midPixels: midSet.size,
    formulaPixels: formulaSet.size,
    diff
  };
}

function renderComparison() {
  const body = document.querySelector('#compareBody');
  body.innerHTML = '';

  for (const r of COMPARE_RADII) {
    const result = compareMethods(r);
    const tr = document.createElement('tr');

    const diffText = result.diff.length === 0
      ? '-'
      : `${result.diff.length}: ${result.diff.slice(0, 4).join('; ')}` +
        (result.diff.length > 4 ? '...' : '');

    for (const value of [
      result.r,
      result.midBase,
      result.formulaBase,
      result.midPixels,
      result.formulaPixels,
      result.diff.length === 0 ? 'да' : 'нет',
      diffText
    ]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    }

    body.appendChild(tr);
  }
}

function runTiming() {
  const reps = Number(document.querySelector('#timingReps').value);
  const runs = Number(document.querySelector('#timingRuns').value);
  const output = document.querySelector('#timingResult');

  if (!Number.isInteger(reps) || reps <= 0 || !Number.isInteger(runs) || runs <= 0) {
    output.textContent = 'Повторы и прогоны должны быть положительными целыми числами.';
    return;
  }

  const midTimes = [];
  const formulaTimes = [];

  for (let run = 0; run < runs; run += 1) {
    const midStart = performance.now();
    for (let i = 0; i < reps; i += 1) {
      for (const r of COMPARE_RADII) {
        midpointBasePoints(r);
      }
    }
    midTimes.push(performance.now() - midStart);

    const formulaStart = performance.now();
    for (let i = 0; i < reps; i += 1) {
      for (const r of COMPARE_RADII) {
        formulaBasePoints(r);
      }
    }
    formulaTimes.push(performance.now() - formulaStart);
  }

  const average = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const format = (values) => values.map((t) => t.toFixed(1)).join(', ');

  output.textContent =
    `Серия: радиусы ${COMPARE_RADII.join(', ')}, повторов серии: ${reps}, прогонов: ${runs}\n\n` +
    `Средняя точка: ${format(midTimes)} мс (среднее ${average(midTimes).toFixed(1)} мс)\n` +
    `Формула:       ${format(formulaTimes)} мс (среднее ${average(formulaTimes).toFixed(1)} мс)`;
}


// 7. События

document.querySelector('#build').addEventListener('click', build);
document.querySelector('#clear').addEventListener('click', clearCanvas);
document.querySelector('#compare').addEventListener('click', renderComparison);
document.querySelector('#runTiming').addEventListener('click', runTiming);

for (const button of document.querySelectorAll('.preset')) {
  button.addEventListener('click', () => {
    cxInput.value = button.dataset.cx;
    cyInput.value = button.dataset.cy;
    rInput.value = button.dataset.r;
    build();
  });
}

symmetryOn.addEventListener('change', () => {
  if (current) {
    redraw();
  }
});

stepInput.addEventListener('input', () => {
  if (current && symmetryOn.checked) {
    redraw();
  }
});

redraw();
build();
