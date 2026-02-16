const year = new Date().getFullYear();
const footer = document.querySelector('.footer .brand');
if (footer) {
  footer.setAttribute('aria-label', `Physics Mentor © ${year}`);
}

const problemCards = document.querySelectorAll('.practice-card');

problemCards.forEach((card) => {
  const button = card.querySelector('.check-answer');
  const input = card.querySelector('input');
  const feedback = card.querySelector('.feedback');
  const expected = Number(card.dataset.answer);
  const unit = card.dataset.unit;

  button?.addEventListener('click', () => {
    const submitted = Number(input.value);

    if (Number.isNaN(submitted)) {
      feedback.textContent = 'Enter a numeric answer to get feedback.';
      feedback.classList.add('incorrect');
      feedback.classList.remove('correct');
      return;
    }

    const tolerance = Math.max(0.01, Math.abs(expected) * 0.02);
    const isCorrect = Math.abs(submitted - expected) <= tolerance;

    if (isCorrect) {
      feedback.textContent = `Nice work. ${submitted} ${unit} is correct.`;
      feedback.classList.add('correct');
      feedback.classList.remove('incorrect');
    } else {
      feedback.textContent = `Not quite. Review the model and try again (target: ${expected} ${unit}).`;
      feedback.classList.add('incorrect');
      feedback.classList.remove('correct');
    }
  });
});


const AUTH_STORAGE_KEY = 'physicsMentorAuthSession';
const PROFILE_STORAGE_KEY = 'physicsMentorAccountProfiles';
const LANDING_PAGE = 'landing';
const DASHBOARD_PAGE = 'dashboard';
const pageType = document.body?.dataset?.page || '';
const authConfig = window.PHYSICS_MENTOR_AUTH || {};
const firebaseApiKey = authConfig.firebaseApiKey || '';
const hasFirebaseApiKey = Boolean(firebaseApiKey);

let authSession = loadSession();
let authElements;

initAuthUI();

function loadSession() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.idToken || !parsed?.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    if (Number(parsed.expiresAt) <= Date.now()) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

async function callFirebaseAuth(endpoint, payload) {
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${firebaseApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      const code = data?.error?.message;
      return {
        ok: false,
        message: mapFirebaseError(code),
      };
    }

    return {
      ok: true,
      data,
    };
  } catch {
    return {
      ok: false,
      message: 'Unable to connect to Firebase right now. Check your connection and try again.',
    };
  }
}

function mapFirebaseError(errorCode) {
  switch (errorCode) {
    case 'EMAIL_EXISTS':
      return 'An account with that email already exists. Try signing in instead.';
    case 'INVALID_EMAIL':
      return 'Please enter a valid email address.';
    case 'OPERATION_NOT_ALLOWED':
      return 'Email/password authentication is not enabled. Contact support.';
    case 'WEAK_PASSWORD : Password should be at least 6 characters':
    case 'WEAK_PASSWORD':
      return 'Password is too weak. Use at least 6 characters.';
    case 'EMAIL_NOT_FOUND':
      return 'No account exists for that email. Try creating an account first.';
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'INVALID_PASSWORD':
      return 'Incorrect email or password. Please try again.';
    case 'USER_DISABLED':
      return 'This account is disabled. Contact support.';
    default:
      return 'Authentication failed. Please try again.';
  }
}


