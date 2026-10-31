ПРАКТИЧЕСКАЯ РАБОТА №6. REST API С SQLITE

Продолжение ЛР5: сущность книги (маршрут /api/books). Данные теперь хранятся в SQLite (файл data.db) и сохраняются после перезапуска сервера.

Стек: Node.js, Express, better-sqlite3.


УСТАНОВКА И ЗАПУСК

    npm install
    npm start

Сервер запускается на http://localhost:3000. Порт задаётся переменной PORT, файл базы переменной DB_PATH (по умолчанию data.db рядом с server.js).

Файл data.db создаётся автоматически при первом запуске. Таблица создаётся командой CREATE TABLE IF NOT EXISTS, а в пустую таблицу добавляются 6 начальных книг (при повторных запусках они не добавляются). Чтобы начать с чистой базы, остановите сервер и удалите data.db.

Автоматическая проверка (запуск сервера, запросы, перезапуск, проверка сохранения, ошибочные случаи):

    npm run check


СХЕМА ТАБЛИЦЫ

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      year INTEGER,
      available INTEGER NOT NULL DEFAULT 1
    );

id        - первичный ключ, выдаётся базой
title     - основное текстовое поле
author    - второе содержательное поле
year      - год издания, может быть null
available - в базе 0 или 1, в JSON true или false (поле для фильтрации)


МАРШРУТЫ

Метод   URL               SQL      Успешный код   Ошибки
GET     /api/books        SELECT   200            400 (неверный available)
GET     /api/books/:id    SELECT   200            400 (id не число), 404
POST    /api/books        INSERT   201            400
PATCH   /api/books/:id    UPDATE   200            400, 404
DELETE  /api/books/:id    DELETE   204            400 (id не число), 404

Любой неизвестный маршрут: 404, {"error":"Route not found"}
Некорректный JSON в теле запроса: 400.
Непредвиденная ошибка сервера или базы: 500, {"error":"Internal server error"} (без деталей для клиента).


QUERY-ПАРАМЕТРЫ GET /api/books

available - true или false, иначе 400.  SQL: WHERE available = ?
author    - подстрока в имени автора, регистр не важен.  SQL: WHERE lower_u(author) LIKE ?
q         - подстрока в названии, регистр не важен.  SQL: WHERE lower_u(title) LIKE ?

Параметры можно комбинировать (условия объединяются через AND). Все фильтры выполняются в самой базе.

Примеры:

    curl "http://localhost:3000/api/books?available=true"
    curl -G http://localhost:3000/api/books --data-urlencode "author=толстой"
    curl -G http://localhost:3000/api/books --data-urlencode "author=Булгаков" --data-urlencode "available=true"

Примечание: lower_u это SQL-функция, зарегистрированная в server.js. Встроенный LIKE в SQLite нечувствителен к регистру только для латиницы, а для кириллицы нет, поэтому текст приводится к нижнему регистру на стороне SQLite. Символы % и _ в поисковой строке экранируются (ESCAPE) и ищутся буквально.


ПРАВИЛА ВАЛИДАЦИИ (POST И PATCH)

title      - строка, после trim() не пустая. Обязательна в POST. Ошибка: 400.
author     - строка, после trim() не пустая. Обязательна в POST. Ошибка: 400.
year       - целое число от 0 до текущего года или null. Необязательное. Ошибка: 400.
available  - только boolean (true или false), по умолчанию true. Необязательное. Ошибка: 400.
тело запроса - должно быть JSON-объектом. В PATCH нужно хотя бы одно допустимое поле. Ошибка: 400.

В PATCH проверяются только переданные поля, остальные не меняются. Все значения клиента передаются в SQL только параметрами (?). В GET /api/books в строку запроса подставляются лишь фиксированные фрагменты WHERE из кода сервера, а значения идут через ?.


ПРИМЕРЫ

POST (статус 201):

    curl -X POST http://localhost:3000/api/books \
      -H "Content-Type: application/json" \
      -d '{"title":"Новая книга","author":"Автор","year":2020}'

Ответ:

    {"id":7,"title":"Новая книга","author":"Автор","year":2020,"available":true}

PATCH (статус 200), изменение только одного поля:

    curl -X PATCH http://localhost:3000/api/books/7 \
      -H "Content-Type: application/json" \
      -d '{"available":false}'

Ответ:

    {"id":7,"title":"Новая книга","author":"Автор","year":2020,"available":false}

Ошибочный POST (статус 400):

    curl -i -X POST http://localhost:3000/api/books \
      -H "Content-Type: application/json" \
      -d '{"author":"Автор"}'

Ответ:

    {"error":"title is required and must be a non-empty string"}

DELETE (статус 204, тела ответа нет) и повторный DELETE (статус 404):

    curl -i -X DELETE http://localhost:3000/api/books/7
    curl -i -X DELETE http://localhost:3000/api/books/7


ПРОВЕРКА СОХРАНЕНИЯ ПОСЛЕ ПЕРЕЗАПУСКА

Выполнена автоматически (npm run check) и повторяется вручную:

1. npm start
2. POST с телом {"title":"Новая книга","author":"Автор","year":2020}  ->  201, id = 7
3. GET http://localhost:3000/api/books/7  ->  200
4. Остановить сервер (Ctrl+C)
5. npm start
6. GET http://localhost:3000/api/books/7  ->  200, запись на месте

Результат npm run check: все проверки пройдены. Запись, созданная и изменённая через PATCH, сохраняется после остановки и повторного запуска. Начальные данные не дублируются (после перезапуска ровно 7 записей).


РЕЗУЛЬТАТЫ ПРОВЕРКИ ОШИБОЧНЫХ СЛУЧАЕВ

GET /api/books/999                     ожидание 404, результат 404
POST без title                         ожидание 400, результат 400
POST с пустым title                    ожидание 400, результат 400
POST с year: "abc"                     ожидание 400, результат 400
POST с некорректным JSON               ожидание 400, результат 400
PATCH /api/books/999                   ожидание 404, результат 404
PATCH с пустым title                   ожидание 400, результат 400
PATCH с пустым телом                   ожидание 400, результат 400
DELETE /api/books/999                  ожидание 404, результат 404
GET /api/does-not-exist                ожидание 404, результат 404
GET ?available=maybe                   ожидание 400, результат 400
GET ?q=' OR 1=1 -- (проба инъекции)    ожидание 200 и пустой список, результат 200, []


СТРУКТУРА

06/
    package.json
    server.js     (сервер, база, маршруты)
    check.js      (автоматическая проверка, npm run check)
    README.md
    .gitignore    (node_modules/, data.db)
