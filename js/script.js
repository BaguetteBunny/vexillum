document.addEventListener("DOMContentLoaded", () => {

  const quizState = {
    settings: {
      format: 'mcq',
      mode: 'unique',
      categories: ['europe', 'north_america', 'south_america', 'africa', 'asia', 'oceania', 'pride'],
      timerEnabled: false,
      timeLimit: 10,
      scoreEnabled: false
    },
    allFlags: {},
    flagCategory: {},
    poolKeys: [],
    currentFlagCode: null,
    correctCount: 0,
    totalCount: 0,
    currentScore: 0,
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
  const timerMultLabel = document.getElementById("timer-mult-label");

  // Scoring DOM
  const scoringToggleBtn = document.getElementById("scoring-toggle-btn");
  const quizScoreBadge = document.getElementById("quiz-score-badge");
  const outerScoreVal = document.getElementById("outer-score-val");
  const modalPtsPerFlag = document.getElementById("modal-pts-per-flag");
  const modalCurrentScore = document.getElementById("modal-current-score");

  const selectAllCb = document.getElementById("select-all-cats");
  const categoryCbs = document.querySelectorAll('input[name="q-cat"]');
  const formatRadios = document.querySelectorAll('input[name="q-format"]');

  // --- Category Select All Event Listeners ---
  selectAllCb.addEventListener("change", (e) => {
    categoryCbs.forEach(cb => cb.checked = e.target.checked);
    updateModalPreview();
  });

  categoryCbs.forEach(cb => {
    cb.addEventListener("change", () => {
      selectAllCb.checked = Array.from(categoryCbs).every(c => c.checked);
      updateModalPreview();
    });
  });

  formatRadios.forEach(radio => {
    radio.addEventListener('change', updateModalPreview);
  });

  // --- Timer Multiplier Logic ---
  function getTimerMult(timeValue) {
    return (1.0 + ((20 - timeValue) * 0.1)).toFixed(1);
  }

  // --- Timer & Scoring Settings Event Listeners ---
  timerToggleBtn.addEventListener("click", () => {
    const isActive = timerToggleBtn.classList.toggle("active");
    timerToggleBtn.classList.toggle("inactive", !isActive);
    timerToggleBtn.innerText = isActive ? "Timer: ON" : "Timer: OFF";
    
    if (isActive) {
      timerSliderContainer.classList.remove("disabled");
      timerSlider.disabled = false;
      timerMultLabel.style.display = "inline";
      timerMultLabel.innerText = `(x${getTimerMult(parseInt(timerSlider.value, 10))})`;
    } else {
      timerSliderContainer.classList.add("disabled");
      timerSlider.disabled = true;
      timerMultLabel.style.display = "none";
    }
    updateModalPreview();
  });

  timerSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    timerValLabel.innerText = `${val}s`;
    timerMultLabel.innerText = `(x${getTimerMult(val)})`;
    updateModalPreview();
  });

  scoringToggleBtn.addEventListener("click", () => {
    const isActive = scoringToggleBtn.classList.toggle("active");
    scoringToggleBtn.classList.toggle("inactive", !isActive);
    scoringToggleBtn.innerText = isActive ? "Scoring Enabled" : "Enable Scoring";
    updateModalPreview();
  });

  // --- Point Calculations ---
  function calculatePreviewPtsPerFlag() {
    if (!scoringToggleBtn.classList.contains("active")) return 0;
    
    let baseScore = 0;
    categoryCbs.forEach(cb => {
      if (cb.checked) baseScore += parseInt(cb.dataset.pts, 10);
    });

    const format = document.querySelector('input[name="q-format"]:checked').value;
    const formatMult = format === 'written' ? 2.0 : 1.0;

    let timerMult = 1.0;
    if (timerToggleBtn.classList.contains("active")) {
      timerMult = parseFloat(getTimerMult(parseInt(timerSlider.value, 10)));
    }

    return Math.round(baseScore * formatMult * timerMult);
  }

  function getPtsPerFlagFromState() {
    if (!quizState.settings.scoreEnabled) return 0;
    let baseScore = 0;
    quizState.settings.categories.forEach(cat => {
      const cb = document.querySelector(`input[name="q-cat"][value="${cat}"]`);
      if (cb) baseScore += parseInt(cb.dataset.pts, 10);
    });

    const formatMult = quizState.settings.format === 'written' ? 2.0 : 1.0;
    let timerMult = 1.0;
    if (quizState.settings.timerEnabled) {
      timerMult = parseFloat(getTimerMult(quizState.settings.timeLimit));
    }
    return Math.round(baseScore * formatMult * timerMult);
  }

  function updateModalPreview() {
    const pts = calculatePreviewPtsPerFlag();
    modalPtsPerFlag.innerText = `${pts} pts`;
  }

  function updateScoreDisplay() {
    outerScoreVal.innerText = quizState.currentScore;
    modalCurrentScore.innerText = quizState.currentScore;
    quizScoreBadge.style.display = quizState.settings.scoreEnabled ? "block" : "none";
  }

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
      timerMultLabel.style.display = "inline";
      timerMultLabel.innerText = `(x${getTimerMult(quizState.settings.timeLimit)})`;
    } else {
      timerToggleBtn.classList.remove("active");
      timerToggleBtn.classList.add("inactive");
      timerToggleBtn.innerText = "Timer: OFF";
      timerSliderContainer.classList.add("disabled");
      timerSlider.disabled = true;
      timerMultLabel.style.display = "none";
    }

    if (quizState.settings.scoreEnabled) {
      scoringToggleBtn.classList.add("active");
      scoringToggleBtn.classList.remove("inactive");
      scoringToggleBtn.innerText = "Scoring Enabled";
    } else {
      scoringToggleBtn.classList.remove("active");
      scoringToggleBtn.classList.add("inactive");
      scoringToggleBtn.innerText = "Enable Scoring";
    }

    updateModalPreview();
  }

function handleRouting() {
  let hash = window.location.hash.replace("#/", "").toLowerCase();
  let pathname = window.location.pathname.replace("/", "").toLowerCase();
  
  let currentRoute = hash || pathname;
  if (!currentRoute || currentRoute === "" || currentRoute === "index.html") {
    currentRoute = "quiz";
  }

  document.querySelectorAll(".view").forEach(sec => sec.classList.remove("active"));
  
  let activeView = document.getElementById(`view-${currentRoute}`);
  if (!activeView) {
    currentRoute = "quiz";
    activeView = document.getElementById("view-quiz");
  }
  
  activeView.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(link => {
    link.classList.toggle("active", link.getAttribute("data-route") === currentRoute);
  });

  if (currentRoute === "quiz" && Object.keys(quizState.allFlags).length === 0) {
    syncSettingsUI(); 
    applySettingsAndStart(); 
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
    quizState.settings.scoreEnabled = scoringToggleBtn.classList.contains("active");
    
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

    quizState.currentScore = 0;
    updateScoreDisplay();

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
      if (quizState.settings.scoreEnabled) {
        quizState.currentScore += getPtsPerFlagFromState();
        updateScoreDisplay();
      }
      targetElement.classList.add("correct-flash");
    } else {
      if (targetElement && targetElement !== elMcqContainer) {
        targetElement.classList.add("wrong-flash");
      }
      quizState.currentScore = 0;
      updateScoreDisplay();

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

  window.addEventListener("hashchange", handleRouting);

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

  handleRouting();
});