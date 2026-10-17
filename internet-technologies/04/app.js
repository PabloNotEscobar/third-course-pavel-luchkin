const API_URL = 'https://jsonplaceholder.typicode.com/posts';

const state = {
  posts: [],
  isLoading: false,
  isSaving: false,
  error: null,       // ошибка загрузки
  saveError: null,   // ошибка сохранения или удаления
  formError: null,   // ошибка валидации формы
  editingId: null,   // null: создание, число: редактирование записи с этим id
  filter: ''
};

const postForm = document.querySelector('#postForm');
const formTitle = document.querySelector('#formTitle');
const titleInput = document.querySelector('#titleInput');
const bodyInput = document.querySelector('#bodyInput');
const submitButton = document.querySelector('#submitButton');
const cancelButton = document.querySelector('#cancelButton');
const messageElement = document.querySelector('#message');

const loadButton = document.querySelector('#loadButton');
const filterInput = document.querySelector('#filterInput');
const statusElement = document.querySelector('#status');
const postsElement = document.querySelector('#posts');


// 1. Запросы к API

async function sendRequest(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function loadPosts() {
  state.isLoading = true;
  state.error = null;
  render();

  try {
    state.posts = await sendRequest(`${API_URL}?_limit=10`);
  } catch (error) {
    state.error = error.message;
  } finally {
    state.isLoading = false;
    render();
  }
}

function createPost(data) {
  return sendRequest(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

function updatePost(id, data) {
  return sendRequest(`${API_URL}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

function deletePost(id) {
  return sendRequest(`${API_URL}/${id}`, {
    method: 'DELETE'
  });
}


// 2. Изменение состояния после успешных ответов

function addPostToState(created) {
  // JSONPlaceholder на каждый POST возвращает id = 101.
  // Чтобы у записей в state были разные id, выдаём следующий свободный.
  const maxId = state.posts.reduce((max, post) => Math.max(max, post.id), 0);
  const id = state.posts.some((post) => post.id === created.id)
    ? maxId + 1
    : created.id;

  state.posts = [{ ...created, id }, ...state.posts];
}

function updatePostInState(id, updated) {
  state.posts = state.posts.map((post) => {
    return post.id === id ? { ...post, ...updated, id } : post;
  });
}

function removePostFromState(id) {
  state.posts = state.posts.filter((post) => post.id !== id);
}


// 3. Фильтрация

function getFilteredPosts(posts, filter) {
  const normalizedFilter = filter.trim().toLowerCase();

  if (normalizedFilter === '') {
    return posts;
  }

  return posts.filter((post) => {
    return (
      post.title.toLowerCase().includes(normalizedFilter) ||
      post.body.toLowerCase().includes(normalizedFilter)
    );
  });
}


// 4. Форма

function resetForm() {
  state.editingId = null;
  state.formError = null;
  titleInput.value = '';
  bodyInput.value = '';
}

function startEditing(post) {
  if (state.isSaving) {
    return;
  }

  state.editingId = post.id;
  state.formError = null;
  state.saveError = null;
  titleInput.value = post.title;
  bodyInput.value = post.body;
  render();
  titleInput.focus();
}

async function handleSubmit(event) {
  event.preventDefault();

  if (state.isSaving) {
    return;
  }

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title || !body) {
    state.formError = 'Заполните заголовок и текст.';
    render();
    return;
  }

  state.formError = null;
  state.saveError = null;
  state.isSaving = true;
  render();

  try {
    if (state.editingId === null) {
      const created = await createPost({ title, body, userId: 1 });
      addPostToState(created);
    } else {
      const id = state.editingId;
      const updated = await updatePost(id, { title, body });
      updatePostInState(id, updated);
    }

    resetForm();
  } catch (error) {
    state.saveError = `Не удалось сохранить: ${error.message}`;
  } finally {
    state.isSaving = false;
    render();
  }
}

async function handleDelete(id) {
  if (state.isSaving) {
    return;
  }

  state.saveError = null;
  state.isSaving = true;
  render();

  try {
    await deletePost(id);
    removePostFromState(id);

    if (state.editingId === id) {
      resetForm();
    }
  } catch (error) {
    state.saveError = `Не удалось удалить: ${error.message}`;
  } finally {
    state.isSaving = false;
    render();
  }
}


// 5. Отображение

function createPostCard(post) {
  const article = document.createElement('article');
  article.className = 'post-card';

  if (post.id === state.editingId) {
    article.classList.add('editing');
  }

  const id = document.createElement('p');
  id.className = 'post-id';
  id.textContent = `id: ${post.id}`;

  const title = document.createElement('h3');
  title.textContent = post.title;

  const body = document.createElement('p');
  body.textContent = post.body;

  const buttons = document.createElement('div');
  buttons.className = 'post-buttons';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = 'Редактировать';
  editButton.disabled = state.isSaving;
  editButton.addEventListener('click', () => startEditing(post));

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = 'Удалить';
  deleteButton.disabled = state.isSaving;
  deleteButton.addEventListener('click', () => handleDelete(post.id));

  buttons.append(editButton, deleteButton);
  article.append(id, title, body, buttons);

  return article;
}

function renderPosts(posts) {
  postsElement.innerHTML = '';

  for (const post of posts) {
    postsElement.appendChild(createPostCard(post));
  }
}

function renderForm() {
  const isEditing = state.editingId !== null;

  formTitle.textContent = isEditing
    ? `Редактирование публикации ${state.editingId}`
    : 'Новая публикация';

  submitButton.textContent = state.isSaving
    ? 'Сохранение...'
    : isEditing ? 'Сохранить изменения' : 'Сохранить';
  submitButton.disabled = state.isSaving;

  cancelButton.hidden = !isEditing;
  cancelButton.disabled = state.isSaving;

  const message = state.formError || state.saveError || '';
  messageElement.textContent = message;
  messageElement.classList.toggle('error', message !== '');
}

function render() {
  renderForm();

  loadButton.disabled = state.isLoading || state.isSaving;
  statusElement.classList.remove('error');

  if (state.isLoading) {
    statusElement.textContent = 'Загрузка...';
    postsElement.innerHTML = '';
    return;
  }

  if (state.error) {
    statusElement.textContent = `Ошибка загрузки: ${state.error}`;
    statusElement.classList.add('error');
    postsElement.innerHTML = '';
    return;
  }

  if (state.posts.length === 0) {
    statusElement.textContent = 'Публикаций нет.';
    postsElement.innerHTML = '';
    return;
  }

  const filteredPosts = getFilteredPosts(state.posts, state.filter);

  statusElement.textContent =
    `Показано: ${filteredPosts.length} из ${state.posts.length}`;

  renderPosts(filteredPosts);
}


// 6. События

postForm.addEventListener('submit', handleSubmit);

cancelButton.addEventListener('click', () => {
  if (state.isSaving) {
    return;
  }

  resetForm();
  render();
});

loadButton.addEventListener('click', () => {
  loadPosts();
});

filterInput.addEventListener('input', (event) => {
  state.filter = event.target.value;
  render();
});

render();
loadPosts();
