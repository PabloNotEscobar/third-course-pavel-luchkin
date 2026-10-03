const values = [];

const input = document.querySelector('#numberInput');
const errorEl = document.querySelector('#error');
const listEl = document.querySelector('#list');
const countEl = document.querySelector('#count');
const sumEl = document.querySelector('#sum');
const averageEl = document.querySelector('#average');
const minEl = document.querySelector('#min');
const maxEl = document.querySelector('#max');

function addValue(value) {
  values.push(value);
}

function removeLastValue() {
  values.pop();
}

function clearValues() {
  values.length = 0;
}

function getStatistics(values) {
  const count = values.length;

  if (count === 0) {
    return {
      count: 0,
      sum: 0,
      min: null,
      max: null,
      average: null,
    };
  }

  let sum = 0;
  let min = values[0];
  let max = values[0];

  for (const value of values) {
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return {
    count,
    sum,
    min,
    max,
    average: sum / count,
  };
}

function render() {
  listEl.innerHTML = '';
  for (const value of values) {
    const li = document.createElement('li');
    li.textContent = value;
    listEl.appendChild(li);
  }

  const stats = getStatistics(values);

  countEl.textContent = stats.count;
  sumEl.textContent = stats.sum;
  averageEl.textContent = stats.average === null ? '—' : stats.average.toFixed(2);
  minEl.textContent = stats.min === null ? '—' : stats.min;
  maxEl.textContent = stats.max === null ? '—' : stats.max;
}

function showError(message) {
  errorEl.textContent = message;
}

document.querySelector('#addBtn').addEventListener('click', () => {
  const raw = input.value.trim();
  const value = Number(raw);

  if (raw === '' || !Number.isFinite(value)) {
    showError('Введите корректное число');
    return;
  }

  showError('');
  addValue(value);
  input.value = '';
  render();
});

document.querySelector('#removeLastBtn').addEventListener('click', () => {
  showError('');
  removeLastValue();
  render();
});

document.querySelector('#clearBtn').addEventListener('click', () => {
  showError('');
  clearValues();
  render();
});

render();
