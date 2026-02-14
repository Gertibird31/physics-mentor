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
const authConfig = window.PHYSICS_MENTOR_AUTH ?? {
  firebaseApiKey: 'REPLACE_WITH_FIREBASE_WEB_API_KEY',
};

const hasFirebaseApiKey =
  typeof authConfig.firebaseApiKey === 'string' &&
  authConfig.firebaseApiKey.trim() !== '' &&
  !authConfig.firebaseApiKey.startsWith('REPLACE_WITH_');

let authSession = loadSession();
let authElements;

initAuthUI();

function initAuthUI() {
  const navWrap = document.querySelector('.nav-wrap');
  if (!navWrap) {
    return;
  }

  let authButton = navWrap.querySelector('.auth-trigger');

  if (!authButton) {
    authButton = document.createElement('button');
    authButton.type = 'button';
    authButton.className = 'secondary auth-trigger';

    const ctaLink = navWrap.querySelector('.cta-link');
    if (ctaLink) {
      navWrap.insertBefore(authButton, ctaLink);
    } else {
      navWrap.appendChild(authButton);
    }
  }

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
  document.body.appendChild(authModal);

  const authForm = authModal.querySelector('.auth-form');
  const messageEl = authModal.querySelector('.auth-message');
  const closeButton = authModal.querySelector('.auth-close');
  const signOutButton = authModal.querySelector('.auth-signout');

  authElements = {
    authButton,
    authModal,
    authForm,
    messageEl,
    signOutButton,
  };

  authButton.addEventListener('click', () => {
    setAuthMessage('');
    authModal.showModal();
    renderAuthState();
  });

  closeButton.addEventListener('click', () => {
    authModal.close();
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

    const endpoint =
      mode === 'signup' ? 'accounts:signUp' : 'accounts:signInWithPassword';

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

    const successMessage =
      mode === 'signup'
        ? `Account created. You are signed in as ${authSession.email}.`
        : `Welcome back, ${authSession.email}.`;
    setAuthMessage(successMessage);
    renderAuthState();
  });

  signOutButton.addEventListener('click', () => {
    authSession = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthMessage('You have been signed out.');
    renderAuthState();
  });

  renderAuthState();
}

function renderAuthState() {
  if (!authElements) {
    return;
  }

  const { authButton, signOutButton } = authElements;
  const isSignedIn = Boolean(authSession?.email);

  authButton.textContent = isSignedIn ? authSession.email : 'Sign in with email';
  signOutButton.style.display = isSignedIn ? 'inline-flex' : 'none';
}

function setAuthMessage(message, isError = false) {
  if (!authElements) {
    return;
  }

  const { messageEl } = authElements;
  messageEl.textContent = message;
  messageEl.classList.toggle('error', isError);
  messageEl.classList.toggle('success', !isError && Boolean(message));
}

function loadSession() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
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
  const authUrl = `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${authConfig.firebaseApiKey}`;
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      message: mapAuthError(data?.error?.message),
    };
  }

  return {
    ok: true,
    data,
  };
}

function mapAuthError(code) {
  const authErrors = {
    EMAIL_NOT_FOUND: 'No account exists for that email. Try creating an account first.',
    INVALID_PASSWORD: 'Incorrect password. Please try again.',
    USER_DISABLED: 'This account is disabled. Contact support.',
    EMAIL_EXISTS: 'An account with that email already exists. Try signing in instead.',
    WEAK_PASSWORD: 'Password is too weak. Use at least 6 characters.',
    OPERATION_NOT_ALLOWED: 'Email/password auth is not enabled in your Firebase project.',
    INVALID_EMAIL: 'Please enter a valid email address.',
  };

  return authErrors[code] || 'Authentication failed. Please try again.';
}