function initAuthUI() {
  const navWrap = document.querySelector('.nav-wrap');
  if (!navWrap) {
    return;
  }

  const authButton = findOrCreateNavButton(navWrap, {
    className: 'auth-trigger',
    fallbackText: 'Sign in with email',
  });
  const authTriggers = document.querySelectorAll('.auth-trigger');

  const accountButton =
    pageType === DASHBOARD_PAGE
      ? findOrCreateNavButton(navWrap, {
          className: 'account-trigger',
          fallbackText: 'Account hub',
        })
      : null;
  const accountTriggers = document.querySelectorAll('.account-trigger');

  const authModal = buildAuthModal();
  const accountModal = pageType === DASHBOARD_PAGE ? buildAccountModal() : null;
  if (accountModal) {
    document.body.append(authModal, accountModal);
  } else {
    document.body.append(authModal);
  }

  const authForm = authModal.querySelector('.auth-form');
  const authMessage = authModal.querySelector('.auth-message');
  const authCloseButton = authModal.querySelector('.auth-close');
  const signOutButton = authModal.querySelector('.auth-signout');

  const accountCloseButton = accountModal?.querySelector('.account-close');
  const accountMessage = accountModal?.querySelector('.account-message');
  const accountForm = accountModal?.querySelector('.account-form');
  const accountSummary = accountModal?.querySelector('.account-summary');

  authElements = {
    authButton,
    accountButton,
    authModal,
    authForm,
    authMessage,
    signOutButton,
    accountModal,
    accountMessage,
    accountForm,
    accountSummary,
  };

  authTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      setAuthMessage('');
      authModal.showModal();
      renderAuthState();
    });
  });

  authCloseButton.addEventListener('click', () => {
    authModal.close();
  });

  accountTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      if (!accountModal) {
        return;
      }

      setAccountMessage('');
      populateAccountForm();
      accountModal.showModal();
    });
  });

  accountCloseButton?.addEventListener('click', () => {
    accountModal.close();
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitter = event.submitter;
    const mode = submitter?.dataset.mode;
    if (!mode) {
      return;
    }

    if (!hasFirebaseApiKey) {
      setAuthMessage('Sign-in is not configured yet. Add your Firebase Web API key first.', true);
      return;
    }

    const formData = new FormData(authForm);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    if (!email || !password) {
      setAuthMessage('Enter both email and password.', true);
      return;
    }

    submitter.disabled = true;
    setAuthMessage(mode === 'signup' ? 'Creating your account…' : 'Signing you in…');

    const endpoint = mode === 'signup' ? 'accounts:signUp' : 'accounts:signInWithPassword';
    const result = await callFirebaseAuth(endpoint, {
      email,
      password,
      returnSecureToken: true,
    });

    submitter.disabled = false;

    if (!result.ok) {
      setAuthMessage(result.message, true);
      return;
    }

    authSession = {
      email: result.data.email,
      idToken: result.data.idToken,
      refreshToken: result.data.refreshToken,
      expiresAt: Date.now() + Number(result.data.expiresIn || 0) * 1000,
    };

    saveSession(authSession);
    ensureAccountProfile(authSession.email);

    const successMessage =
      mode === 'signup'
        ? `Account created. You are signed in as ${authSession.email}.`
        : `Welcome back, ${authSession.email}.`;

    setAuthMessage(successMessage);
    populateAccountForm();
    renderAuthState();

    if (pageType === LANDING_PAGE) {
      window.location.href = 'dashboard.html';
    }
  });

  signOutButton.addEventListener('click', () => {
    authSession = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthMessage('You have been signed out.');
    renderAuthState();
  });

  accountForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!authSession?.email) {
      setAccountMessage('Sign in first to manage account progress.', true);
      return;
    }

    const formData = new FormData(accountForm);
    const profile = {
      displayName: String(formData.get('displayName') || '').trim(),
      studyGoal: String(formData.get('studyGoal') || '').trim(),
      weeklyTargetHours: Number(formData.get('weeklyTargetHours') || 0),
      physics1Mastery: Number(formData.get('physics1Mastery') || 0),
      physics2Mastery: Number(formData.get('physics2Mastery') || 0),
      currentStreak: Number(formData.get('currentStreak') || 0),
      notes: String(formData.get('notes') || '').trim(),
      updatedAt: new Date().toISOString(),
    };

    saveAccountProfile(authSession.email, profile);
    populateAccountForm();
    setAccountMessage('Account profile and progress saved.', false);
  });

  renderAuthState();
}

