(function () {
  'use strict';

  const state = {
    questions: [],
    mode: null,
    index: 0,
    answered: false,
  };

  const el = {
    start: document.getElementById('start-screen'),
    quiz: document.getElementById('quiz-screen'),
    loader: document.getElementById('loader'),
    totalInfo: document.getElementById('total-info'),
    startNumber: document.getElementById('start-number'),
    sectionLabel: document.getElementById('section-label'),
    counter: document.getElementById('counter'),
    backToMenu: document.getElementById('back-to-menu'),
    questionImage: document.getElementById('question-image'),
    questionText: document.getElementById('question-text'),
    options: document.getElementById('options'),
    nextBtn: document.getElementById('next-btn'),
    prevBtn: document.getElementById('prev-btn'),
  };

  function showScreen(name) {
    el.start.classList.toggle('hidden', name !== 'start');
    el.quiz.classList.toggle('hidden', name !== 'quiz');
  }

  function startMode(mode) {
    state.mode = mode;
    if (mode === 'seq') {
      const n = parseInt(el.startNumber.value, 10) || 1;
      const clamped = Math.max(1, Math.min(state.questions.length, n));
      state.index = clamped - 1;
    } else {
      state.index = randomIndex();
    }
    state.answered = false;
    showScreen('quiz');
    render();
  }

  function randomIndex() {
    return Math.floor(Math.random() * state.questions.length);
  }

  function render() {
    const q = state.questions[state.index];
    if (!q) return;

    el.sectionLabel.textContent = `Sekcja ${q.section_roman}`;
    el.counter.textContent = state.mode === 'seq'
      ? `${q.number} / ${state.questions.length}`
      : `nr ${q.number}`;

    if (q.question_image) {
      el.questionImage.src = q.question_image;
      el.questionImage.classList.remove('hidden');
    } else {
      el.questionImage.classList.add('hidden');
      el.questionImage.removeAttribute('src');
    }

    el.questionText.textContent = q.question;

    el.options.innerHTML = '';
    q.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.type = 'button';

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = opt.label;
      btn.appendChild(label);

      if (opt.image) {
        const img = document.createElement('img');
        img.src = opt.image;
        img.alt = `Opcja ${opt.label}`;
        btn.appendChild(img);
      } else {
        const text = document.createElement('span');
        text.className = 'text';
        text.textContent = opt.text;
        btn.appendChild(text);
      }

      btn.addEventListener('click', () => handleAnswer(opt, btn));
      el.options.appendChild(btn);
    });

    state.answered = false;
    el.nextBtn.classList.add('hidden');
    el.prevBtn.classList.toggle('hidden', state.mode !== 'seq' || state.index === 0);
  }

  function handleAnswer(option, button) {
    if (state.answered) return;
    state.answered = true;

    const buttons = el.options.querySelectorAll('.option');
    const opts = state.questions[state.index].options;

    buttons.forEach((b, i) => {
      b.classList.add('locked');
      if (opts[i].is_correct) b.classList.add('correct');
    });

    if (!option.is_correct) {
      button.classList.add('wrong');
    }

    el.nextBtn.classList.remove('hidden');
  }

  function next() {
    if (state.mode === 'seq') {
      if (state.index >= state.questions.length - 1) {
        state.index = 0;
      } else {
        state.index += 1;
      }
    } else {
      state.index = randomIndex();
    }
    render();
  }

  function prev() {
    if (state.mode !== 'seq' || state.index === 0) return;
    state.index -= 1;
    render();
  }

  function backToMenu() {
    showScreen('start');
  }

  async function loadQuestions() {
    try {
      const res = await fetch('./questions.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.questions = data;
      el.loader.classList.add('hidden');
      el.totalInfo.textContent = `Łącznie ${data.length} pytań.`;
      el.startNumber.max = data.length;
    } catch (err) {
      el.loader.textContent = `Błąd wczytywania: ${err.message}`;
    }
  }

  function bindEvents() {
    document.querySelectorAll('[data-mode]').forEach((b) => {
      b.addEventListener('click', () => startMode(b.dataset.mode));
    });
    el.nextBtn.addEventListener('click', next);
    el.prevBtn.addEventListener('click', prev);
    el.backToMenu.addEventListener('click', backToMenu);
    el.startNumber.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') startMode('seq');
    });
  }

  bindEvents();
  loadQuestions();
})();
