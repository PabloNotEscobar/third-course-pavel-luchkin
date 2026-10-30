const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;

// Четыре бита кода области
const INSIDE = 0; // 0000
const LEFT = 1;   // 0001
const RIGHT = 2;  // 0010
const BOTTOM = 4; // 0100
const TOP = 8;    // 1000

const MAX_ITERATIONS = 50;

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
const scale = canvas.width / GRID_WIDTH;

const messageElement = document.querySelector('#message');
const codesElement = document.querySelector('#codes');
const tracesElement = document.querySelector('#traces');
const modeSelect = document.querySelector('#mode');


// 1. Коды областей и отсечение

function getCode(x, y, rect) {
  let code = INSIDE;

  if (x < rect.xmin) {
    code |= LEFT;
  } else if (x > rect.xmax) {
    code |= RIGHT;
  }

  if (y < rect.ymin) {
    code |= TOP;
  } else if (y > rect.ymax) {
    code |= BOTTOM;
  }

  return code;
}

function codeToString(code) {
  return code.toString(2).padStart(4, '0');
}

function formatNumber(value) {
  return String(+value.toFixed(3));
}

function formatPoint(x, y) {
  return `(${formatNumber(x)}, ${formatNumber(y)})`;
}

// Алгоритм Коэна-Сазерленда с журналом итераций.
// Возвращает { result, steps, intersections }:
//   result        - новые концы отрезка или null, если отрезок отброшен
//   steps         - строки для таблицы итераций
//   intersections - сколько раз пришлось вычислять пересечение с границей
function clipLineTrace(x1, y1, x2, y2, rect) {
  let code1 = getCode(x1, y1, rect);
  let code2 = getCode(x2, y2, rect);

  const steps = [];
  let intersections = 0;
  let result = null;
  let finished = false;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const step = { step: i, x1, y1, code1, x2, y2, code2, action: '' };
    steps.push(step);

    if ((code1 | code2) === 0) {
      step.action = 'ACCEPT';
      result = { x1, y1, x2, y2 };
      finished = true;
      break;
    }

    if ((code1 & code2) !== 0) {
      step.action = 'REJECT';
      finished = true;
      break;
    }

    const codeOut = code1 !== 0 ? code1 : code2;

    let x;
    let y;
    let border;

    if (codeOut & TOP) {
      const t = (rect.ymin - y1) / (y2 - y1);
      x = x1 + t * (x2 - x1);
      y = rect.ymin;
      border = 'TOP';
    } else if (codeOut & BOTTOM) {
      const t = (rect.ymax - y1) / (y2 - y1);
      x = x1 + t * (x2 - x1);
      y = rect.ymax;
      border = 'BOTTOM';
    } else if (codeOut & RIGHT) {
      const t = (rect.xmax - x1) / (x2 - x1);
      x = rect.xmax;
      y = y1 + t * (y2 - y1);
      border = 'RIGHT';
    } else {
      const t = (rect.xmin - x1) / (x2 - x1);
      x = rect.xmin;
      y = y1 + t * (y2 - y1);
      border = 'LEFT';
    }

    let moved;

    if (codeOut === code1) {
      x1 = x;
      y1 = y;
      code1 = getCode(x1, y1, rect);
      moved = 'A';
    } else {
      x2 = x;
      y2 = y;
      code2 = getCode(x2, y2, rect);
      moved = 'B';
    }

    intersections += 1;
    step.action = `пересечение ${border}, ${moved} переносится в ${formatPoint(x, y)}`;
  }

  if (!finished) {
    // Защита от бесконечного цикла. При корректных данных не срабатывает.
    steps.push({
      step: steps.length, x1, y1, code1, x2, y2, code2,
      action: 'СТОП: превышено число итераций'
    });
  }

  return { result, steps, intersections };
}

function clipLine(x1, y1, x2, y2, rect) {
  return clipLineTrace(x1, y1, x2, y2, rect).result;
}

// accept: принят без изменения, clip: отсечён, reject: отброшен
function classify(trace) {
  if (trace.result === null) {
    return 'reject';
  }

  return trace.intersections === 0 ? 'accept' : 'clip';
}


// 2. Чтение формы

