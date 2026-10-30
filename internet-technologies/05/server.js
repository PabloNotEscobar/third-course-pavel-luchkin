const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Данные хранятся в памяти процесса. После перезапуска сервера изменения теряются.
const books = [
  { id: 1, title: 'Мастер и Маргарита', author: 'Михаил Булгаков', year: 1967, available: true },
  { id: 2, title: 'Преступление и наказание', author: 'Фёдор Достоевский', year: 1866, available: false },
  { id: 3, title: 'Война и мир', author: 'Лев Толстой', year: 1869, available: true },
  { id: 4, title: 'Анна Каренина', author: 'Лев Толстой', year: 1877, available: false },
  { id: 5, title: 'Собачье сердце', author: 'Михаил Булгаков', year: 1925, available: true },
  { id: 6, title: 'Идиот', author: 'Фёдор Достоевский', year: 1869, available: true }
];

// GET /api/info — служебный маршрут
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Books API',
    version: 1,
    items: books.length
  });
});

// GET /api/books — коллекция с фильтрами ?author=, ?available=, ?q=
app.get('/api/books', (req, res) => {
  const { author, available, q } = req.query;
  let result = books;

  if (author !== undefined) {
    const a = String(author).trim().toLowerCase();
    result = result.filter(book => book.author.toLowerCase().includes(a));
  }

  if (available !== undefined) {
    if (available !== 'true' && available !== 'false') {
      return res.status(400).json({
        error: 'available must be "true" or "false"'
      });
    }
    const expected = available === 'true';
    result = result.filter(book => book.available === expected);
  }

  if (q !== undefined) {
    const text = String(q).trim().toLowerCase();
    result = result.filter(book => book.title.toLowerCase().includes(text));
  }

  res.json(result);
});

// GET /api/books/:id — один объект
app.get('/api/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const book = books.find(item => item.id === id);

  if (!book) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(book);
});

// POST /api/books — создание
app.post('/api/books', (req, res) => {
  const body = req.body ?? {};
  const title = String(body.title ?? '').trim();
  const author = String(body.author ?? '').trim();

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  if (!author) {
    return res.status(400).json({ error: 'author is required' });
  }

  let year = null;
  if (body.year !== undefined) {
    year = Number(body.year);
    if (!Number.isInteger(year) || year < 0 || year > new Date().getFullYear()) {
      return res.status(400).json({ error: 'year must be a valid integer' });
    }
  }

  if (body.available !== undefined && typeof body.available !== 'boolean') {
    return res.status(400).json({ error: 'available must be boolean' });
  }

  const nextId = books.reduce((max, book) => Math.max(max, book.id), 0) + 1;

  const book = {
    id: nextId,
    title,
    author,
    year,
    available: body.available ?? true
  };

  books.push(book);

  res.status(201).json(book);
});

// Некорректный JSON в теле запроса -> 400
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Неизвестный маршрут -> 404 (должен стоять в конце)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
