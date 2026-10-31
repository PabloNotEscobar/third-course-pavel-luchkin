'use strict';

/* =====================================================================
   Практическая работа №5. Заполнение областей: Flood Fill и Scanline.

   Файл состоит из двух частей:
   1) алгоритмы и данные (не зависят от DOM — их можно запускать в Node);
   2) интерфейс (запускается только в браузере).
   ===================================================================== */

// ---------------------------------------------------------------------
// 1. Логический растр
// ---------------------------------------------------------------------

const GRID_W = 40;
const GRID_H = 30;
const CELL = 16; // размер клетки на Canvas, px

const EMPTY = 0;   // пусто
const BORDER = 1;  // граница
const FILLED = 2;  // заполнено

// 4-связность: только соседи по сторонам, без диагоналей
const NEIGHBORS_4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function createGrid(w = GRID_W, h = GRID_H) {
  return Array.from({ length: h }, () => new Array(w).fill(EMPTY));
}

function cloneGrid(g) {
  return g.map(row => row.slice());
}

function inBounds(g, x, y) {
  return y >= 0 && y < g.length && x >= 0 && x < g[0].length;
}

function putPixel(g, x, y, value) {
  if (inBounds(g, x, y)) {
    g[y][x] = value;
  }
}

// Убрать результат заливки, оставив только контур
function clearFill(g) {
  for (const row of g) {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === FILLED) {
        row[x] = EMPTY;
      }
    }
  }
}

function countCells(g, value) {
  let n = 0;
  for (const row of g) {
    for (const v of row) {
      if (v === value) n += 1;
    }
  }
  return n;
}

// ---------------------------------------------------------------------
// 2. Контур: алгоритм Брезенхема (все октанты, целые числа)
// ---------------------------------------------------------------------

function bresenham(x0, y0, x1, y1, plot) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

// closed = false: последнее ребро (от последней вершины к первой) не рисуется
function drawPolygonOutline(g, points, closed = true) {
  const edges = closed ? points.length : points.length - 1;
  for (let i = 0; i < edges; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    bresenham(a.x, a.y, b.x, b.y, (x, y) => putPixel(g, x, y, BORDER));
  }
}

// ---------------------------------------------------------------------
// 3. Flood Fill (4-связность, явный стек, без рекурсии)
// ---------------------------------------------------------------------

/**
 * Заливка от стартовой клетки.
 * Проходит только по клеткам EMPTY, границу (BORDER) и уже залитые клетки не трогает.
 * Каждая клетка попадает в стек не более одного раза (массив visited).
 *
 * order — порядок обхода (индексы y * w + x), нужен для пошагового режима.
 * touchesBorder — заливка дошла до края сетки (признак «утечки»).
 */
function floodFill(startX, startY, g = grid) {
  const h = g.length;
  const w = g[0].length;
  const result = {
    pixels: 0, steps: 0, neighborChecks: 0,
    order: [], touchesBorder: false, reason: null
  };

  if (!inBounds(g, startX, startY)) {
    result.reason = 'Старт вне сетки';
    return result;
  }
  if (g[startY][startX] === BORDER) {
    result.reason = 'Старт попал на границу';
    return result;
  }
  if (g[startY][startX] === FILLED) {
    result.reason = 'Клетка уже заполнена';
    return result;
  }

  const visited = new Uint8Array(w * h);
  const stack = [startY * w + startX];
  visited[startY * w + startX] = 1;

  while (stack.length > 0) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx - x) / w;

    result.steps += 1;
    g[y][x] = FILLED;
    result.pixels += 1;
    result.order.push(idx);

    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
      result.touchesBorder = true;
    }

    for (const [dx, dy] of NEIGHBORS_4) {
      const nx = x + dx;
      const ny = y + dy;
      result.neighborChecks += 1;

      if (!inBounds(g, nx, ny)) continue;        // не выходим за сетку
      if (visited[ny * w + nx]) continue;        // не обрабатываем клетку дважды
      if (g[ny][nx] !== EMPTY) continue;         // не проходим через контур

      visited[ny * w + nx] = 1;
      stack.push(ny * w + nx);
    }
  }

  return result;
}

