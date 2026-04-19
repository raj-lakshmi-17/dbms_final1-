/* ============================================================
   AUTH.JS — Login, Signup, Forgot Password, Role Selection
   ============================================================ */

'use strict';

let selectedRole = 'staff';
let currentTab   = 'login';

// ─── Tab Switcher ────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  const loginForm  = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginTab   = document.getElementById('loginTab');
  const signupTab  = document.getElementById('signupTab');
  const subtitle   = document.getElementById('authSubtitle');
  const title      = document.querySelector('.auth-form-container h2');

  clearAuthMsg();

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    if (title)    title.textContent    = 'Welcome Back! 👋';
    if (subtitle) subtitle.textContent = 'Sign in to access your notice board';
  } else {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    if (title)    title.textContent    = 'Create Account 🚀';
    if (subtitle) subtitle.textContent = 'Join the Digital Notice Board platform';
  }
}

// ─── Login Handler ────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAuthMsg('Please fill in all fields', 'error'); return;
  }

  setLoginLoading(true);
  clearAuthMsg();

  // Try API first, fallback to localStorage
  let user = null;
  try {
    const resp = await fetch(`${window.DNB?.apiBase || 'http://localhost:8080/api'}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const data = await resp.json();
      user = data.user;
      localStorage.setItem('dnb-token', data.token);
    }
  } catch {
    // API not available — use localStorage
  }

  // Local authentication fallback
  if (!user) {
    const users = JSON.parse(localStorage.getItem('dnb-users') || '[]');
    user = users.find(u => u.email === email && u.password === password);
    if (user) localStorage.setItem('dnb-token', 'local-token-' + Date.now());
  }

  await new Promise(r => setTimeout(r, 600)); // UX delay

  if (user) {
    if (!user.active) {
      showAuthMsg('Your account has been deactivated. Contact admin.', 'error');
      setLoginLoading(false);
      return;
    }
    localStorage.setItem('dnb-user', JSON.stringify(user));
    showAuthMsg('Login successful! Redirecting…', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 800);
  } else {
    showAuthMsg('Invalid email or password. Try the demo credentials below.', 'error');
    setLoginLoading(false);
  }
}

function setLoginLoading(loading) {
  const btn     = document.getElementById('loginBtn');
  const txt     = document.getElementById('loginBtnText');
  const spinner = document.getElementById('loginBtnSpinner');
  if (!btn) return;
  btn.disabled      = loading;
  txt.textContent   = loading ? 'Signing in…' : 'Sign In';
  spinner.classList.toggle('hidden', !loading);
}

// ─── Signup Handler ───────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  const first   = document.getElementById('signupFirst').value.trim();
  const last    = document.getElementById('signupLast').value.trim();
  const email   = document.getElementById('signupEmail').value.trim();
  const dept    = document.getElementById('signupDept').value.trim();
  const password= document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  const terms   = document.getElementById('termsCheck').checked;

  if (!first || !last || !email || !password) {
    showAuthMsg('Please fill in all required fields', 'error'); return;
  }
  if (password !== confirm) {
    showAuthMsg('Passwords do not match', 'error'); return;
  }
  if (!terms) {
    showAuthMsg('Please accept the Terms of Service', 'error'); return;
  }
  if (password.length < 6) {
    showAuthMsg('Password must be at least 6 characters', 'error'); return;
  }

  setSignupLoading(true);
  clearAuthMsg();

  const users = JSON.parse(localStorage.getItem('dnb-users') || '[]');
  if (users.find(u => u.email === email)) {
    showAuthMsg('An account with this email already exists', 'error');
    setSignupLoading(false);
    return;
  }

  const newUser = {
    id: 'u' + Date.now(),
    name: `${first} ${last}`,
    email, password, role: selectedRole,
    dept: dept || 'General', active: true,
    joined: new Date().toISOString().split('T')[0],
  };

  // Try API
  try {
    const resp = await fetch(`${window.DNB?.apiBase || 'http://localhost:8080/api'}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: first, lastName: last, email, password, role: selectedRole, department: dept }),
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const data = await resp.json();
      localStorage.setItem('dnb-token', data.token);
    }
  } catch { /* fallback */ }

  await new Promise(r => setTimeout(r, 800));

  users.push(newUser);
  localStorage.setItem('dnb-users', JSON.stringify(users));
  localStorage.setItem('dnb-user', JSON.stringify(newUser));

  showAuthMsg('Account created! Redirecting to dashboard…', 'success');
  setTimeout(() => window.location.href = 'dashboard.html', 900);
}

