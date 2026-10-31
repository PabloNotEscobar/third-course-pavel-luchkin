const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');

// ---------------------------------------------------------------------
// База данных
// ---------------------------------------------------------------------

const db = new Database(DB_PATH);

// Таблица создаётся автоматически при первом запуске
db.prepare(
  'CREATE TABLE IF NOT EXISTS books (' +
  'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
  'title TEXT NOT NULL, ' +
  'author TEXT NOT NULL, ' +
  'year INTEGER, ' +
  'available INTEGER NOT NULL DEFAULT 1' +
  ')'
).run();

// LIKE в SQLite нечувствителен к регистру только для ASCII, поэтому для
// кириллицы приводим текст к нижнему регистру собственной SQL-функцией.
db.function('lower_u', { deterministic: true }, value =>
  value === null ? null : String(value).toLowerCase()
);

// Начальные данные добавляются только в пустую таблицу
const count = db.prepare('SELECT COUNT(*) AS n FROM books').get().n;
if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO books (title, author, year, available) VALUES (?, ?, ?, ?)'
  );
  const seed = [
    ['Мастер и Маргарита', 'Михаил Булгаков', 1967, 1],
    ['Преступление и наказание', 'Фёдор Достоевский', 1866, 0],
    ['Война и мир', 'Лев Толстой', 1869, 1],
    ['Анна Каренина', 'Лев Толстой', 1877, 0],
    ['Собачье сердце', 'Михаил Булгаков', 1925, 1],
    ['Идиот', 'Фёдор Достоевский', 1869, 1]
  ];
  db.transaction(() => {
    for (const row of seed) insert.run(...row);
  })();
}

const SELECT_COLUMNS = 'id, title, author, year, available';

// В БД available хранится как 0/1, в API отдаётся как boolean
function toBook(row) {
  return { ...row, available: Boolean(row.available) };
}

// Экранирование служебных символов LIKE (% и _), чтобы поиск был буквальным
function likePattern(text) {
  return '%' + String(text).trim().toLowerCase().replace(/[\\%_]/g, ch => '\\' + ch) + '%';
}

// ---------------------------------------------------------------------
// Валидация
// ---------------------------------------------------------------------

function parseId(raw) {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Проверка полей для POST и PATCH.
 * partial = true (PATCH): проверяются только переданные поля.
 * Возвращает { error } или { values } с очищенными значениями.
 */
function validateBook(body, partial) {
  if (!isObject(body)) {
    return { error: 'JSON object expected in request body' };
  }

  const values = {};

  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return { error: 'title is required and must be a non-empty string' };
    }
    values.title = body.title.trim();
  }

  if (!partial || body.author !== undefined) {
    if (typeof body.author !== 'string' || !body.author.trim()) {
      return { error: 'author is required and must be a non-empty string' };
    }
    values.author = body.author.trim();
  }

  if (body.year !== undefined) {
    const maxYear = new Date().getFullYear();
    if (body.year === null) {
      values.year = null;
    } else if (!Number.isInteger(body.year) || body.year < 0 || body.year > maxYear) {
      return { error: `year must be an integer from 0 to ${maxYear} or null` };
    } else {
      values.year = body.year;
    }
  }

  if (body.available !== undefined) {
    if (typeof body.available !== 'boolean') {
      return { error: 'available must be boolean' };
    }
    values.available = body.available;
  }

  if (partial && Object.keys(values).length === 0) {
    return { error: 'no valid fields to update (title, author, year, available)' };
  }

  return { values };
}

// ---------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------

const app = express();
app.use(express.json());

// GET /api/books?available=true&author=...&q=...
app.get('/api/books', (req, res) => {
  const { available, author, q } = req.query;
  const conditions = [];
  const params = [];

  if (available !== undefined) {
    if (available !== 'true' && available !== 'false') {
      return res.status(400).json({ error: 'available must be "true" or "false"' });
    }
    conditions.push('available = ?');
    params.push(available === 'true' ? 1 : 0);
  }

  if (author !== undefined) {
    conditions.push("lower_u(author) LIKE ? ESCAPE '\\'");
    params.push(likePattern(author));
  }

  if (q !== undefined) {
    conditions.push("lower_u(title) LIKE ? ESCAPE '\\'");
    params.push(likePattern(q));
  }

  // Условия — константные фрагменты SQL, значения клиента идут только через ?
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM books${where} ORDER BY id`)
    .all(...params);

  res.json(rows.map(toBook));
});

// GET /api/books/:id
app.get('/api/books/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'id must be a positive integer' });
  }

  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM books WHERE id = ?`).get(id);
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(toBook(row));
});

// POST /api/books
app.post('/api/books', (req, res) => {
  const { error, values } = validateBook(req.body, false);
  if (error) {
    return res.status(400).json({ error });
  }

  const result = db
    .prepare('INSERT INTO books (title, author, year, available) VALUES (?, ?, ?, ?)')
    .run(values.title, values.author, values.year ?? null, values.available === false ? 0 : 1);

  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM books WHERE id = ?`)
    .get(result.lastInsertRowid);

  res.status(201).json(toBook(row));
});

// PATCH /api/books/:id — частичное обновление
app.patch('/api/books/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'id must be a positive integer' });
  }

  const current = db.prepare(`SELECT ${SELECT_COLUMNS} FROM books WHERE id = ?`).get(id);
  if (!current) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { error, values } = validateBook(req.body, true);
  if (error) {
    return res.status(400).json({ error });
  }

  const title = values.title ?? current.title;
  const author = values.author ?? current.author;
  const year = values.year !== undefined ? values.year : current.year;
  const available = values.available !== undefined ? (values.available ? 1 : 0) : current.available;

  db.prepare('UPDATE books SET title = ?, author = ?, year = ?, available = ? WHERE id = ?')
    .run(title, author, year, available, id);

  const updated = db.prepare(`SELECT ${SELECT_COLUMNS} FROM books WHERE id = ?`).get(id);
  res.json(toBook(updated));
});

// DELETE /api/books/:id
app.delete('/api/books/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'id must be a positive integer' });
  }

  const result = db.prepare('DELETE FROM books WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.status(204).end();
});

// Неизвестный маршрут -> 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Ошибки: некорректный JSON -> 400, всё остальное -> 500 (без деталей клиенту)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}, database: ${DB_PATH}`);
});

// Корректное завершение: закрываем сервер и базу
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