function parseNumber(raw) {
  const text = String(raw).trim();

  if (text === '') {
    return NaN;
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}

function showMessage(text, isError = false) {
  messageElement.textContent = text;
  messageElement.className = isError ? 'message error' : 'message';
}

function readRect() {
  const rect = {
    xmin: parseNumber(document.querySelector('#xmin').value),
    ymin: parseNumber(document.querySelector('#ymin').value),
    xmax: parseNumber(document.querySelector('#xmax').value),
    ymax: parseNumber(document.querySelector('#ymax').value)
  };

  if (Object.values(rect).some(Number.isNaN)) {
    showMessage('Введите числа для всех границ окна.', true);
    return null;
  }

  if (rect.xmin >= rect.xmax) {
    showMessage('Должно выполняться xmin < xmax.', true);
    return null;
  }

  if (rect.ymin >= rect.ymax) {
    showMessage('Должно выполняться ymin < ymax.', true);
    return null;
  }

  return rect;
}

function parsePoints(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const points = [];

  for (let i = 0; i < lines.length; i += 1) {
    const parts = lines[i].split(/[\s,;]+/);
    const x = parts.length === 2 ? parseNumber(parts[0]) : NaN;
    const y = parts.length === 2 ? parseNumber(parts[1]) : NaN;

    if (Number.isNaN(x) || Number.isNaN(y)) {
      showMessage(`Строка ${i + 1} ("${lines[i]}"): нужны два числа, x и y.`, true);
      return null;
    }

    points.push({ x, y });
  }

  if (points.length < 2) {
    showMessage('Для ломаной нужно минимум две точки.', true);
    return null;
  }

  return points;
}

// Возвращает список отрезков { label, x1, y1, x2, y2 } или null при ошибке.
function readSegments() {
  if (modeSelect.value === 'segment') {
    const x1 = parseNumber(document.querySelector('#x1').value);
    const y1 = parseNumber(document.querySelector('#y1').value);
    const x2 = parseNumber(document.querySelector('#x2').value);
    const y2 = parseNumber(document.querySelector('#y2').value);

    if ([x1, y1, x2, y2].some(Number.isNaN)) {
      showMessage('Введите числа для x1, y1, x2, y2.', true);
      return null;
    }

    return [{ label: 'A -> B', x1, y1, x2, y2 }];
  }

  const points = parsePoints(document.querySelector('#points').value);

  if (!points) {
    return null;
  }

  const segments = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({
      label: `P${i} -> P${i + 1}`,
      x1: points[i].x,
      y1: points[i].y,
      x2: points[i + 1].x,
      y2: points[i + 1].y
    });
  }

  return segments;
}


// 3. Отрисовка

function drawGrid() {
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#999';
  ctx.font = '10px Arial';

  for (let x = 0; x <= GRID_WIDTH; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * scale, 0);
    ctx.lineTo(x * scale, canvas.height);
    ctx.stroke();

    if (x % 5 === 0 && x > 0) {
      ctx.fillText(x, x * scale + 2, 10);
    }
  }

  for (let y = 0; y <= GRID_HEIGHT; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * scale);
    ctx.lineTo(canvas.width, y * scale);
    ctx.stroke();

    if (y % 5 === 0 && y > 0) {
      ctx.fillText(y, 2, y * scale - 2);
    }
  }
}

function drawLine(x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1 * scale, y1 * scale);
  ctx.lineTo(x2 * scale, y2 * scale);
  ctx.stroke();
}

function drawPoint(x, y, color, label) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x * scale, y * scale, 4, 0, Math.PI * 2);
  ctx.fill();

  if (label) {
    ctx.fillStyle = '#222';
    ctx.font = '13px Arial';
    ctx.fillText(label, x * scale + 7, y * scale - 7);
  }
}

function drawScene(rect, segments, traces) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  ctx.fillStyle = 'rgba(45, 127, 249, 0.10)';
  ctx.fillRect(
    rect.xmin * scale,
    rect.ymin * scale,
    (rect.xmax - rect.xmin) * scale,
    (rect.ymax - rect.ymin) * scale
  );
  ctx.strokeStyle = '#2d7ff9';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    rect.xmin * scale,
    rect.ymin * scale,
    (rect.xmax - rect.xmin) * scale,
    (rect.ymax - rect.ymin) * scale
  );

  for (const s of segments) {
    drawLine(s.x1, s.y1, s.x2, s.y2, '#999', 1.5);
  }

  for (const trace of traces) {
    if (trace.result) {
      const r = trace.result;
      drawLine(r.x1, r.y1, r.x2, r.y2, '#e74c3c', 4);
    }
  }

  if (segments.length === 1) {
    drawPoint(segments[0].x1, segments[0].y1, '#555', 'A');
    drawPoint(segments[0].x2, segments[0].y2, '#555', 'B');
  } else {
    const first = segments[0];
    drawPoint(first.x1, first.y1, '#555', 'P0');

    segments.forEach((s, i) => {
      drawPoint(s.x2, s.y2, '#555', `P${i + 1}`);
    });
  }
}