function findOrCreateNavButton(navWrap, options) {
  const buttonClass = options.className;
  const existingButton = navWrap.querySelector(`.${buttonClass}`);

  if (existingButton) {
    return existingButton;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `secondary ${buttonClass}`;
  button.textContent = options.fallbackText;

  const ctaLink = navWrap.querySelector('.cta-link');
  if (ctaLink) {
    navWrap.insertBefore(button, ctaLink);
  } else {
    navWrap.appendChild(button);
  }

  return button;
}

function buildAuthModal() {
  const authModal = document.createElement('dialog');
  authModal.className = 'auth-modal';
  authModal.innerHTML = `
    <form class="auth-form" method="dialog">
      <div class="auth-head">
        <h2>Email sign in</h2>
        <button class="auth-close" type="button" aria-label="Close sign-in modal">✕</button>
      </div>
      <p class="auth-description">Use your email and password to sign in or create an account.</p>
      <p class="auth-message" aria-live="polite"></p>
      <label>
        Email
        <input class="auth-input" name="email" type="email" autocomplete="email" required />
      </label>
      <label>
        Password
        <input class="auth-input" name="password" type="password" autocomplete="current-password" minlength="6" required />
      </label>
      <div class="auth-actions">
        <button class="primary" data-mode="signin" type="submit">Sign in</button>
        <button class="secondary" data-mode="signup" type="submit">Create account</button>
      </div>
      <button class="auth-signout secondary" type="button">Sign out</button>
      <p class="auth-helper">To enable auth, set <code>window.PHYSICS_MENTOR_AUTH.firebaseApiKey</code> in your HTML before loading <code>script.js</code>.</p>
    </form>
  `;
  return authModal;
}

function buildAccountModal() {
  const accountModal = document.createElement('dialog');
  accountModal.className = 'auth-modal account-modal';
  accountModal.innerHTML = `
    <form class="auth-form account-form" method="dialog">
      <div class="auth-head">
        <h2>Account hub</h2>
        <button class="account-close auth-close" type="button" aria-label="Close account modal">✕</button>
      </div>
      <p class="auth-description">Track account details, study plan, and progress separately from sign-in credentials.</p>
      <p class="account-message auth-message" aria-live="polite"></p>
      <div class="account-summary"></div>
      <label>
        Display name
        <input class="auth-input" name="displayName" type="text" placeholder="Your preferred name" />
      </label>
      <label>
        Study goal
        <input class="auth-input" name="studyGoal" type="text" placeholder="Ex: Score 5 on AP Physics" />
      </label>
      <label>
        Weekly target hours
        <input class="auth-input" name="weeklyTargetHours" type="number" min="0" max="80" />
      </label>
      <div class="account-progress-grid">
        <label>
          Physics 1 mastery (%)
          <input class="auth-input" name="physics1Mastery" type="number" min="0" max="100" />
        </label>
        <label>
          Physics 2 mastery (%)
          <input class="auth-input" name="physics2Mastery" type="number" min="0" max="100" />
        </label>
        <label>
          Current streak (days)
          <input class="auth-input" name="currentStreak" type="number" min="0" max="365" />
        </label>
      </div>
      <label>
        Notes
        <textarea name="notes" placeholder="Add reminders, weak areas, and next steps..."></textarea>
      </label>
      <div class="auth-actions">
        <button class="primary" type="submit">Save account profile</button>
      </div>
    </form>
  `;

  return accountModal;
}

function renderAuthState() {
  if (!authElements) {
    return;
  }

  const { authButton, accountButton, signOutButton } = authElements;
  const isSignedIn = Boolean(authSession?.email);

  if (pageType === DASHBOARD_PAGE && !isSignedIn) {
    window.location.href = 'index.html';
    return;
  }

  authButton.textContent = isSignedIn ? authSession.email : 'Sign in with email';
  if (accountButton) {
    accountButton.textContent = isSignedIn ? 'Account hub' : 'Account hub (sign in first)';
  }
  signOutButton.style.display = isSignedIn ? 'inline-flex' : 'none';

  if (!isSignedIn) {
    setAccountSummary('Sign in to create and track your account profile, goals, and progress.');
  } else {
    populateAccountForm();
  }

  updateDashboardView();
}

function populateAccountForm() {
  if (!authElements) {
    return;
  }

  const { accountForm } = authElements;
  if (!accountForm) {
    return;
  }

  if (!authSession?.email) {
    accountForm.reset();
    setAccountSummary('Sign in to create and track your account profile, goals, and progress.');
    return;
  }

  const profile = ensureAccountProfile(authSession.email);

  accountForm.elements.displayName.value = profile.displayName || '';
  accountForm.elements.studyGoal.value = profile.studyGoal || '';
  accountForm.elements.weeklyTargetHours.value = profile.weeklyTargetHours || 0;
  accountForm.elements.physics1Mastery.value = profile.physics1Mastery || 0;
  accountForm.elements.physics2Mastery.value = profile.physics2Mastery || 0;
  accountForm.elements.currentStreak.value = profile.currentStreak || 0;
  accountForm.elements.notes.value = profile.notes || '';

  const displayName = profile.displayName || authSession.email;
  const updatedLabel = profile.updatedAt
    ? `Last updated: ${new Date(profile.updatedAt).toLocaleString()}`
    : 'No saved updates yet.';

  setAccountSummary(`<strong>${displayName}</strong> · ${authSession.email}<br>${updatedLabel}`);
}

function setAuthMessage(message, isError = false) {
  if (!authElements) {
    return;
  }

  authElements.authMessage.textContent = message;
  authElements.authMessage.classList.toggle('error', isError);
  authElements.authMessage.classList.toggle('success', !isError && Boolean(message));
}

function setAccountMessage(message, isError = false) {
  if (!authElements) {
    return;
  }

  authElements.accountMessage.textContent = message;
  authElements.accountMessage.classList.toggle('error', isError);
  authElements.accountMessage.classList.toggle('success', !isError && Boolean(message));
}

function setAccountSummary(html) {
  if (!authElements?.accountSummary) {
    return;
  }

  authElements.accountSummary.innerHTML = html;
}

function updateDashboardView() {
  if (pageType !== DASHBOARD_PAGE || !authSession?.email) {
    return;
  }

  const profile = ensureAccountProfile(authSession.email);
  const displayName = profile.displayName || authSession.email;

  const greeting = document.getElementById('dashboardGreeting');
  const goal = document.getElementById('dashboardGoal');
  const weeklyTargetSummary = document.getElementById('weeklyTargetSummary');
  const streakSummary = document.getElementById('streakSummary');
  const notesSummary = document.getElementById('notesSummary');
  const physics1MasteryLabel = document.getElementById('physics1MasteryLabel');
  const physics2MasteryLabel = document.getElementById('physics2MasteryLabel');
  const physics1ProgressFill = document.getElementById('physics1ProgressFill');
  const physics2ProgressFill = document.getElementById('physics2ProgressFill');

  if (greeting) {
    greeting.textContent = `Welcome back, ${displayName}.`;
  }

  if (goal) {
    goal.textContent = profile.studyGoal
      ? `Current goal: ${profile.studyGoal}`
      : 'Add a study goal in Account hub to personalize your dashboard.';
  }

  if (weeklyTargetSummary) {
    weeklyTargetSummary.textContent = `Target: ${profile.weeklyTargetHours || 0} study hours`;
  }

  if (streakSummary) {
    streakSummary.textContent = `Current streak: ${profile.currentStreak || 0} days`;
  }

  if (notesSummary) {
    notesSummary.textContent = profile.notes
      ? profile.notes
      : 'No notes saved yet. Open Account hub to add reminders and weak areas.';
  }

  if (physics1MasteryLabel) {
    physics1MasteryLabel.textContent = `${profile.physics1Mastery || 0}%`;
  }

  if (physics2MasteryLabel) {
    physics2MasteryLabel.textContent = `${profile.physics2Mastery || 0}%`;
  }

  if (physics1ProgressFill) {
    physics1ProgressFill.style.width = `${profile.physics1Mastery || 0}%`;
  }

  if (physics2ProgressFill) {
    physics2ProgressFill.style.width = `${profile.physics2Mastery || 0}%`;
  }
}


function loadAllProfiles() {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    return {};
  }
}

