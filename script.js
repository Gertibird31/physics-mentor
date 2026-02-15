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


let authSession = null;
let authElements;

initAuthUI();


// NEW: Firebase Auth Listener
window.onAuthStateChanged(window.firebaseAuth, (user) => {
  if (user) {
    // User is signed in
    authSession = {
      email: user.email,
      // Firebase SDK handles ID token, refresh token, and expiry automatically
      // You can get current token with user.getIdToken() if needed
    };
    ensureAccountProfile(user.email);
    console.log("User signed in:", user.email);
  } else {
    // User is signed out
    authSession = null;
    console.log("User signed out");
  }
  renderAuthState(); // Update UI based on new auth state
});


function initAuthUI() {
  // ... (existing code for finding/creating nav buttons, building modals)

  // ... (existing variable assignments for authElements)

  authButton.addEventListener('click', () => {
    setAuthMessage('');
    authModal.showModal();
    // renderAuthState is now called by onAuthStateChanged, so no need here if we want immediate feedback
  });

  // ... (authCloseButton, accountButton, accountCloseButton event listeners)

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitter = event.submitter;
    const mode = submitter?.dataset.mode;
    if (!mode) {
      return;
    }

    // Removed the hasFirebaseApiKey check as it's handled by Firebase init

    const formData = new FormData(authForm);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    if (!email || !password) {
      setAuthMessage('Enter both email and password.', true);
      return;
    }

    submitter.disabled = true;
    setAuthMessage(mode === 'signup' ? 'Creating your account…' : 'Signing you in…');

    try {
      if (mode === 'signup') {
        const userCredential = await window.createUserWithEmailAndPassword(window.firebaseAuth, email, password);
        setAuthMessage(`Account created. You are signed in as ${userCredential.user.email}.`);
      } else { // mode === 'signin'
        const userCredential = await window.signInWithEmailAndPassword(window.firebaseAuth, email, password);
        setAuthMessage(`Welcome back, ${userCredential.user.email}.`);
      }
      authModal.close(); // Close modal on success
    } catch (error) {
      // Firebase SDK returns error objects
      const errorMessage = mapFirebaseError(error.code);
      setAuthMessage(errorMessage, true);
    } finally {
      submitter.disabled = false;
    }
    // renderAuthState will be called by the onAuthStateChanged listener
  });

  signOutButton.addEventListener('click', async () => {
    try {
      await window.signOut(window.firebaseAuth);
      setAuthMessage('You have been signed out.');
      // authSession will be set to null by the onAuthStateChanged listener
      // localStorage.removeItem(AUTH_STORAGE_KEY); // No longer needed for Firebase session
    } catch (error) {
      console.error("Sign out error:", error);
      setAuthMessage('Failed to sign out. Please try again.', true);
    }
  });

  // ... (accountForm event listener and other functions remain similar)
}

// NEW: Helper to map Firebase errors to user-friendly messages
function mapFirebaseError(errorCode) {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password authentication is not enabled. Contact support.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/user-not-found':
      return 'No account exists for that email. Try creating an account first.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/user-disabled':
      return 'This account is disabled. Contact support.';
    default:
      return 'Authentication failed. Please try again.';
  }
}


function renderAuthState() {
  if (!authElements) {
    return;
  }

  const { authButton, accountButton, signOutButton } = authElements;
  const isSignedIn = Boolean(window.firebaseAuth.currentUser); // Check current user directly from SDK

  authButton.textContent = isSignedIn ? window.firebaseAuth.currentUser.email : 'Sign in with email';
  accountButton.textContent = isSignedIn ? 'Account hub' : 'Account hub (sign in first)';
  signOutButton.style.display = isSignedIn ? 'inline-flex' : 'none';

  if (!isSignedIn) {
    setAccountSummary('Sign in to create and track your account profile, goals, and progress.');
  } else {
    populateAccountForm();
  }
}

// In ensureAccountProfile and saveAccountProfile, use the email from window.firebaseAuth.currentUser.email
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


function initAuthUI() {
  const navWrap = document.querySelector('.nav-wrap');
  if (!navWrap) {
    return;
  }

  const authButton = findOrCreateNavButton(navWrap, {
    className: 'auth-trigger',
    fallbackText: 'Sign in with email',
  });

  const accountButton = findOrCreateNavButton(navWrap, {
    className: 'account-trigger',
    fallbackText: 'Account hub',
  });

  const authModal = buildAuthModal();
  const accountModal = buildAccountModal();
  document.body.append(authModal, accountModal);

  const authForm = authModal.querySelector('.auth-form');
  const authMessage = authModal.querySelector('.auth-message');
  const authCloseButton = authModal.querySelector('.auth-close');
  const signOutButton = authModal.querySelector('.auth-signout');

  const accountCloseButton = accountModal.querySelector('.account-close');
  const accountMessage = accountModal.querySelector('.account-message');
  const accountForm = accountModal.querySelector('.account-form');
  const accountSummary = accountModal.querySelector('.account-summary');

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

  authButton.addEventListener('click', () => {
    setAuthMessage('');
    authModal.showModal();
    renderAuthState();
  });

  authCloseButton.addEventListener('click', () => {
    authModal.close();
  });

  accountButton.addEventListener('click', () => {
    setAccountMessage('');
    populateAccountForm();
    accountModal.showModal();
  });

  accountCloseButton.addEventListener('click', () => {
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
  });

  signOutButton.addEventListener('click', () => {
    authSession = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthMessage('You have been signed out.');
    renderAuthState();
  });

  accountForm.addEventListener('submit', (event) => {
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

  authButton.textContent = isSignedIn ? authSession.email : 'Sign in with email';
  accountButton.textContent = isSignedIn ? 'Account hub' : 'Account hub (sign in first)';
  signOutButton.style.display = isSignedIn ? 'inline-flex' : 'none';

  if (!isSignedIn) {
    setAccountSummary('Sign in to create and track your account profile, goals, and progress.');
  } else {
    populateAccountForm();
  }
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

