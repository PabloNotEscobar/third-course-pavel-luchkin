// Автоматическая проверка из задания (части 6 и 7): npm run check
// Запускает сервер на временной БД, делает запросы, перезапускает сервер
// и проверяет, что данные сохранились.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3456;
const BASE = `http://localhost:${PORT}`;
const DB_FILE = path.join(os.tmpdir(), `books-check-${Date.now()}.db`);

let failed = 0;

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(PORT), DB_PATH: DB_FILE }
    });
    child.on('error', reject);
    child.stderr.on('data', d => process.stderr.write(d));
    child.stdout.on('data', d => {
      if (String(d).includes('Server started')) resolve(child);
    });
  });
}

function stopServer(child) {
  return new Promise(resolve => {
    child.on('exit', resolve);
    child.kill('SIGTERM');
  });
}

async function call(method, url, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(BASE + url, options);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* не JSON */ }
  return { status: res.status, json };
}

function check(name, ok, details) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${details ? ' — ' + details : ''}`);
}

async function main() {
  let server = await startServer();

  console.log('--- CRUD и фильтры ---');
  let r = await call('GET', '/api/books');
  check('GET /api/books', r.status === 200 && r.json.length === 6, `${r.status}, записей: ${r.json.length}`);
  check('available — boolean', typeof r.json[0].available === 'boolean');

  r = await call('GET', '/api/books/3');
  check('GET /api/books/3', r.status === 200 && r.json.title === 'Война и мир', String(r.status));

  r = await call('GET', '/api/books?available=false');
  check('GET ?available=false', r.status === 200 && r.json.length === 2 && r.json.every(b => b.available === false), `записей: ${r.json.length}`);

  r = await call('GET', '/api/books?author=' + encodeURIComponent('толстой'));
  check('GET ?author=толстой (регистр не важен)', r.status === 200 && r.json.length === 2, `записей: ${r.json.length}`);

  r = await call('GET', '/api/books?available=true&author=' + encodeURIComponent('Булгаков') + '&q=' + encodeURIComponent('собачье'));
  check('GET ?available&author&q вместе', r.status === 200 && r.json.length === 1 && r.json[0].id === 5, `записей: ${r.json.length}`);

  r = await call('GET', '/api/books?q=' + encodeURIComponent("' OR 1=1 --"));
  check('SQL-инъекция в q не срабатывает', r.status === 200 && r.json.length === 0, `записей: ${r.json.length}`);

  r = await call('GET', '/api/books?q=%25');
  check('символ % в q ищется буквально', r.status === 200 && r.json.length === 0, `записей: ${r.json.length}`);

  r = await call('GET', '/api/books?available=maybe');
  check('GET ?available=maybe → 400', r.status === 400, String(r.status));

  console.log('--- Проверка сохранения (часть 6) ---');
  r = await call('POST', '/api/books', { title: 'Новая книга', author: 'Автор', year: 2020 });
  const newId = r.json && r.json.id;
  check('POST корректный → 201', r.status === 201 && newId === 7 && r.json.available === true, `${r.status}, id=${newId}`);

  r = await call('PATCH', `/api/books/${newId}`, { available: false });
  check('PATCH available=false → 200', r.status === 200 && r.json.available === false && r.json.title === 'Новая книга', String(r.status));

  r = await call('GET', `/api/books/${newId}`);
  check('GET созданной записи', r.status === 200 && r.json.title === 'Новая книга', String(r.status));

  await stopServer(server);
  console.log('    сервер остановлен');
  server = await startServer();
  console.log('    сервер запущен снова');

  r = await call('GET', `/api/books/${newId}`);
  check('GET после перезапуска — запись сохранилась', r.status === 200 && r.json.title === 'Новая книга' && r.json.available === false, String(r.status));

  r = await call('GET', '/api/books');
  check('после перезапуска записей 7 (seed не дублируется)', r.json.length === 7, `записей: ${r.json.length}`);

  console.log('--- Ошибочные случаи (часть 7) ---');
  r = await call('GET', '/api/books/999');
  check('GET несуществующего ID → 404', r.status === 404, String(r.status));

  r = await call('POST', '/api/books', { author: 'Автор' });
  check('POST без title → 400', r.status === 400, String(r.status));

  r = await call('POST', '/api/books', { title: '   ', author: 'Автор' });
  check('POST с пустым title → 400', r.status === 400, String(r.status));

  r = await call('POST', '/api/books', { title: 'X', author: 'Y', year: 'abc' });
  check('POST с year="abc" → 400', r.status === 400, String(r.status));

  r = await call('POST', '/api/books', '{bad json');
  check('POST с битым JSON → 400', r.status === 400, String(r.status));

  r = await call('PATCH', '/api/books/999', { title: 'X' });
  check('PATCH несуществующего ID → 404', r.status === 404, String(r.status));

  r = await call('PATCH', `/api/books/${newId}`, { title: '' });
  check('PATCH с пустым title → 400', r.status === 400, String(r.status));

  r = await call('PATCH', `/api/books/${newId}`, {});
  check('PATCH без полей → 400', r.status === 400, String(r.status));

  r = await call('DELETE', '/api/books/999');
  check('DELETE несуществующего ID → 404', r.status === 404, String(r.status));

  r = await call('GET', '/api/does-not-exist');
  check('неизвестный маршрут → 404', r.status === 404, String(r.status));

  console.log('--- DELETE ---');
  r = await call('DELETE', `/api/books/${newId}`);
  check('DELETE существующей записи → 204', r.status === 204, String(r.status));

  r = await call('GET', `/api/books/${newId}`);
  check('GET удалённой записи → 404', r.status === 404, String(r.status));

  await stopServer(server);
  fs.rmSync(DB_FILE, { force: true });

  console.log(failed === 0 ? '\nВсе проверки пройдены' : `\nНе пройдено проверок: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