function ensureAccountProfile(email) {
  const allProfiles = loadAllProfiles();

  if (!allProfiles[email]) {
    allProfiles[email] = {
      displayName: '',
      studyGoal: '',
      weeklyTargetHours: 4,
      physics1Mastery: 0,
      physics2Mastery: 0,
      currentStreak: 0,
      notes: '',
      updatedAt: '',
    };

    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(allProfiles));
  }

  return allProfiles[email];
}

function saveAccountProfile(email, profile) {
  const allProfiles = loadAllProfiles();
  allProfiles[email] = profile;
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(allProfiles));
}

initKinematicsPage();

function initKinematicsPage() {
  const root = document.querySelector('[data-kinematics-root]');
  if (!root) {
    return;
  }

  const STORAGE_KEY = 'physicsMentorKinematicsProgressV1';
  const ideaWeight = 30;
  const passStreakTarget = 5;
  const progressLabel = root.querySelector('[data-kinematics-progress-label]');
  const progressBar = root.querySelector('[data-kinematics-progress-bar]');
  const finalStatusLabel = root.querySelector('[data-final-status]');

  const quizBanks = {
    'vectors-motion': [
      { prompt: 'If x_i = 2 m and x_f = -5 m, what is displacement Δx (m)?', answer: '-7' },
      { prompt: 'A runner goes 40 m east then 10 m west. What is displacement (m, east positive)?', answer: '30' },
      { prompt: 'On a position-time graph, what does the slope represent?', answer: 'velocity' },
      { prompt: 'A stationary object has what velocity (m/s)?', answer: '0' },
      { prompt: 'If velocity is constant and positive, the x-t graph is a line with what kind of slope?', answer: 'positive' },
      { prompt: 'Distance is a scalar or vector?', answer: 'scalar' },
      { prompt: 'Displacement is final position minus what?', answer: 'initial position' },
    ],
    'kinematics-1d': [
      { prompt: 'An object starts at rest and accelerates at 2 m/s² for 4 s. Final velocity (m/s)?', answer: '8' },
      { prompt: 'A car slows from 20 m/s to 8 m/s in 3 s. Acceleration (m/s²)?', answer: '-4' },
      { prompt: 'At constant acceleration, v = v0 + at. What is v0 called?', answer: 'initial velocity' },
      { prompt: 'If v is m/s and t is s, then vt has units of what?', answer: 'm' },
      { prompt: 'An object with a = 0 has what type of velocity?', answer: 'constant' },
      { prompt: 'For free fall near Earth (up positive), acceleration is about what value (m/s²)?', answer: '-9.8' },
      { prompt: 'If acceleration and velocity have opposite signs, speed is doing what?', answer: 'decreasing' },
    ],
    'projectile-2d': [
      { prompt: 'For launch speed v0 at angle θ from horizontal, horizontal component is v0 cosθ or v0 sinθ?', answer: 'v0 cosθ' },
      { prompt: 'Ignoring air resistance, horizontal acceleration in projectile motion is what (m/s²)?', answer: '0' },
      { prompt: 'Ignoring air resistance, vertical acceleration is approximately what (m/s², up positive)?', answer: '-9.8' },
      { prompt: 'A projectile launched horizontally has initial vertical velocity equal to what?', answer: '0' },
      { prompt: 'Time of flight for same launch/landing height depends on horizontal or vertical motion?', answer: 'vertical' },
      { prompt: 'Range can be found using x = v_x * what?', answer: 'time' },
      { prompt: 'At the top of trajectory, vertical velocity is what?', answer: '0' },
    ],
    'final-exam': [
      { prompt: 'A cyclist moves from x = -3 m to x = 11 m. Displacement (m)?', answer: '14' },
      { prompt: 'A ball at rest accelerates at 3 m/s² for 5 s. Final speed (m/s)?', answer: '15' },
      { prompt: 'A car with v0 = 25 m/s and a = -5 m/s² stops after how many seconds?', answer: '5' },
      { prompt: 'Launch speed 20 m/s at 30°. Initial vertical component (m/s)?', answer: '10' },
      { prompt: 'For projectile motion without drag, horizontal velocity is constant or changing?', answer: 'constant' },
      { prompt: 'Slope of a velocity-time graph gives what?', answer: 'acceleration' },
    ],
  };

  let state = loadState();
  let activeQuizId = null;
  let quizOrder = [];
  let quizPointer = 0;

  const modal = createQuizModal();
  document.body.append(modal);

  root.querySelectorAll('[data-quiz-launch]').forEach((button) => {
    button.addEventListener('click', () => {
      const quizId = button.dataset.quizLaunch;
      if (!quizId || !quizBanks[quizId]) {
        return;
      }

      launchQuiz(quizId);
    });
  });

  render();

  function loadState() {
    const fallback = {
      passedIdeas: {
        'vectors-motion': false,
        'kinematics-1d': false,
        'projectile-2d': false,
      },
      finalExamPassed: false,
    };

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw);
      return {
        passedIdeas: {
          'vectors-motion': Boolean(parsed?.passedIdeas?.['vectors-motion']),
          'kinematics-1d': Boolean(parsed?.passedIdeas?.['kinematics-1d']),
          'projectile-2d': Boolean(parsed?.passedIdeas?.['projectile-2d']),
        },
        finalExamPassed: Boolean(parsed?.finalExamPassed),
      };
    } catch {
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function launchQuiz(quizId) {
    activeQuizId = quizId;
    quizOrder = shuffle([...quizBanks[quizId]]);
    quizPointer = 0;

    const heading = modal.querySelector('[data-quiz-title]');
    const note = modal.querySelector('[data-quiz-note]');
    const streak = modal.querySelector('[data-quiz-streak]');
    const feedback = modal.querySelector('[data-quiz-feedback]');
    const input = modal.querySelector('[data-quiz-input]');

    heading.textContent =
      quizId === 'final-exam' ? 'Final Exam: one question at a time' : 'Practice popup: one question at a time';
    note.textContent =
      quizId === 'final-exam'
        ? 'Answer every question correctly to score 100% and pass the section final exam.'
        : `Get ${passStreakTarget} correct in a row to pass this lesson.`;
    streak.textContent = quizId === 'final-exam' ? 'Score: 0%' : 'Current streak: 0';
    feedback.textContent = '';
    feedback.className = 'quiz-feedback';
    input.value = '';

    renderCurrentQuestion();
    modal.showModal();
  }

  function renderCurrentQuestion() {
    const promptEl = modal.querySelector('[data-quiz-prompt]');
    if (!activeQuizId) {
      promptEl.textContent = '';
      return;
    }

    const currentQuestion = quizOrder[quizPointer];
    promptEl.textContent = currentQuestion.prompt;
  }

  function createQuizModal() {
    const quizModal = document.createElement('dialog');
    quizModal.className = 'quiz-modal';
    quizModal.innerHTML = `
      <form class="quiz-form" method="dialog">
        <div class="auth-head">
          <h3 data-quiz-title>Practice popup: one question at a time</h3>
          <button type="button" class="auth-close" data-quiz-close>Close</button>
        </div>
        <p class="quiz-note" data-quiz-note></p>
        <p class="mastery-label" data-quiz-streak></p>
        <h4 data-quiz-prompt></h4>
        <input class="quiz-input" data-quiz-input type="text" placeholder="Type your answer" autocomplete="off" />
        <p class="quiz-feedback" data-quiz-feedback></p>
        <div class="quiz-actions">
          <button type="button" class="primary" data-quiz-submit>Submit answer</button>
          <button type="button" class="secondary" data-quiz-skip>Skip question</button>
        </div>
      </form>
    `;

    quizModal.querySelector('[data-quiz-close]').addEventListener('click', () => {
      quizModal.close();
    });

    quizModal.querySelector('[data-quiz-submit]').addEventListener('click', () => {
      handleSubmit();
    });

    quizModal.querySelector('[data-quiz-skip]').addEventListener('click', () => {
      handleSkip();
    });

    return quizModal;
  }

  function handleSubmit() {
    if (!activeQuizId) {
      return;
    }

    const input = modal.querySelector('[data-quiz-input]');
    const feedback = modal.querySelector('[data-quiz-feedback]');
    const streak = modal.querySelector('[data-quiz-streak]');
    const guess = normalize(input.value);

    if (!guess) {
      feedback.textContent = 'Enter an answer first.';
      feedback.className = 'quiz-feedback incorrect';
      return;
    }

    const currentQuestion = quizOrder[quizPointer];
    const expected = normalize(currentQuestion.answer);
    const isCorrect = guess === expected;

    if (activeQuizId === 'final-exam') {
      const total = quizOrder.length;
      const currentCorrect = Number(streak.dataset.correct || 0);
      const nextCorrect = isCorrect ? currentCorrect + 1 : currentCorrect;
      streak.dataset.correct = String(nextCorrect);

      const scorePercent = Math.round((nextCorrect / total) * 100);
      streak.textContent = `Score: ${scorePercent}%`;

      if (isCorrect) {
        feedback.textContent = 'Correct. Next final exam question.';
        feedback.className = 'quiz-feedback correct';
      } else {
        feedback.textContent = `Not quite. Correct answer: ${currentQuestion.answer}`;
        feedback.className = 'quiz-feedback incorrect';
      }

      quizPointer += 1;
      input.value = '';

      if (quizPointer >= total) {
        finishFinalExam(nextCorrect, total, feedback);
        return;
      }

      renderCurrentQuestion();
      return;
    }

    const currentStreak = Number(streak.dataset.streak || 0);
    const nextStreak = isCorrect ? currentStreak + 1 : 0;
    streak.dataset.streak = String(nextStreak);
    streak.textContent = `Current streak: ${nextStreak}`;

    if (isCorrect) {
      feedback.textContent = 'Correct. Keep the streak alive.';
      feedback.className = 'quiz-feedback correct';
    } else {
      feedback.textContent = `Incorrect. Correct answer: ${currentQuestion.answer}. Streak reset.`;
      feedback.className = 'quiz-feedback incorrect';
    }

    input.value = '';
    quizPointer = (quizPointer + 1) % quizOrder.length;
    renderCurrentQuestion();

    if (nextStreak >= passStreakTarget) {
      state.passedIdeas[activeQuizId] = true;
      saveState();
      render();
      feedback.textContent = 'You passed this lesson! Progress updated.';
      feedback.className = 'quiz-feedback correct';
    }
  }

  function handleSkip() {
    if (!activeQuizId) {
      return;
    }

    const feedback = modal.querySelector('[data-quiz-feedback]');
    const streak = modal.querySelector('[data-quiz-streak]');

    if (activeQuizId !== 'final-exam') {
      streak.dataset.streak = '0';
      streak.textContent = 'Current streak: 0';
    }

    feedback.textContent = 'Skipped. Moving to another question.';
    feedback.className = 'quiz-feedback';
    quizPointer = (quizPointer + 1) % quizOrder.length;
    renderCurrentQuestion();
  }

  function finishFinalExam(correctCount, total, feedbackEl) {
    const score = Math.round((correctCount / total) * 100);

    if (score === 100) {
      state.finalExamPassed = true;
      saveState();
      render();
      feedbackEl.textContent = 'Perfect score. Final exam passed, section completion unlocked at 100%!';
      feedbackEl.className = 'quiz-feedback correct';
      return;
    }

    state.finalExamPassed = false;
    saveState();
    render();
    feedbackEl.textContent = `Final exam score ${score}%. You need 100% to complete the section.`;
    feedbackEl.className = 'quiz-feedback incorrect';
  }

  function render() {
    const passedCount = Object.values(state.passedIdeas).filter(Boolean).length;
    const ideaProgress = passedCount * ideaWeight;
    const progress = state.finalExamPassed ? 100 : ideaProgress;

    progressLabel.textContent = `Section progress: ${progress}%`;
    progressBar.style.width = `${progress}%`;

    Object.keys(state.passedIdeas).forEach((ideaId) => {
      const statusEl = root.querySelector(`[data-idea-status="${ideaId}"]`);
      if (!statusEl) {
        return;
      }

      statusEl.textContent = state.passedIdeas[ideaId] ? 'Status: passed ✅' : 'Status: not passed';
    });

    finalStatusLabel.textContent = state.finalExamPassed
      ? 'Final exam status: passed with 100% ✅'
      : 'Final exam status: not passed';
  }

  function normalize(value) {
    return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return items;
  }
}