// 4. Вывод кодов и таблиц

const CATEGORY_TEXT = {
  accept: 'принят без изменения',
  clip: 'отсечён',
  reject: 'полностью отброшен'
};

function describeResult(trace) {
  const kind = classify(trace);

  if (kind === 'reject') {
    return CATEGORY_TEXT.reject;
  }

  const r = trace.result;
  return `${CATEGORY_TEXT[kind]}: ${formatPoint(r.x1, r.y1)} - ${formatPoint(r.x2, r.y2)}`;
}

function renderCodes(rect, segments, traces) {
  const lines = [];

  segments.forEach((s, i) => {
    const codeA = codeToString(getCode(s.x1, s.y1, rect));
    const codeB = codeToString(getCode(s.x2, s.y2, rect));
    const [from, to] = segments.length === 1 ? ['A', 'B'] : [`P${i}`, `P${i + 1}`];

    lines.push(`${from}: ${codeA}   ${to}: ${codeB}   ${describeResult(traces[i])}`);
  });

  codesElement.textContent = lines.join('\n');
}

function renderTraces(segments, traces) {
  tracesElement.innerHTML = '';

  segments.forEach((s, i) => {
    if (segments.length > 1) {
      const heading = document.createElement('h3');
      heading.textContent = `Сегмент ${s.label}`;
      tracesElement.appendChild(heading);
    }

    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>шаг</th><th>A</th><th>codeA</th>
          <th>B</th><th>codeB</th><th>действие</th>
        </tr>
      </thead>
    `;

    const body = document.createElement('tbody');

    for (const step of traces[i].steps) {
      const tr = document.createElement('tr');

      for (const value of [
        step.step,
        formatPoint(step.x1, step.y1),
        codeToString(step.code1),
        formatPoint(step.x2, step.y2),
        codeToString(step.code2),
        step.action
      ]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }

      body.appendChild(tr);
    }

    table.appendChild(body);
    tracesElement.appendChild(table);
  });
}

function build() {
  const rect = readRect();

  if (!rect) {
    return;
  }

  const segments = readSegments();

  if (!segments) {
    return;
  }

  showMessage('');

  const traces = segments.map((s) => clipLineTrace(s.x1, s.y1, s.x2, s.y2, rect));

  drawScene(rect, segments, traces);
  renderCodes(rect, segments, traces);
  renderTraces(segments, traces);
}


// 5. Обязательные тесты

const TEST_RECT = { xmin: 10, ymin: 8, xmax: 30, ymax: 22 };

const TEST_CASES = [
  {
    name: 'полностью внутри окна',
    seg: [12, 10, 25, 18],
    expected: { type: 'accept', result: [12, 10, 25, 18] }
  },
  {
    name: 'полностью слева',
    seg: [2, 10, 8, 20],
    expected: { type: 'reject' }
  },
  {
    name: 'полностью сверху',
    seg: [12, 2, 28, 6],
    expected: { type: 'reject' }
  },
  {
    name: 'пересекает одну границу',
    seg: [5, 12, 20, 16],
    expected: { type: 'clip', result: [10, 40 / 3, 20, 16] }
  },
  {
    name: 'пересекает две противоположные границы',
    seg: [5, 12, 35, 18],
    expected: { type: 'clip', result: [10, 13, 30, 17] }
  },
  {
    name: 'проходит через угол',
    seg: [6, 4, 20, 18],
    expected: { type: 'clip', result: [10, 8, 20, 18] }
  },
  {
    name: 'вертикальный',
    seg: [20, 2, 20, 28],
    expected: { type: 'clip', result: [20, 8, 20, 22] }
  },
  {
    name: 'горизонтальный',
    seg: [4, 15, 36, 15],
    expected: { type: 'clip', result: [10, 15, 30, 15] }
  },
  {
    name: 'обе точки снаружи, но отрезок проходит через окно',
    seg: [8, 25, 32, 5],
    expected: { type: 'clip', result: [11.6, 22, 28.4, 8] }
  }
];

function isSameResult(actual, expected) {
  const keys = ['x1', 'y1', 'x2', 'y2'];
  return keys.every((key, i) => Math.abs(actual[key] - expected[i]) < 1e-9);
}

function describeExpected(expected) {
  if (expected.type === 'reject') {
    return CATEGORY_TEXT.reject;
  }

  const [x1, y1, x2, y2] = expected.result;
  return `${CATEGORY_TEXT[expected.type]}: ${formatPoint(x1, y1)} - ${formatPoint(x2, y2)}`;
}

function showTestCase(seg) {
  document.querySelector('#xmin').value = TEST_RECT.xmin;
  document.querySelector('#ymin').value = TEST_RECT.ymin;
  document.querySelector('#xmax').value = TEST_RECT.xmax;
  document.querySelector('#ymax').value = TEST_RECT.ymax;

  modeSelect.value = 'segment';
  updateModeFields();

  document.querySelector('#x1').value = seg[0];
  document.querySelector('#y1').value = seg[1];
  document.querySelector('#x2').value = seg[2];
  document.querySelector('#y2').value = seg[3];

  build();
  canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function runTests() {
  const body = document.querySelector('#testsBody');
  body.innerHTML = '';

  let passed = 0;

  TEST_CASES.forEach((test, i) => {
    const [x1, y1, x2, y2] = test.seg;
    const trace = clipLineTrace(x1, y1, x2, y2, TEST_RECT);
    const kind = classify(trace);

    let ok = kind === test.expected.type;

    if (ok && kind !== 'reject') {
      ok = isSameResult(trace.result, test.expected.result);
    }

    if (ok) {
      passed += 1;
    }

    const tr = document.createElement('tr');

    for (const value of [
      i + 1,
      test.name,
      `${formatPoint(x1, y1)} - ${formatPoint(x2, y2)}`,
      describeExpected(test.expected),
      describeResult(trace)
    ]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    }

    const status = document.createElement('td');
    status.textContent = ok ? 'OK' : 'ОШИБКА';
    status.className = ok ? 'pass' : 'fail';
    tr.appendChild(status);

    const action = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Показать';
    button.addEventListener('click', () => showTestCase(test.seg));
    action.appendChild(button);
    tr.appendChild(action);

    body.appendChild(tr);
  });

  document.querySelector('#testSummary').textContent =
    `Пройдено: ${passed} из ${TEST_CASES.length}`;
}


// 6. Эксперимент со случайными отрезками

function createRandom(seed) {
  let a = seed >>> 0;

  return function random() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runExperiment() {
  const output = document.querySelector('#expResult');
  const rect = readRect();

  if (!rect) {
    output.textContent = 'Исправьте границы окна.';
    return;
  }

  const count = parseNumber(document.querySelector('#expCount').value);
  const seed = parseNumber(document.querySelector('#expSeed').value);

  if (!Number.isInteger(count) || count <= 0 || !Number.isInteger(seed)) {
    output.textContent = 'Количество должно быть целым числом больше 0, seed целым числом.';
    return;
  }

  const random = createRandom(seed);
  const margin = 15;

  const randomIn = (min, max) => min - margin + random() * (max - min + 2 * margin);

  const counts = { accept: 0, clip: 0, reject: 0 };
  let withoutIntersections = 0;
  let rejectedAfterIntersections = 0;

  for (let i = 0; i < count; i += 1) {
    const x1 = randomIn(rect.xmin, rect.xmax);
    const y1 = randomIn(rect.ymin, rect.ymax);
    const x2 = randomIn(rect.xmin, rect.xmax);
    const y2 = randomIn(rect.ymin, rect.ymax);

    const trace = clipLineTrace(x1, y1, x2, y2, rect);
    const kind = classify(trace);

    counts[kind] += 1;

    if (trace.intersections === 0) {
      withoutIntersections += 1;
    } else if (kind === 'reject') {
      rejectedAfterIntersections += 1;
    }
  }

  const percent = (value) => `${((value / count) * 100).toFixed(1)}%`;

  output.textContent =
    `Отрезков: ${count}, seed: ${seed}\n\n` +
    `принято без изменения:  ${counts.accept} (${percent(counts.accept)})\n` +
    `отсечено:               ${counts.clip} (${percent(counts.clip)})\n` +
    `полностью отброшено:    ${counts.reject} (${percent(counts.reject)})\n\n` +
    `решено только по кодам, без вычисления пересечений: ` +
    `${withoutIntersections} (${percent(withoutIntersections)})\n` +
    `отброшено после вычисления пересечений: ${rejectedAfterIntersections}`;
}


// 7. События

function updateModeFields() {
  const isSegment = modeSelect.value === 'segment';
  document.querySelector('#segmentFields').hidden = !isSegment;
  document.querySelector('#polylineFields').hidden = isSegment;
}

modeSelect.addEventListener('change', () => {
  updateModeFields();
  build();
});

document.querySelector('#build').addEventListener('click', build);
document.querySelector('#runTests').addEventListener('click', runTests);
document.querySelector('#runExperiment').addEventListener('click', runExperiment);

updateModeFields();
build();
