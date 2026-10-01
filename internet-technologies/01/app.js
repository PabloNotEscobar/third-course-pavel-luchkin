let value = 0;

const valueEl = document.querySelector('#value');
const statusEl = document.querySelector('#status');
const increaseBtn = document.querySelector('#increase');
const decreaseBtn = document.querySelector('#decrease');
const resetBtn = document.querySelector('#reset');

function render() {
  valueEl.textContent = value;

  if (value > 0) {
    statusEl.textContent = 'Число положительное';
  } else if (value < 0) {
    statusEl.textContent = 'Число отрицательное';
  } else {
    statusEl.textContent = 'Число равно нулю';
  }
}

increaseBtn.addEventListener('click', () => {
  value += 1;
  render();
});

decreaseBtn.addEventListener('click', () => {
  value -= 1;
  render();
});

resetBtn.addEventListener('click', () => {
  value = 0;
  render();
});

render();
