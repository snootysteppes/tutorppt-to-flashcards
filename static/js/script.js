// CONFIRM: Yes, please overwrite the existing file

const questionEl = document.getElementById('question');
const feedbackEl = document.getElementById('feedback');
const correctAnswerEl = document.getElementById('correct-answer');
const answerForm = document.getElementById('answer-form');
const userAnswerInput = document.getElementById('user-answer');
const nextBtn = document.getElementById('next-btn');
const roleEl = document.getElementById('role');
const usernameDisplayEl = document.getElementById('username-display');
const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('content');
const progressBar = document.getElementById('flashcard-progress');
const progressText = document.getElementById('progress-text');
const recapBtn = document.getElementById('recap-btn');

let flashcards = [];
let currentIndex = 0;
let xp = 0;
let streak = 0;
let lastRevisionDate = null;
let username = '';
let title = '';
let subject = '';
let answered = false;
let wrongAnswers = [];

const titles = [
  { name: 'STUDENT', minXp: 0, maxXp: 99, color: 'text-gray-700' },
  { name: 'SCHOLAR', minXp: 100, maxXp: 299, color: 'text-blue-600' },
  { name: 'MENTOR', minXp: 300, maxXp: 599, color: 'text-green-600' },
  { name: 'MASTER', minXp: 600, maxXp: 999, color: 'text-purple-600' },
  { name: 'PROFESSOR', minXp: 1000, maxXp: Infinity, color: 'text-yellow-600' },
];

function showLoading(message = 'Loading flashcards...') {
  loadingEl.querySelector('p').textContent = message;
  loadingEl.classList.remove('hidden');
  contentEl.classList.add('hidden');
}

function hideLoading() {
  loadingEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
}

function showError(message) {
  hideLoading();
  questionEl.innerHTML = `
    <div class="text-red-500 space-y-4">
      <i class="fas fa-exclamation-circle text-4xl"></i>
      <p class="text-xl">${message}</p>
      <button onclick="retryLoading()" class="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
        <i class="fas fa-redo mr-2"></i>Try Again
      </button>
    </div>
  `;
  answerForm.style.display = 'none';
}

function loadFlashcards() {
  showLoading('Loading flashcards...');
  
  const path = `/static/assets/${subject}.txt`;
  
  fetch(path)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load flashcards (${response.status})`);
      }
      return response.text();
    })
    .then(data => {
      // Parse the text file format (question:answer)
      flashcards = data.split('\n').map(line => {
        const [question, answer] = line.split(':');
        return { question, answer };
      }).filter(card => card.question && card.answer);
      
      if (flashcards.length === 0) {
        throw new Error('No flashcards available');
      }
      
      shuffleFlashcards();
      currentIndex = 0;
      hideLoading();
      showFlashcard();
      updateProgress();
    })
    .catch(error => {
      console.error('Error loading flashcards:', error);
      showError('Failed to load flashcards. Please try again.');
    });
}

function shuffleFlashcards() {
  for (let i = flashcards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flashcards[i], flashcards[j]] = [flashcards[j], flashcards[i]];
  }
}

function updateProgress() {
  if (progressBar && progressText) {
    const progress = ((currentIndex + 1) / flashcards.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${currentIndex + 1} / ${flashcards.length}`;
  }
}

function showFlashcard() {
  if (flashcards.length === 0) {
    showError('No flashcards available.');
    return;
  }
  
  const card = flashcards[currentIndex];
  
  if (currentMode === 'quiz') {
    questionEl.textContent = card.question;
    feedbackEl.textContent = '';
    correctAnswerEl.textContent = '';
    correctAnswerEl.classList.add('hidden');
    userAnswerInput.value = '';
    answered = false;
    nextBtn.disabled = true;
    answerForm.style.display = 'flex';
    userAnswerInput.focus();
  } else {
    // Flip mode
    const flipCard = document.querySelector('.flashcard');
    flipCard.classList.remove('rotate-y-180');
    document.getElementById('flip-question').textContent = card.question;
    document.getElementById('flip-answer').textContent = card.answer;
  }
  
  updateProgress();
}

// Mode handling
let currentMode = localStorage.getItem('tutorx_mode') || 'quiz';
const quizModeBtn = document.getElementById('quiz-mode-btn');
const flipModeBtn = document.getElementById('flip-mode-btn');
const quizMode = document.getElementById('quiz-mode');
const flipMode = document.getElementById('flip-mode');

