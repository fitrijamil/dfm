// DFI System - Configuration
const CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
  TOKEN_KEY: 'dfi_token',
  USER_KEY: 'dfi_user',
  TAT: { GREEN_MAX: 6, AMBER_MAX: 9, RED_MAX: 14 },
  ROLES: { SUPERADMIN: 'superadmin', SENIOR: 'senior', EXEC: 'exec', OFFICER: 'officer' },
  DASHBOARD_PATHS: {
    'superadmin': '/dashboard_superadmin.html',
    'senior': '/dashboard_senior.html',
    'exec': '/dashboard_exec.html',
    'officer': '/dashboard_officer.html'
  },
  MO_BY_TYPE: {
    "Fraud": ["Macau Scam","Phishing/SMS","Recovery Agent","Fake Bank Call","Investment Fraud","Mule Account","Account Takeover","Other (Fraud)"],
    "Scam": ["Job Scam","Love/Romance","Parcel/Custom","Loan/Pinjaman","Investment Scam","Seller Scam","QR/DuitNow","Other (Scam)"],
    "Non-Fraud": ["Wrong Transfer","System Error","Customer Mistake","Other (Non-Fraud)"]
  }
};

// API Helper
const API = {
  getHeaders() {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    return { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) };
  },
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    try {
      const res = await fetch(url, { ...options, headers: { ...this.getHeaders(), ...options.headers } });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) { localStorage.removeItem(CONFIG.TOKEN_KEY); localStorage.removeItem(CONFIG.USER_KEY); location.href = '/login.html'; return; }
        throw new Error(data.error || 'Request failed');
      }
      return data;
    } catch (e) { console.error('API Error:', e); throw e; }
  },
  get(ep) { return this.request(ep, { method: 'GET' }); },
  post(ep, body) { return this.request(ep, { method: 'POST', body: JSON.stringify(body) }); },
  put(ep, body) { return this.request(ep, { method: 'PUT', body: JSON.stringify(body) }); },
  patch(ep, body) { return this.request(ep, { method: 'PATCH', body: JSON.stringify(body) }); },
  delete(ep) { return this.request(ep, { method: 'DELETE' }); }
};

// Auth Helper
const Auth = {
  isLoggedIn() { return !!localStorage.getItem(CONFIG.TOKEN_KEY); },
  getUser() { const d = localStorage.getItem(CONFIG.USER_KEY); return d ? JSON.parse(d) : null; },
  async login(username, password) {
    const res = await API.post('/auth/login', { username, password });
    localStorage.setItem(CONFIG.TOKEN_KEY, res.token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(res.user));
    return res.user;
  },
  logout() { localStorage.removeItem(CONFIG.TOKEN_KEY); localStorage.removeItem(CONFIG.USER_KEY); location.href = '/login.html'; },
  async validateToken() {
    if (!this.isLoggedIn()) return false;
    try { const res = await API.get('/auth/me'); if (res?.user) { localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(res.user)); return true; } return false; }
    catch { localStorage.removeItem(CONFIG.TOKEN_KEY); localStorage.removeItem(CONFIG.USER_KEY); return false; }
  },
  async requireAuth() { if (!this.isLoggedIn() || !await this.validateToken()) { location.href = '/login.html'; return false; } return true; },
  async requireRole(allowedRoles) {
    if (!await this.requireAuth()) return false;
    const user = this.getUser();
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(user.role)) { this.redirectToDashboard(); return false; }
    return true;
  },
  redirectToDashboard() { const u = this.getUser(); location.href = u ? (CONFIG.DASHBOARD_PATHS[u.role] || '/login.html') : '/login.html'; }
};

// Utils
const Utils = {
  formatDate(d) { return d ? new Date(d).toISOString().split('T')[0] : '-'; },
  calcTAT(dateEsc, dateClosed, status) {
    if (!dateEsc) return null;
    const start = new Date(dateEsc); start.setHours(0,0,0,0);
    const end = (status === 'Closed' && dateClosed) ? new Date(dateClosed) : new Date(); end.setHours(0,0,0,0);
    return Math.max(0, Math.floor((end - start) / 86400000));
  },
  getTATDisplay(days) {
    if (days === null) return { text: '-', class: '' };
    if (days <= 6) return { text: `GREEN • ${days}d`, class: 'tat-green' };
    if (days <= 9) return { text: `AMBER • ${days}d`, class: 'tat-amber' };
    if (days <= 14) return { text: `RED • ${days}d`, class: 'tat-red' };
    return { text: `BREACH • ${days}d`, class: 'tat-breach' };
  },
  tatBadgeHTML(days) {
    const d = this.getTATDisplay(days);
    return `<span class="tat-badge ${d.class}"><span class="dot"></span>${d.text}</span>`;
  },
  escapeHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
  showToast(msg, type = 'success') {
    let c = document.querySelector('.toast-container');
    if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div'); t.className = `toast ${type}`; t.innerHTML = `<span>${msg}</span>`;
    c.appendChild(t); setTimeout(() => t.remove(), 3000);
  },
  showLoading(msg = 'Loading...') {
    let o = document.querySelector('.loading-overlay');
    if (!o) { o = document.createElement('div'); o.className = 'loading-overlay'; o.innerHTML = `<div class="spinner"></div><p>${msg}</p>`; document.body.appendChild(o); }
    o.querySelector('p').textContent = msg; o.classList.add('active');
  },
  hideLoading() { document.querySelector('.loading-overlay')?.classList.remove('active'); },
  debounce(fn, wait) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; }
};
