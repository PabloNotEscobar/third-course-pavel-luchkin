ПРАКТИЧЕСКАЯ РАБОТА №5. REST API НА NODE.JS И EXPRESS

Выбранная сущность: книги (маршрут /api/books). Данные хранятся в массиве в памяти сервера, после перезапуска сервера изменения сбрасываются.

Поля книги: id, title, author, year, available.


УСТАНОВКА И ЗАПУСК

    npm install
    npm start

Сервер запускается на http://localhost:3000. Порт можно задать через переменную PORT, например: PORT=4000 npm start


МАРШРУТЫ

GET /api/info
    Служебная информация, количество книг считается из массива.
    Статусы: 200

GET /api/books
    Список книг, поддерживает фильтры.
    Статусы: 200, 400

GET /api/books/:id
    Одна книга.
    Статусы: 200, 404

POST /api/books
    Создание книги.
    Статусы: 201, 400

Любой неизвестный маршрут
    Ответ: {"error":"Route not found"}
    Статус: 404


QUERY-ПАРАМЕТРЫ ДЛЯ GET /api/books

author     - подстрока в имени автора (регистр не важен)
available  - true или false (наличие книги), другое значение даёт 400
q          - подстрока в названии (регистр не важен)

Параметры можно комбинировать. Без параметров возвращается вся коллекция.

Примеры:

    curl "http://localhost:3000/api/books?available=true"
    curl "http://localhost:3000/api/books?available=true&q=idiot"
    curl -G http://localhost:3000/api/books --data-urlencode "author=толстой"
    curl -G http://localhost:3000/api/books --data-urlencode "author=булгаков" --data-urlencode "available=true"

Примечание: в curl кириллицу в URL нужно кодировать (-G --data-urlencode). Браузер делает это сам.


ПРИМЕРЫ ЗАПРОСОВ

Корректный POST (статус 201):

    curl -X POST http://localhost:3000/api/books \
      -H "Content-Type: application/json" \
      -d '{"title":"Новая книга","author":"Автор","year":2020}'

Ответ:

    {"id":7,"title":"Новая книга","author":"Автор","year":2020,"available":true}

POST без обязательного поля (статус 400):

    curl -i -X POST http://localhost:3000/api/books \
      -H "Content-Type: application/json" \
      -d '{"author":"Автор"}'

Ответ:

    {"error":"title is required"}

Несуществующий ID (статус 404):

    curl -i http://localhost:3000/api/books/999
    ответ: {"error":"Not found"}

Неизвестный маршрут (статус 404):

    curl -i http://localhost:3000/api/does-not-exist
    ответ: {"error":"Route not found"}


ПРОВЕРКА (8 случаев из задания)

1. GET /api/books                       -> 200
2. GET /api/books/3                     -> 200
3. GET /api/books/999                   -> 404
4. GET /api/books?available=true        -> 200
5. GET /api/books?author=... (или q=)   -> 200
6. POST /api/books с title и author     -> 201
7. POST /api/books без title            -> 400
8. GET /api/does-not-exist              -> 404
