document.addEventListener("DOMContentLoaded", () => {

  const quizState = {
    settings: {
      format: 'mcq',
      mode: 'unique',
      categories: ['europe', 'north_america', 'south_america', 'africa', 'asia', 'oceania', 'pride'],
      timerEnabled: false,
      timeLimit: 10
    },
    allFlags: {},
    flagCategory: {},
    poolKeys: [],
    currentFlagCode: null,
    correctCount: 0,
    totalCount: 0,
    timerInterval: null,
    timeLeft: 0,
    isProcessing: false,
    requestId: 0
  };

  const SELF_CONTAINED_CATEGORIES = ['pride', 'international_organisations'];

  // DOM Elements
  const elFlag = document.getElementById("quiz-flag");
  const elCounter = document.getElementById("quiz-counter");
  const elMcqContainer = document.getElementById("quiz-mcq");
  const elWrittenContainer = document.getElementById("quiz-written");
  const elWrittenInput = document.getElementById("written-input");
  const elWrittenSubmit = document.getElementById("written-submit");
  const mcqButtons = document.querySelectorAll(".mcq-btn");

  const elSettingsBtn = document.getElementById("quiz-settings-btn");
  const elModal = document.getElementById("settings-modal");
  const elSettingsSave = document.getElementById("settings-save");

  // Timer DOM
  const timerDisplay = document.getElementById("quiz-timer-display");
  const timerText = document.getElementById("timer-text");
  const timerBarFill = document.getElementById("timer-bar-fill");
  const timerToggleBtn = document.getElementById("timer-toggle-btn");
  const timerSliderContainer = document.getElementById("timer-slider-container");
  const timerSlider = document.getElementById("timer-slider");
  const timerValLabel = document.getElementById("timer-val-label");

  const selectAllCb = document.getElementById("select-all-cats");
  const categoryCbs = document.querySelectorAll('input[name="q-cat"]');

  // Theme toggle
  const themeToggleBtn = document.getElementById("theme-toggle-btn");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    themeToggleBtn.classList.toggle("active", isDark);
    themeToggleBtn.classList.toggle("inactive", !isDark);
    themeToggleBtn.innerText = isDark ? "Dark Mode: ON" : "Dark Mode: OFF";
  }

  applyTheme(localStorage.getItem("vexillum-theme") || "pink");

  themeToggleBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "pink" : "dark";
    applyTheme(next);
    localStorage.setItem("vexillum-theme", next);
  });

  // --- Category Select All Event Listeners ---
  selectAllCb.addEventListener("change", (e) => {
    categoryCbs.forEach(cb => cb.checked = e.target.checked);
  });

  categoryCbs.forEach(cb => {
    cb.addEventListener("change", () => {
      selectAllCb.checked = Array.from(categoryCbs).every(c => c.checked);
    });
  });

  // --- Timer Settings Event Listeners ---
  timerToggleBtn.addEventListener("click", () => {
    const isActive = timerToggleBtn.classList.toggle("active");
    timerToggleBtn.classList.toggle("inactive", !isActive);
    timerToggleBtn.innerText = isActive ? "Timer: ON" : "Timer: OFF";

    if (isActive) {
      timerSliderContainer.classList.remove("disabled");
      timerSlider.disabled = false;
    } else {
      timerSliderContainer.classList.add("disabled");
      timerSlider.disabled = true;
    }
  });

  timerSlider.addEventListener("input", (e) => {
    timerValLabel.innerText = `${e.target.value}s`;
  });

  // --- Synchronizes the DOM Inputs to the active state in memory ---
  function syncSettingsUI() {
    categoryCbs.forEach(cb => {
      cb.checked = quizState.settings.categories.includes(cb.value);
    });
    selectAllCb.checked = Array.from(categoryCbs).every(c => c.checked);

    document.querySelectorAll('input[name="q-format"]').forEach(r => r.checked = r.value === quizState.settings.format);
    document.querySelectorAll('input[name="q-mode"]').forEach(r => r.checked = r.value === quizState.settings.mode);

    timerSlider.value = quizState.settings.timeLimit;
    timerValLabel.innerText = `${quizState.settings.timeLimit}s`;

    if (quizState.settings.timerEnabled) {
      timerToggleBtn.classList.add("active");
      timerToggleBtn.classList.remove("inactive");
      timerToggleBtn.innerText = "Timer: ON";
      timerSliderContainer.classList.remove("disabled");
      timerSlider.disabled = false;
    } else {
      timerToggleBtn.classList.remove("active");
      timerToggleBtn.classList.add("inactive");
      timerToggleBtn.innerText = "Timer: OFF";
      timerSliderContainer.classList.add("disabled");
      timerSlider.disabled = true;
    }
  }

  function normalizeString(str) { return str.toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async function applySettingsAndStart() {
    clearTimer();
    elModal.classList.remove("active");

    quizState.settings.format = document.querySelector('input[name="q-format"]:checked').value;
    quizState.settings.mode = document.querySelector('input[name="q-mode"]:checked').value;
    quizState.settings.timerEnabled = timerToggleBtn.classList.contains("active");
    quizState.settings.timeLimit = parseInt(timerSlider.value, 10);

    quizState.settings.categories = Array.from(categoryCbs)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    if (quizState.settings.format === 'mcq') {
      elMcqContainer.style.display = 'grid';
      elWrittenContainer.style.display = 'none';
    } else {
      elMcqContainer.style.display = 'none';
      elWrittenContainer.style.display = 'flex';
    }

    elCounter.style.visibility = (quizState.settings.mode === 'unique') ? 'visible' : 'hidden';
    timerDisplay.style.display = quizState.settings.timerEnabled ? 'flex' : 'none';

    const requestId = ++quizState.requestId;

    const freshFlags = {};
    const freshFlagCategory = {};
    for (const cat of quizState.settings.categories) {
      try {
        const res = await fetch(`api/en/${cat}.json`);
        if (res.ok) {
          const data = await res.json();
          Object.assign(freshFlags, data);
          Object.keys(data).forEach(code => { freshFlagCategory[code] = cat; });
        }
      } catch (err) {
        console.error(`Failed to load ${cat}.json`, err);
      }
    }

    if (requestId !== quizState.requestId) return;

    quizState.allFlags = freshFlags;
    quizState.flagCategory = freshFlagCategory;

    if (Object.keys(quizState.allFlags).length === 0) {
      elFlag.src = "";
      elFlag.alt = "No Flags Loaded. Select categories in settings.";
      return;
    }

    quizState.poolKeys = Object.keys(quizState.allFlags);
    if (quizState.settings.mode === 'unique') shuffleArray(quizState.poolKeys);
    quizState.totalCount = quizState.poolKeys.length;
    quizState.correctCount = 0;

    loadNextFlag();
  }

  // --- Timer Controls ---
  function startTimer() {
    clearTimer();
    if (!quizState.settings.timerEnabled) return;

    quizState.timeLeft = quizState.settings.timeLimit;
    timerText.innerText = `${quizState.timeLeft}s`;
    timerBarFill.style.width = '100%';
    timerBarFill.style.backgroundColor = '#22c55e';

    const stepMs = 100;
    let elapsedMs = 0;
    const totalMs = quizState.settings.timeLimit * 1000;

    quizState.timerInterval = setInterval(() => {
      elapsedMs += stepMs;
      const remainingMs = Math.max(0, totalMs - elapsedMs);
      quizState.timeLeft = Math.ceil(remainingMs / 1000);

      const percent = (remainingMs / totalMs) * 100;
      timerBarFill.style.width = `${percent}%`;
      timerText.innerText = `${quizState.timeLeft}s`;

      if (percent < 30) timerBarFill.style.backgroundColor = '#ef4444';
      else if (percent < 60) timerBarFill.style.backgroundColor = '#eab308';
      else timerBarFill.style.backgroundColor = '#22c55e';

      if (remainingMs <= 0) {
        clearTimer();
        const target = quizState.settings.format === 'mcq' ? elMcqContainer : elWrittenInput;
        handleAnswer(false, target, quizState.allFlags[quizState.currentFlagCode]);
      }
    }, stepMs);
  }

  function clearTimer() {
    if (quizState.timerInterval) {
      clearInterval(quizState.timerInterval);
      quizState.timerInterval = null;
    }
  }

  function loadNextFlag() {
    clearTimer();

    if (quizState.settings.mode === 'unique' && quizState.poolKeys.length === 0) {
      elFlag.src = "";
      elFlag.alt = `Quiz Complete! You got ${quizState.correctCount} / ${quizState.totalCount}`;
      elCounter.innerText = "Done!";
      elMcqContainer.style.display = 'none';
      elWrittenContainer.style.display = 'none';
      timerDisplay.style.display = 'none';
      return;
    }

    if (quizState.settings.mode === 'unique') {
      quizState.currentFlagCode = quizState.poolKeys.pop();
      const currentNumber = (quizState.totalCount - quizState.poolKeys.length);
      elCounter.innerText = `${currentNumber} / ${quizState.totalCount}`;
    } else {
      const randomIndex = Math.floor(Math.random() * quizState.poolKeys.length);
      quizState.currentFlagCode = quizState.poolKeys[randomIndex];
    }

    elFlag.src = `api/svg/${quizState.currentFlagCode}.svg`;
    elFlag.alt = "Guess this flag";

    if (quizState.settings.format === 'mcq') setupMCQ();
    else setupWritten();

    startTimer();
  }

  function setupMCQ() {
    const currentCategory = quizState.flagCategory[quizState.currentFlagCode];
    const restrictToOwnCategory = SELF_CONTAINED_CATEGORIES.includes(currentCategory);

    const candidateKeys = restrictToOwnCategory
      ? Object.keys(quizState.allFlags).filter(code => quizState.flagCategory[code] === currentCategory)
      : Object.keys(quizState.allFlags);

    let options = [quizState.currentFlagCode];

    while (options.length < 4 && options.length < candidateKeys.length) {
      const rand = candidateKeys[Math.floor(Math.random() * candidateKeys.length)];
      if (!options.includes(rand)) options.push(rand);
    }

    options = shuffleArray(options);

    mcqButtons.forEach((btn, idx) => {
      btn.className = "quiz-btn mcq-btn";
      if (options[idx]) {
        btn.style.display = "block";
        btn.innerText = quizState.allFlags[options[idx]];
        btn.dataset.code = options[idx];
      } else {
        btn.style.display = "none";
      }
    });
  }

  function setupWritten() {
    elWrittenInput.value = "";
    elWrittenInput.className = "";
    elWrittenInput.focus();
  }

  function handleAnswer(isCorrect, targetElement, correctStringValue) {
    if (quizState.isProcessing) return;
    quizState.isProcessing = true;
    clearTimer();

    if (isCorrect) {
      if (quizState.settings.mode === 'unique') quizState.correctCount++;
      targetElement.classList.add("correct-flash");
    } else {
      if (targetElement && targetElement !== elMcqContainer) {
        targetElement.classList.add("wrong-flash");
      }

      if (quizState.settings.format === 'mcq') {
        mcqButtons.forEach(btn => {
          if (btn.dataset.code === quizState.currentFlagCode) {
            btn.classList.add("correct-flash");
          }
        });
      } else {
        elWrittenInput.value = `Wrong. It was: ${correctStringValue}`;
      }
    }

    setTimeout(() => {
      quizState.isProcessing = false;
      loadNextFlag();
    }, 1000);
  }

  mcqButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      handleAnswer((btn.dataset.code === quizState.currentFlagCode), btn);
    });
  });

  function submitWritten() {
    if (quizState.isProcessing) return;
    const guess = normalizeString(elWrittenInput.value);
    const actual = normalizeString(quizState.allFlags[quizState.currentFlagCode]);
    handleAnswer((guess === actual), elWrittenInput, quizState.allFlags[quizState.currentFlagCode]);
  }

  elWrittenSubmit.addEventListener("click", submitWritten);
  elWrittenInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitWritten();
  });

  elSettingsBtn.addEventListener("click", () => {
    syncSettingsUI();
    elModal.classList.add("active");
  });

  window.addEventListener("click", (e) => {
    if (e.target === elModal) {
      elModal.classList.remove("active");
      syncSettingsUI();
    }
  });

  elSettingsSave.addEventListener("click", applySettingsAndStart);

  syncSettingsUI();
  applySettingsAndStart();
});