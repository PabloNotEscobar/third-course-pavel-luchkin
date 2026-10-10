const API_URL = 'https://jsonplaceholder.typicode.com/users';

const state = {
  users: [],
  isLoading: false,
  error: null,
  filter: ''
};

const loadButton = document.querySelector('#loadButton');
const reloadButton = document.querySelector('#reloadButton');
const filterInput = document.querySelector('#filterInput');

const statusElement = document.querySelector('#status');
const statisticsElement = document.querySelector('#statistics');
const usersElement = document.querySelector('#users');


// 1. Загрузка данных

async function loadUsers() {
  state.isLoading = true;
  state.error = null;
  render();

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const users = await response.json();
    state.users = users;
  } catch (error) {
    state.error = error.message;
  } finally {
    state.isLoading = false;
    render();
  }
}


// 2. Фильтрация

function getFilteredUsers(users, filter) {
  const normalizedFilter = filter.trim().toLowerCase();

  if (normalizedFilter === '') {
    return users;
  }

  return users.filter((user) => {
    return (
      user.name.toLowerCase().includes(normalizedFilter) ||
      user.username.toLowerCase().includes(normalizedFilter) ||
      user.email.toLowerCase().includes(normalizedFilter)
    );
  });
}


// 3. Карточка пользователя

function createUserCard(user) {
  const article = document.createElement('article');
  article.className = 'user-card';

  const name = document.createElement('h3');
  name.textContent = user.name;

  const username = document.createElement('p');
  username.className = 'username';
  username.textContent = `@${user.username}`;

  const email = document.createElement('p');
  email.textContent = user.email;

  const city = document.createElement('p');
  city.textContent = `Город: ${user.address.city}`;

  const company = document.createElement('p');
  company.textContent = `Компания: ${user.company.name}`;

  article.append(name, username, email, city, company);

  return article;
}


// 4. Статистика

function getStatistics(users, filteredUsers) {
  const uniqueCities = new Set(users.map((user) => user.address.city));

  return {
    total: users.length,
    visible: filteredUsers.length,
    uniqueCities: uniqueCities.size
  };
}


// 5. Отображение

function render() {
  usersElement.innerHTML = '';
  statisticsElement.textContent = '';

  if (state.isLoading) {
    statusElement.textContent = 'Загрузка...';
    statusElement.classList.remove('error');
    return;
  }

  if (state.error) {
    statusElement.textContent = `Ошибка загрузки: ${state.error}`;
    statusElement.classList.add('error');
    return;
  }

  if (state.users.length === 0) {
    statusElement.textContent = 'Данные ещё не загружены.';
    statusElement.classList.remove('error');
    return;
  }

  statusElement.textContent = '';
  statusElement.classList.remove('error');

  const filteredUsers = getFilteredUsers(state.users, state.filter);

  for (const user of filteredUsers) {
    usersElement.appendChild(createUserCard(user));
  }

  const stats = getStatistics(state.users, filteredUsers);
  statisticsElement.textContent =
    `Всего: ${stats.total}. Показано: ${stats.visible}. Городов: ${stats.uniqueCities}.`;
}


// 6. События

loadButton.addEventListener('click', () => {
  loadUsers();
});

reloadButton.addEventListener('click', () => {
  loadUsers();
});

filterInput.addEventListener('input', (event) => {
  state.filter = event.target.value;
  render();
});

render();