function updateModeButtons() {
  quizModeBtn.className = `px-4 py-2 rounded-lg font-semibold transition-all ${
    currentMode === 'quiz' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
  }`;
  flipModeBtn.className = `px-4 py-2 rounded-lg font-semibold transition-all ${
    currentMode === 'flip' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
  }`;
}

function switchMode(mode) {
  currentMode = mode;
  localStorage.setItem('tutorx_mode', mode);
  updateModeButtons();
  
  if (mode === 'quiz') {
    quizMode.classList.remove('hidden');
    flipMode.classList.add('hidden');
    nextBtn.disabled = !answered;
  } else {
    quizMode.classList.add('hidden');
    flipMode.classList.remove('hidden');
    nextBtn.disabled = false;
    showFlashcard();
  }
}

function normalizeAnswer(answer) {
  return answer
    .toLowerCase()
    .replace(/^(the|a|an) /, '')
    .replace(/\.$/, '')
    .replace(/[.,!?]/g, '')
    .trim();
}

function checkAnswer(userAnswer) {
  const correctAnswer = flashcards[currentIndex].answer;
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  const normalizedUser = normalizeAnswer(userAnswer);
  
  if (normalizedUser === normalizedCorrect) {
    return true;
  }
  
  const correctWords = normalizedCorrect.split(' ').filter(word => word.length > 3);
  const userWords = normalizedUser.split(' ').filter(word => word.length > 0);
  
  return correctWords.length > 0 && correctWords.every(word => 
    userWords.some(userWord => 
      userWord === word || (userWord.length > 3 && (userWord.includes(word) || word.includes(userWord)))
    )
  );
}

function nextFlashcard() {
  currentIndex = (currentIndex + 1) % flashcards.length;
  showFlashcard();
}

// Event Listeners
answerForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (answered) return;
  
  const userAnswer = userAnswerInput.value;
  if (!userAnswer) return;
  
  const isCorrect = checkAnswer(userAnswer);
  
  if (isCorrect) {
    feedbackEl.innerHTML = '<i class="fas fa-check-circle text-green-500 text-2xl mr-2"></i> Correct!';
    feedbackEl.className = 'mt-4 text-lg font-semibold text-green-600 flex items-center justify-center';
    xp += 10;
    localStorage.setItem('tutorx_xp', xp);
    updateTitle();
  } else {
    feedbackEl.innerHTML = '<i class="fas fa-times-circle text-red-500 text-2xl mr-2"></i> Incorrect.';
    feedbackEl.className = 'mt-4 text-lg font-semibold text-red-600 flex items-center justify-center';
    correctAnswerEl.textContent = 'Correct answer: ' + flashcards[currentIndex].answer;
    correctAnswerEl.classList.remove('hidden');
    wrongAnswers.push({
      question: flashcards[currentIndex].question,
      answer: flashcards[currentIndex].answer
    });
    localStorage.setItem('tutorx_wrong_answers', JSON.stringify(wrongAnswers));
  }
  
  answered = true;
  nextBtn.disabled = false;
});

nextBtn?.addEventListener('click', nextFlashcard);

quizModeBtn?.addEventListener('click', () => switchMode('quiz'));
flipModeBtn?.addEventListener('click', () => switchMode('flip'));

// Initialize flip card functionality
const flipCard = document.querySelector('.flashcard');
if (flipCard) {
  flipCard.addEventListener('click', () => {
    flipCard.classList.toggle('rotate-y-180');
  });
}

function updateTitle() {
  const currentTitle = titles.find(t => xp >= t.minXp && xp <= t.maxXp);
  if (currentTitle) {
    title = currentTitle.name;
    roleEl.textContent = title;
    roleEl.className = `role-text uppercase font-bold text-lg ${currentTitle.color}`;
    localStorage.setItem('tutorx_title', title);
  }
}

function checkAuth() {
  username = localStorage.getItem('tutorx_username');
  subject = localStorage.getItem('tutorx_subject');
  if (!username || !subject) {
    window.location.href = 'onboarding.html';
    return;
  }
  
  xp = parseInt(localStorage.getItem('tutorx_xp')) || 0;
  title = localStorage.getItem('tutorx_title') || 'STUDENT';
  updateTitle();
  usernameDisplayEl.textContent = username;
  
  const storedWrongAnswers = localStorage.getItem('tutorx_wrong_answers');
  if (storedWrongAnswers) {
    wrongAnswers = JSON.parse(storedWrongAnswers);
  }
  
  showLoading();
  loadFlashcards();
}

// Initialize
window.addEventListener('load', () => {
  checkAuth();
  updateModeButtons();
  switchMode(currentMode);
});