function setSignupLoading(loading) {
  const btn     = document.getElementById('signupBtn');
  const txt     = document.getElementById('signupBtnText');
  const spinner = document.getElementById('signupBtnSpinner');
  if (!btn) return;
  btn.disabled      = loading;
  txt.textContent   = loading ? 'Creating account…' : 'Create Account';
  spinner.classList.toggle('hidden', !loading);
}

// ─── Role Selector ────────────────────────────────────────────
function selectRole(role, el) {
  selectedRole = role;
  document.getElementById('selectedRole').value = role;
  document.querySelectorAll('.role-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

// ─── Password Toggle ──────────────────────────────────────────
function toggleEye(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

// ─── Password Strength ────────────────────────────────────────
function checkStrength(pw) {
  const s1 = document.getElementById('s1');
  const s2 = document.getElementById('s2');
  const s3 = document.getElementById('s3');
  const s4 = document.getElementById('s4');
  const lbl = document.getElementById('strengthLabel');
  if (!s1) return;

  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;

  const colors = ['#dfe6e9', '#d63031', '#fdcb6e', '#00b894', '#6c63ff'];
  const labels = ['',        'Weak',    'Fair',    'Good',   'Strong'];

  [s1,s2,s3,s4].forEach((b,i) => {
    b.style.background = i < score ? colors[score] : 'var(--border)';
  });
  if (lbl) {
    lbl.textContent  = labels[score];
    lbl.style.color  = colors[score];
  }
}

// ─── Enforce Lowercase Emails ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const loginEmail = document.getElementById('loginEmail');
  const signupEmail = document.getElementById('signupEmail');
  
  if (loginEmail) {
    loginEmail.addEventListener('input', (e) => {
      e.target.value = e.target.value.toLowerCase();
    });
  }
  
  if (signupEmail) {
    signupEmail.addEventListener('input', (e) => {
      e.target.value = e.target.value.toLowerCase();
    });
  }
});

// ─── Social Login ─────────────────────────────────────────────
async function socialLogin(provider) {
  if (provider === 'google') {
    showAuthMsg('Simulating Google Sign-In...', 'info');
    setLoginLoading(true);
    
    // Simulate API delay
    await new Promise(r => setTimeout(r, 1200));
    
    // Create a mock Google user
    const googleUser = {
      id: 'g_' + Date.now(),
      name: 'Google User',
      email: 'google_user@gmail.com',
      role: 'user',
      dept: 'General',
      active: true,
      joined: new Date().toISOString().split('T')[0]
    };
    
    // Save to localStorage for demo purposes
    const users = JSON.parse(localStorage.getItem('dnb-users') || '[]');
    if (!users.find(u => u.email === googleUser.email)) {
      users.push(googleUser);
      localStorage.setItem('dnb-users', JSON.stringify(users));
    }
    
    localStorage.setItem('dnb-user', JSON.stringify(googleUser));
    localStorage.setItem('dnb-token', 'mock-google-token-123');
    
    showAuthMsg('Google login successful! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 800);
  } else {
    showAuthMsg(`${provider.charAt(0).toUpperCase()+provider.slice(1)} login requires backend OAuth configuration.`, 'info');
  }
}

// ─── Forgot Password ──────────────────────────────────────────
function showForgot() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    showAuthMsg('Enter your email above first, then click "Forgot password?"', 'warning');
    document.getElementById('loginEmail').focus();
    return;
  }
  // Simulate password reset
  showAuthMsg(`✅ Password reset instructions sent to ${email}. Check your inbox!`, 'success');
}

// ─── Auth Messages ─────────────────────────────────────────────
function showAuthMsg(text, type) {
  const el = document.getElementById('authMsg');
  if (!el) return;
  const isSuccess = type === 'success';
  el.className = isSuccess ? 'form-success' : 'form-error';
  el.innerHTML = `${isSuccess ? '✅' : type === 'warning' ? '⚠️' : type === 'info' ? 'ℹ️' : '❌'} ${text}`;
  el.classList.remove('hidden');
}

function clearAuthMsg() {
  const el = document.getElementById('authMsg');
  if (el) { el.className = 'hidden'; el.textContent = ''; }
}