// ---------------------------------------------------------------------
// 4. Scanline Fill
// ---------------------------------------------------------------------

/**
 * X-координаты пересечений строки y со всеми рёбрами многоугольника.
 * Правило вершин: ребро учитывается, если min(y1, y2) <= y < max(y1, y2).
 * Горизонтальные рёбра пропускаются.
 */
function getIntersections(points, y) {
  const xs = [];

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];

    if (a.y === b.y) continue; // горизонтальное ребро

    const yMin = Math.min(a.y, b.y);
    const yMax = Math.max(a.y, b.y);

    if (y < yMin || y >= yMax) continue;

    const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
    xs.push(x);
  }

  xs.sort((p, q) => p - q);
  return xs;
}

// Пересечения + интервалы заполнения для одной строки (для таблицы и для самой заливки)
function describeRow(points, y) {
  const xs = getIntersections(points, y);
  const intervals = [];

  for (let i = 0; i + 1 < xs.length; i += 2) {
    const xStart = Math.ceil(xs[i]);
    const xEnd = Math.floor(xs[i + 1]);
    if (xEnd >= xStart) {
      intervals.push([xStart, xEnd]);
    }
  }

  return { y, xs, intervals };
}

function fmtNum(n) {
  const s = n.toFixed(2);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

function formatRow(d) {
  const xs = d.xs.length ? d.xs.map(fmtNum).join(', ') : '—';
  const fill = d.intervals.length ? d.intervals.map(([s, e]) => `${s}..${e}`).join(', ') : '—';
  return `y = ${d.y}\nX: ${xs}\nfill: ${fill}`;
}

/**
 * Заливка многоугольника по строкам растра. Стартовая точка не нужна.
 * Строки обходятся по правилу [yMin, yMax): последняя строка многоугольника
 * не сканируется (её пиксели принадлежат контуру).
 * Клетки границы не перезаписываются.
 *
 * rows — сколько строк просмотрено, edgeChecks — сколько пар «строка × ребро» проверено,
 * rawPixels — длина всех интервалов (вместе с клетками контура), pixels — реально закрашено.
 */
function scanlineFill(points, g = grid) {
  const h = g.length;
  const w = g[0].length;
  const result = { pixels: 0, rawPixels: 0, rows: 0, intervals: 0, edgeChecks: 0 };

  if (points.length < 3) return result;

  const ys = points.map(p => p.y);
  const yFrom = Math.max(0, Math.ceil(Math.min(...ys)));
  const yTo = Math.max(...ys); // строка yTo не сканируется

  for (let y = yFrom; y < yTo && y < h; y += 1) {
    result.rows += 1;
    result.edgeChecks += points.length;

    const row = describeRow(points, y);

    for (const [xStart, xEnd] of row.intervals) {
      result.intervals += 1;
      const from = Math.max(0, xStart);
      const to = Math.min(w - 1, xEnd);

      for (let x = from; x <= to; x += 1) {
        result.rawPixels += 1;
        if (g[y][x] === EMPTY) {
          g[y][x] = FILLED;
          result.pixels += 1;
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------
// 5. Многоугольники (задаются списком вершин)
// ---------------------------------------------------------------------

function pts(list) {
  return list.map(([x, y]) => ({ x, y }));
}

// Пятиконечная звезда: 10 вершин, округлённых до целых
function starPoints(cx, cy, outer, inner) {
  const list = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? outer : inner;
    list.push([Math.round(cx + radius * Math.cos(angle)), Math.round(cy + radius * Math.sin(angle))]);
  }
  return pts(list);
}

const PENTAGON = pts([[20, 3], [35, 12], [30, 26], [10, 26], [5, 12]]);
const STAR = starPoints(20, 15, 13, 5.5);

const PRESETS = [
  { id: 'rect', name: '1. Прямоугольник',
    points: pts([[5, 5], [34, 5], [34, 22], [5, 22]]), seed: { x: 20, y: 13 }, rowY: 10 },
  { id: 'triangle', name: '2. Треугольник',
    points: pts([[20, 3], [36, 25], [4, 25]]), seed: { x: 20, y: 16 }, rowY: 15 },
  { id: 'convex', name: '3. Выпуклый пятиугольник',
    points: PENTAGON, seed: { x: 20, y: 15 }, rowY: 12 },
  { id: 'concave', name: '4. Невыпуклый (буква U)',
    points: pts([[4, 4], [14, 4], [14, 18], [26, 18], [26, 4], [36, 4], [36, 26], [4, 26]]),
    seed: { x: 8, y: 20 }, rowY: 10 },
  { id: 'horizontal', name: '5. Трапеция (горизонтальные рёбра)',
    points: pts([[10, 6], [30, 6], [36, 24], [4, 24]]), seed: { x: 20, y: 15 }, rowY: 6 },
  { id: 'star', name: '6. Звезда (строки через вершины)',
    points: STAR, seed: { x: 20, y: 15 }, rowY: STAR[1].y },
  { id: 'open', name: '9. Незамкнутый контур (пятиугольник без одной стороны)',
    points: PENTAGON, closed: false, seed: { x: 20, y: 15 }, rowY: 12 }
];

function presetById(id) {
  return PRESETS.find(p => p.id === id);
}

function buildBase(preset) {
  const g = createGrid();
  drawPolygonOutline(g, preset.points, preset.closed !== false);
  return g;
}

// Запустить оба метода на одном и том же контуре и сравнить результат
function compareMethods(preset, seed = preset.seed) {
  const base = buildBase(preset);
  const gf = cloneGrid(base);
  const gs = cloneGrid(base);
  const f = floodFill(seed.x, seed.y, gf);
  const s = scanlineFill(preset.points, gs);

  let diff = 0;
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if ((gf[y][x] === FILLED) !== (gs[y][x] === FILLED)) diff += 1;
    }
  }
  return { base, gf, gs, f, s, diff, borderCells: countCells(base, BORDER) };
}

// ---------------------------------------------------------------------
// 6. Обязательные тесты
// ---------------------------------------------------------------------

function allRowsEven(points) {
  const ys = points.map(p => p.y);
  for (let y = Math.min(...ys) - 1; y <= Math.max(...ys) + 1; y += 1) {
    if (getIntersections(points, y).length % 2 !== 0) return false;
  }
  return true;
}

function runTests() {
  const rows = [];
  const add = (n, name, check, result, ok) => rows.push({ n, name, check, result, ok });

  // 1. Прямоугольник: внутренность 28 × 16 = 448 клеток
  {
    const c = compareMethods(presetById('rect'));
    const expected = 28 * 16;
    add(1, 'Прямоугольник', `оба метода закрашивают ${expected} клеток, результаты совпадают`,
      `flood = ${c.f.pixels}, scanline = ${c.s.pixels}, различий = ${c.diff}`,
      c.f.pixels === expected && c.s.pixels === expected && c.diff === 0);
  }

  // 2. Треугольник
  {
    const c = compareMethods(presetById('triangle'));
    add(2, 'Треугольник', 'заливка не выходит за контур, методы почти совпадают (≤ 1% клеток)',
      `flood = ${c.f.pixels}, scanline = ${c.s.pixels}, различий = ${c.diff}`,
      c.f.pixels > 0 && !c.f.touchesBorder && c.diff <= Math.max(2, c.f.pixels * 0.01));
  }

  // 3. Выпуклый пятиугольник
  {
    const c = compareMethods(presetById('convex'));
    add(3, 'Выпуклый пятиугольник (5 вершин)', 'заливка не выходит за контур, методы почти совпадают (≤ 1% клеток)',
      `flood = ${c.f.pixels}, scanline = ${c.s.pixels}, различий = ${c.diff}`,
      c.f.pixels > 0 && !c.f.touchesBorder && c.diff <= Math.max(2, c.f.pixels * 0.01));
  }

  // 4. Невыпуклый: на строке через «вырез» два интервала
  {
    const p = presetById('concave');
    const c = compareMethods(p);
    const row = describeRow(p.points, 10);
    add(4, 'Невыпуклый многоугольник (U)', 'на строке y = 10 два интервала; методы почти совпадают (≤ 1% клеток)',
      `интервалы: ${row.intervals.map(([s, e]) => `${s}..${e}`).join(', ')}; flood = ${c.f.pixels}, scanline = ${c.s.pixels}, различий = ${c.diff}`,
      row.intervals.length === 2 && !c.f.touchesBorder && c.diff <= Math.max(2, c.f.pixels * 0.01));
  }

  // 5. Горизонтальные рёбра не дают пересечений
  {
    const p = presetById('horizontal');
    const top = getIntersections(p.points, 6);   // строка верхнего горизонтального ребра
    const bottom = getIntersections(p.points, 24); // строка нижнего горизонтального ребра
    add(5, 'Горизонтальное ребро', 'на y = 6 ровно 2 пересечения (только боковые рёбра), на y = 24 (yMax) — 0, чётность везде',
      `y=6: [${top.map(fmtNum).join(', ')}], y=24: [${bottom.map(fmtNum).join(', ')}]`,
      top.length === 2 && bottom.length === 0 && allRowsEven(p.points));
  }

  // 6. Строка через вершину: во всех строках, включая строки вершин, чётное число пересечений
  {
    const p = presetById('star');
    const vertexRows = [...new Set(p.points.map(v => v.y))].sort((a, b) => a - b);
    const bad = vertexRows.filter(y => getIntersections(p.points, y).length % 2 !== 0);
    const c = compareMethods(p);
    add(6, 'Строка через вершину (звезда)', 'чётное число пересечений на каждой строке, в т.ч. на строках вершин',
      `строк с вершинами: ${vertexRows.length}, нечётных: ${bad.length}; flood = ${c.f.pixels}, scanline = ${c.s.pixels}, различий = ${c.diff}`,
      bad.length === 0 && allRowsEven(p.points));
  }

  // 7. Flood fill со стартом внутри
  const convex = compareMethods(presetById('convex'));
  add(7, 'Flood Fill, старт внутри', 'закрашена только внутренность, до края сетки не дошла',
    `старт (20, 15): закрашено ${convex.f.pixels}, дошла до края: ${convex.f.touchesBorder ? 'да' : 'нет'}`,
    convex.f.pixels > 0 && !convex.f.touchesBorder);

  // 8. Flood fill со стартом снаружи: заливается всё внешнее пространство
  {
    const g = buildBase(presetById('convex'));
    const r = floodFill(1, 1, g);
    const expected = GRID_W * GRID_H - convex.borderCells - convex.f.pixels;
    add(8, 'Flood Fill, старт снаружи', 'заливается вся внешняя область: W·H − граница − внутренность',
      `старт (1, 1): закрашено ${r.pixels}, ожидалось ${expected}`,
      r.pixels === expected && r.touchesBorder);
  }

  // 9. Незамкнутый контур
  {
    const c = compareMethods(presetById('open'));
    add(9, 'Незамкнутый контур', 'Flood Fill «вытекает» за контур и заливает почти всю сетку; Scanline заливает фигуру как замкнутую (плюс клетки пропущенной стороны)',
      `flood = ${c.f.pixels} (до края: ${c.f.touchesBorder ? 'да' : 'нет'}), scanline = ${c.s.pixels} (у замкнутого контура ${convex.s.pixels})`,
      c.f.touchesBorder && c.f.pixels > 2 * c.s.pixels && c.s.pixels >= convex.s.pixels);
  }

  return rows;
}

// ---------------------------------------------------------------------
// 7. Сравнение методов (серии запусков, performance.now)
// ---------------------------------------------------------------------

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function median(values) {
  const s = values.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * runs запусков в серии, серий reps. Копии сетки создаются до замера,
 * чтобы в время входила только сама заливка. Берётся медиана по сериям.
 */
function runBenchmark(preset, runs = 300, reps = 7) {
  const base = buildBase(preset);
  const { x: sx, y: sy } = preset.seed;

  // прогрев JIT
  for (let i = 0; i < 20; i += 1) {
    floodFill(sx, sy, cloneGrid(base));
    scanlineFill(preset.points, cloneGrid(base));
  }

  let fr = null;
  let sr = null;
  const floodTimes = [];
  const scanTimes = [];

  for (let rep = 0; rep < reps; rep += 1) {
    const gf = Array.from({ length: runs }, () => cloneGrid(base));
    const gs = Array.from({ length: runs }, () => cloneGrid(base));

    const t0 = nowMs();
    for (let i = 0; i < runs; i += 1) fr = floodFill(sx, sy, gf[i]);
    const t1 = nowMs();
    for (let i = 0; i < runs; i += 1) sr = scanlineFill(preset.points, gs[i]);
    const t2 = nowMs();

    floodTimes.push(t1 - t0);
    scanTimes.push(t2 - t1);
  }

  return {
    runs, reps,
    flood: { pixels: fr.pixels, processed: fr.steps, checks: fr.neighborChecks, perRun: median(floodTimes) / runs },
    scan: { pixels: sr.pixels, processed: sr.rows, checks: sr.edgeChecks, perRun: median(scanTimes) / runs }
  };
}

// ---------------------------------------------------------------------
// 8. Интерфейс (только в браузере)
// ---------------------------------------------------------------------

let grid = createGrid(); // текущее состояние логического растра

function initUI() {
  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');

  const ui = {
    preset: PRESETS[0],
    base: null,
    method: null,        // 'flood' | 'scan' | null
    seed: { ...PRESETS[0].seed },
    flood: null,         // результат floodFill
    stepIndex: null,     // для каждой клетки номер шага обхода (или -1)
    stepLimit: 0,
    rowY: PRESETS[0].rowY,
    timer: null
  };

  // ----- отрисовка -----
  function render() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const total = ui.flood ? ui.flood.order.length : 0;

    for (let y = 0; y < GRID_H; y += 1) {
      for (let x = 0; x < GRID_W; x += 1) {
        const v = grid[y][x];
        if (v === EMPTY) continue;

        if (v === BORDER) {
          ctx.fillStyle = '#1f2937';
        } else if (ui.method === 'scan') {
          ctx.fillStyle = '#fbbf24';
        } else if (ui.method === 'flood' && ui.stepIndex) {
          const k = ui.stepIndex[y * GRID_W + x];
          if (k < 0 || k >= ui.stepLimit) continue;
          if (k === ui.stepLimit - 1) {
            ctx.fillStyle = '#ef4444';
          } else {
            const t = total > 1 ? k / (total - 1) : 0;
            ctx.fillStyle = `hsl(${210 + 60 * t}, 85%, ${80 - 30 * t}%)`;
          }
        } else {
          continue;
        }
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    // сетка
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GRID_W; x += 1) {
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, GRID_H * CELL);
    }
    for (let y = 0; y <= GRID_H; y += 1) {
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(GRID_W * CELL, y * CELL + 0.5);
    }
    ctx.stroke();

    // выбранная строка scanline и точки пересечения
    if (ui.rowY !== null && ui.rowY >= 0 && ui.rowY < GRID_H) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.fillRect(0, ui.rowY * CELL, GRID_W * CELL, CELL);
      const d = describeRow(ui.preset.points, ui.rowY);
      ctx.fillStyle = '#dc2626';
      for (const x of d.xs) {
        ctx.beginPath();
        ctx.arc((x + 0.5) * CELL, (ui.rowY + 0.5) * CELL, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // вершины многоугольника
    ctx.fillStyle = '#2563eb';
    for (const p of ui.preset.points) {
      ctx.beginPath();
      ctx.arc((p.x + 0.5) * CELL, (p.y + 0.5) * CELL, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // стартовая точка Flood Fill
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc((ui.seed.x + 0.5) * CELL, (ui.seed.y + 0.5) * CELL, CELL * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }

  function setStatus(text, warn = false) {
    const el = $('status');
    el.textContent = text;
    el.className = warn ? 'status warn' : 'status';
  }

  function showRow() {
    const y = Number($('rowY').value);
    if (!Number.isInteger(y) || y < 0 || y >= GRID_H) {
      $('rowOut').textContent = `y должен быть целым числом от 0 до ${GRID_H - 1}`;
      return;
    }
    ui.rowY = y;
    $('rowOut').textContent = formatRow(describeRow(ui.preset.points, y));
    render();
  }

  // ----- пошаговый режим -----
  function stopPlay() {
    if (ui.timer) {
      clearInterval(ui.timer);
      ui.timer = null;
      $('btnPlay').textContent = '▶ Авто';
    }
  }

  function setStepControls(enabled) {
    for (const id of ['stepRange', 'btnPrev', 'btnNext', 'btnPlay', 'btnAll']) {
      $(id).disabled = !enabled;
    }
  }

  function setStep(n) {
    const total = ui.flood ? ui.flood.order.length : 0;
    ui.stepLimit = Math.max(0, Math.min(total, n));
    $('stepRange').value = ui.stepLimit;
    if (total === 0) {
      $('stepLabel').textContent = 'нет данных — сначала запустите Flood Fill';
    } else if (ui.stepLimit === 0) {
      $('stepLabel').textContent = `шаг 0 из ${total}`;
    } else {
      const idx = ui.flood.order[ui.stepLimit - 1];
      $('stepLabel').textContent =
        `шаг ${ui.stepLimit} из ${total}, клетка (${idx % GRID_W}, ${Math.floor(idx / GRID_W)})`;
    }
    render();
  }

  // ----- заливки -----
  function resetFill() {
    stopPlay();
    clearFill(grid);
    ui.method = null;
    ui.flood = null;
    ui.stepIndex = null;
    ui.stepLimit = 0;
    $('stepRange').max = 0;
    setStepControls(false);
    setStep(0);
  }

  function runFlood() {
    resetFill();
    const result = floodFill(ui.seed.x, ui.seed.y, grid);

    if (result.reason) {
      setStatus(`Flood Fill не выполнен: ${result.reason} (${ui.seed.x}, ${ui.seed.y}).`, true);
      render();
      return;
    }

    ui.method = 'flood';
    ui.flood = result;
    ui.stepIndex = new Int32Array(GRID_W * GRID_H).fill(-1);
    result.order.forEach((idx, k) => { ui.stepIndex[idx] = k; });

    $('stepRange').max = result.order.length;
    setStepControls(true);
    setStep(result.order.length);

    let text = `Flood Fill (4-связность), старт (${ui.seed.x}, ${ui.seed.y}): закрашено ${result.pixels} клеток, ` +
      `обработано из стека ${result.steps}, проверок соседей ${result.neighborChecks}.`;
    if (result.touchesBorder) {
      text += ' Заливка дошла до края сетки — контур не замкнут или старт снаружи фигуры.';
    }
    setStatus(text, result.touchesBorder);
  }

  function runScan() {
    resetFill();
    const result = scanlineFill(ui.preset.points, grid);
    ui.method = 'scan';
    setStatus(
      `Scanline: закрашено ${result.pixels} клеток, просмотрено строк ${result.rows}, ` +
      `интервалов ${result.intervals}, проверок «строка × ребро» ${result.edgeChecks}. ` +
      `Длина интервалов вместе с клетками контура: ${result.rawPixels}.`);
    render();
  }

  // ----- выбор фигуры -----
  function selectPreset(id) {
    ui.preset = presetById(id);
    ui.base = buildBase(ui.preset);
    grid = cloneGrid(ui.base);
    ui.seed = { ...ui.preset.seed };
    ui.rowY = ui.preset.rowY;
    $('rowY').value = ui.rowY;
    resetFill();
    showRow();
    setStatus(ui.preset.closed === false
      ? 'Контур незамкнут (нет одной стороны). Запустите оба метода и сравните результат.'
      : 'Фигура построена алгоритмом Брезенхема. Запустите Flood Fill или Scanline.');
  }

  // ----- таблицы результатов -----
  function renderTests() {
    const rows = runTests();
    let html = '<table><tr><th>№</th><th>Тест</th><th>Что проверяем</th><th>Результат</th><th></th></tr>';
    for (const r of rows) {
      html += `<tr><td>${r.n}</td><td>${r.name}</td><td>${r.check}</td><td>${r.result}</td>` +
        `<td class="${r.ok ? 'ok' : 'fail'}">${r.ok ? '✓' : '✗'}</td></tr>`;
    }
    const passed = rows.filter(r => r.ok).length;
    html += `</table><div class="small">Пройдено: ${passed} из ${rows.length}</div>`;
    $('testsOut').innerHTML = html;
  }

  function renderCompare() {
    const runs = Math.max(10, Math.min(5000, Number($('runs').value) || 300));
    const b = runBenchmark(ui.preset, runs);
    const f = b.flood;
    const s = b.scan;
    $('compareOut').innerHTML =
      '<table><tr><th>Метод</th><th>Закрашено</th><th>Обработано элементов</th><th>Проверок</th><th>Время на запуск, мс</th></tr>' +
      `<tr><td>Flood Fill</td><td>${f.pixels}</td><td>${f.processed} клеток</td><td>${f.checks} соседей</td><td>${f.perRun.toFixed(4)}</td></tr>` +
      `<tr><td>Scanline</td><td>${s.pixels}</td><td>${s.processed} строк</td><td>${s.checks} строка×ребро</td><td>${s.perRun.toFixed(4)}</td></tr>` +
      `</table><div class="small">Фигура: ${ui.preset.name}. ${b.reps} серий по ${b.runs} запусков, взята медиана серий. ` +
      'Копии сетки создаются до замера времени.</div>';
  }

  // ----- события -----
  for (const p of PRESETS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    $('preset').appendChild(opt);
  }
  $('preset').addEventListener('change', e => selectPreset(e.target.value));
  $('btnFlood').addEventListener('click', runFlood);
  $('btnScan').addEventListener('click', runScan);
  $('btnReset').addEventListener('click', () => { resetFill(); setStatus('Заливка сброшена.'); });
  $('btnRow').addEventListener('click', showRow);
  $('rowY').addEventListener('change', showRow);
  $('btnTests').addEventListener('click', renderTests);
  $('btnCompare').addEventListener('click', renderCompare);

  $('stepRange').addEventListener('input', e => { stopPlay(); setStep(Number(e.target.value)); });
  $('btnPrev').addEventListener('click', () => { stopPlay(); setStep(ui.stepLimit - 1); });
  $('btnNext').addEventListener('click', () => { stopPlay(); setStep(ui.stepLimit + 1); });
  $('btnAll').addEventListener('click', () => { stopPlay(); setStep(ui.flood ? ui.flood.order.length : 0); });
  $('btnPlay').addEventListener('click', () => {
    if (ui.timer) { stopPlay(); return; }
    if (!ui.flood) return;
    const total = ui.flood.order.length;
    if (ui.stepLimit >= total) setStep(0);
    const chunk = Math.max(1, Math.ceil(total / 150));
    $('btnPlay').textContent = '⏸ Пауза';
    ui.timer = setInterval(() => {
      setStep(ui.stepLimit + chunk);
      if (ui.stepLimit >= total) stopPlay();
    }, 40);
  });

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) * canvas.width) / rect.width / CELL);
    const y = Math.floor(((e.clientY - rect.top) * canvas.height) / rect.height / CELL);
    if (!inBounds(grid, x, y)) return;

    if ($('modeRow').checked) {
      $('rowY').value = y;
      showRow();
    } else {
      ui.seed = { x, y };
      runFlood();
    }
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) * canvas.width) / rect.width / CELL);
    const y = Math.floor(((e.clientY - rect.top) * canvas.height) / rect.height / CELL);
    canvas.title = inBounds(grid, x, y) ? `(${x}, ${y})` : '';
  });

  selectPreset(PRESETS[0].id);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initUI);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GRID_W, GRID_H, EMPTY, BORDER, FILLED,
    createGrid, cloneGrid, clearFill, countCells, bresenham, drawPolygonOutline,
    floodFill, getIntersections, describeRow, formatRow, scanlineFill,
    PRESETS, presetById, buildBase, compareMethods, runTests, runBenchmark
  };
}
