(function () {
  'use strict';

  const PBKDF2_ITERATIONS = 250000;
  const SALT_LEN = 16;
  const IV_LEN = 12;
  const ENC_URL = './questions.json.enc';

  const state = {
    questions: [],
    mode: null,
    index: 0,
    answered: false,
    encryptedBlob: null,
  };

  const el = {
    lock: document.getElementById('lock-screen'),
    lockForm: document.getElementById('lock-form'),
    password: document.getElementById('password'),
    lockInfo: document.getElementById('lock-info'),
    start: document.getElementById('start-screen'),
    quiz: document.getElementById('quiz-screen'),
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
    el.lock.classList.toggle('hidden', name !== 'lock');
    el.start.classList.toggle('hidden', name !== 'start');
    el.quiz.classList.toggle('hidden', name !== 'quiz');
  }

  // === Crypto ===

  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async function decryptBlob(blob, password) {
    const buf = new Uint8Array(blob);
    const salt = buf.slice(0, SALT_LEN);
    const iv = buf.slice(SALT_LEN, SALT_LEN + IV_LEN);
    const ciphertext = buf.slice(SALT_LEN + IV_LEN);

    const key = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );
    const text = new TextDecoder().decode(plaintext);
    return JSON.parse(text);
  }

  async function fetchEncrypted() {
    const res = await fetch(ENC_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  async function unlock(password) {
    el.lockInfo.textContent = 'Deszyfruję…';
    el.lockInfo.classList.remove('error');
    try {
      if (!state.encryptedBlob) {
        state.encryptedBlob = await fetchEncrypted();
      }
      const data = await decryptBlob(state.encryptedBlob, password);
      state.questions = data;
      el.totalInfo.textContent = `Łącznie ${data.length} pytań.`;
      el.startNumber.max = data.length;
      el.password.value = '';
      el.lockInfo.textContent = '';
      showScreen('start');
    } catch (err) {
      el.lockInfo.textContent = 'Złe hasło lub uszkodzony plik.';
      el.lockInfo.classList.add('error');
      el.password.select();
    }
  }

  // === Quiz ===

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

  function bindEvents() {
    el.lockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pwd = el.password.value;
      if (pwd) unlock(pwd);
    });
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
})();
