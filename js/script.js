document.addEventListener("DOMContentLoaded", () => {

  const quizState = {
    settings: { format: 'mcq', mode: 'unique', categories: [] },
    allFlags: {},
    poolKeys: [],
    currentFlagCode: null,
    correctCount: 0,
    totalCount: 0,
    isProcessing: false 
  };

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

  function handleRouting() {
    let hash = window.location.hash.replace("#/", "").toLowerCase();
    let pathname = window.location.pathname.replace("/", "").toLowerCase();
    let currentRoute = hash || pathname;

    // Toggle active view
    document.querySelectorAll(".view").forEach(sec => sec.classList.remove("active"));
    const activeView = document.getElementById(`view-${currentRoute}`);
    if (activeView) activeView.classList.add("active");

    // Update Sidebar highlight
    document.querySelectorAll(".nav-item").forEach(link => {
      link.classList.toggle("active", link.getAttribute("data-route") === currentRoute);
    });

    // Auto-start quiz on first visit to the quiz tab
    if (currentRoute === "quiz" && Object.keys(quizState.allFlags).length === 0) {
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
    elModal.classList.remove("active");

    // Extract values from DOM
    quizState.settings.format = document.querySelector('input[name="q-format"]:checked').value;
    quizState.settings.mode = document.querySelector('input[name="q-mode"]:checked').value;
    
    quizState.settings.categories = Array.from(
      document.querySelectorAll('input[name="q-cat"]:checked')
    ).map(cb => cb.value);

    // Swap UI Layout
    if (quizState.settings.format === 'mcq') {
      elMcqContainer.style.display = 'grid';
      elWrittenContainer.style.display = 'none';
    } else {
      elMcqContainer.style.display = 'none';
      elWrittenContainer.style.display = 'flex';
    }

    // Toggle Counter visibility
    elCounter.style.visibility = (quizState.settings.mode === 'unique') ? 'visible' : 'hidden';

    // Fetch required JSONs and merge into allFlags
    quizState.allFlags = {};
    for (const cat of quizState.settings.categories) {
      try {
        const res = await fetch(`api/en/${cat}.json`);
        if(res.ok) {
          const data = await res.json();
          Object.assign(quizState.allFlags, data);
        }
      } catch (err) {
        console.error(`Failed to load ${cat}.json`, err);
      }
    }

    // Safety fallback if no categories selected or files failed
    if (Object.keys(quizState.allFlags).length === 0) {
      elFlag.src = "";
      elFlag.alt = "No Flags Loaded. Check Categories.";
      return;
    }

    // Reset Tracking Variables
    quizState.poolKeys = Object.keys(quizState.allFlags);
    if (quizState.settings.mode === 'unique') {
      shuffleArray(quizState.poolKeys);
    }
    quizState.totalCount = quizState.poolKeys.length;
    quizState.correctCount = 0;

    loadNextFlag();
  }

  function loadNextFlag() {
    if (quizState.settings.mode === 'unique' && quizState.poolKeys.length === 0) {
      elFlag.src = "";
      elFlag.alt = `Quiz Complete! You got ${quizState.correctCount} / ${quizState.totalCount}`;
      elCounter.innerText = "Done!";
      elMcqContainer.style.display = 'none';
      elWrittenContainer.style.display = 'none';
      return;
    }

    // Pick Flag
    if (quizState.settings.mode === 'unique') {
      quizState.currentFlagCode = quizState.poolKeys.pop();
      // Update Counter
      const currentNumber = (quizState.totalCount - quizState.poolKeys.length);
      elCounter.innerText = `${currentNumber} / ${quizState.totalCount}`;
    } else {
      // Random Repeats Mode
      const randomIndex = Math.floor(Math.random() * quizState.poolKeys.length);
      quizState.currentFlagCode = quizState.poolKeys[randomIndex];
    }

    // Set Image
    elFlag.src = `api/svg/${quizState.currentFlagCode}.svg`;
    elFlag.alt = "Guess this flag";
    
    // Setup Controls
    if (quizState.settings.format === 'mcq') {
      setupMCQ();
    } else {
      setupWritten();
    }
  }

  function setupMCQ() {
    const allKeys = Object.keys(quizState.allFlags);
    let options = [quizState.currentFlagCode];
    
    // Pick 3 random wrong answers
    while (options.length < 4 && options.length < allKeys.length) {
      const rand = allKeys[Math.floor(Math.random() * allKeys.length)];
      if (!options.includes(rand)) {
        options.push(rand);
      }
    }
    
    options = shuffleArray(options);

    mcqButtons.forEach((btn, idx) => {
      // Clear previous flash states
      btn.className = "quiz-btn mcq-btn";
      
      if (options[idx]) {
        btn.style.display = "block";
        btn.innerText = quizState.allFlags[options[idx]];
        btn.dataset.code = options[idx];
      } else {
        btn.style.display = "none"; // Hide if less than 4 total flags exist in the pool
      }
    });
  }

  function setupWritten() {
    elWrittenInput.value = "";
    elWrittenInput.className = ""; // clear flashes
    elWrittenInput.focus();
  }

  function handleAnswer(isCorrect, targetElement, correctStringValue) {
    if (quizState.isProcessing) return;
    quizState.isProcessing = true;

    if (isCorrect && quizState.settings.mode === 'unique') {
      quizState.correctCount++;
    }

    // Flash Colors
    if (isCorrect) {
      targetElement.classList.add("correct-flash");
    } else {
      targetElement.classList.add("wrong-flash");
      // Highlight correct MCQ answer
      if (quizState.settings.format === 'mcq') {
        mcqButtons.forEach(btn => {
          if (btn.dataset.code === quizState.currentFlagCode) {
            btn.classList.add("correct-flash");
          }
        });
      } else {
         // Written mode: temporarily show correct answer
         const originalVal = elWrittenInput.value;
         elWrittenInput.value = `Wrong. It was: ${correctStringValue}`;
      }
    }

    // Wait 1 second before moving on
    setTimeout(() => {
      quizState.isProcessing = false;
      loadNextFlag();
    }, 1000);
  }

  window.addEventListener("hashchange", handleRouting);

  // MCQ Buttons
  mcqButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const isCorrect = (btn.dataset.code === quizState.currentFlagCode);
      handleAnswer(isCorrect, btn);
    });
  });

  // Written Submit / Enter Key
  function submitWritten() {
    if (quizState.isProcessing) return;
    const guess = normalizeString(elWrittenInput.value);
    const actual = normalizeString(quizState.allFlags[quizState.currentFlagCode]);
    
    const isCorrect = (guess === actual);
    handleAnswer(isCorrect, elWrittenInput, quizState.allFlags[quizState.currentFlagCode]);
  }
  
  elWrittenSubmit.addEventListener("click", submitWritten);
  elWrittenInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitWritten();
  });

  // Settings Modal Controls
  elSettingsBtn.addEventListener("click", () => { elModal.classList.add("active"); });
  elSettingsSave.addEventListener("click", applySettingsAndStart);

  // Kickoff on page load
  handleRouting();
});