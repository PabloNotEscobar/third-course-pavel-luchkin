# Практическая работа №5. REST API на Node.js и Express

Сущность — **книги** (`/api/books`). Данные хранятся в массиве в памяти сервера (после перезапуска сбрасываются).

Поля книги: `id`, `title`, `author`, `year`, `available`.

## Установка и запуск

```bash
npm install
npm start
```

Сервер стартует на `http://localhost:3000` (порт можно задать через `PORT`, например `PORT=4000 npm start`).

## Маршруты

| Метод | URL | Описание | Возможные статусы |
|---|---|---|---|
| GET | /api/info | служебная информация (количество книг считается из массива) | 200 |
| GET | /api/books | список книг, поддерживает фильтры | 200, 400 |
| GET | /api/books/:id | одна книга | 200, 404 |
| POST | /api/books | создание книги | 201, 400 |
| любой | неизвестный маршрут | `{"error":"Route not found"}` | 404 |

## Query-параметры для `GET /api/books`

| Параметр | Описание |
|---|---|
| `author` | подстрока в имени автора (без учёта регистра) |
| `available` | `true` / `false` — наличие книги; другое значение → 400 |
| `q` | подстрока в названии (без учёта регистра) |

Параметры можно комбинировать. Без параметров возвращается вся коллекция.

```bash
curl "http://localhost:3000/api/books?available=true"
curl "http://localhost:3000/api/books?available=true&q=idiot"
curl -G http://localhost:3000/api/books --data-urlencode "author=толстой"
curl -G http://localhost:3000/api/books --data-urlencode "author=булгаков" --data-urlencode "available=true"
```

> В `curl` кириллицу в URL нужно кодировать (`-G --data-urlencode`); браузер делает это сам.

## Примеры запросов

Корректный POST (статус `201`):

```bash
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Новая книга","author":"Автор","year":2020}'
```

Ответ:

```json
{ "id": 7, "title": "Новая книга", "author": "Автор", "year": 2020, "available": true }
```

POST без обязательного поля (статус `400`):

```bash
curl -i -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"author":"Автор"}'
```

```json
{ "error": "title is required" }
```

Несуществующий ID (статус `404`) и неизвестный маршрут (статус `404`):

```bash
curl -i http://localhost:3000/api/books/999        # {"error":"Not found"}
curl -i http://localhost:3000/api/does-not-exist   # {"error":"Route not found"}
```

## Проверка (все 8 случаев из задания)

| № | Запрос | Статус |
|---|---|---|
| 1 | `GET /api/books` | 200 |
| 2 | `GET /api/books/3` | 200 |
| 3 | `GET /api/books/999` | 404 |
| 4 | `GET /api/books?available=true` | 200 |
| 5 | `GET /api/books?author=...` (или `?q=...`) | 200 |
| 6 | `POST /api/books` с `title` и `author` | 201 |
| 7 | `POST /api/books` без `title` | 400 |
| 8 | `GET /api/does-not-exist` | 404 |
