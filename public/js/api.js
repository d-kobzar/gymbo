/* Auth-aware fetch wrapper — Telegram-only */
const Api = {
  token: null,
  initData: null,
  baseUrl: '',

  async init() {
    const initData = TG.getInitData();
    if (!initData) {
      console.warn('No Telegram initData — auth unavailable');
      return;
    }
    this.initData = initData;
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
      });
      if (res.ok) {
        const data = await res.json();
        this.token = data.token || data.access_token;
        if (this.token) localStorage.setItem('gymbo_token', this.token);
      } else {
        console.warn('Telegram auth failed:', res.status);
      }
    } catch (e) {
      console.warn('Telegram auth failed:', e);
    }
  },

  async request(url, opts = {}, retry = true) {
    const headers = opts.headers || {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (!(opts.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    try {
      const res = await fetch(this.baseUrl + url, { ...opts, headers });

      if (res.status === 401) {
        this.token = null;
        localStorage.removeItem('gymbo_token');
        if (retry) {
          await this.init();
          if (this.token) return this.request(url, opts, false);
        }
        this.toast('Session expired', 'error');
        return null;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Request failed: ${res.status}`);
      }

      const ct = res.headers.get('content-type');
      if (ct && ct.includes('application/json')) {
        return await res.json();
      }
      return await res.text();
    } catch (e) {
      console.error('API error:', e);
      throw e;
    }
  },

  async get(url) {
    return this.request(url);
  },

  async post(url, data) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async put(url, data) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async del(url) {
    return this.request(url, { method: 'DELETE' });
  },

  async upload(url, formData) {
    return this.request(url, {
      method: 'POST',
      body: formData,
      headers: {}
    });
  },

  toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
      el.classList.remove('show');
    }, 3000);
    TG.haptic(type === 'error' ? 'error' : type === 'success' ? 'success' : 'light');
  }
};
