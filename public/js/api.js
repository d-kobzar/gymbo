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
        const body = Api._unwrap(await res.json());
        this.token = body?.token || body?.access_token;
        if (this.token) localStorage.setItem('gymbo_token', this.token);
      } else {
        console.warn('Telegram auth failed:', res.status);
      }
    } catch (e) {
      console.warn('Telegram auth failed:', e);
    }
  },

  // Unwrap the `{ data, meta }` envelope produced by the server's global
  // TransformInterceptor. Raw responses (health, webhook, static) are
  // returned as-is.
  _unwrap(body) {
    if (body && typeof body === 'object' && !Array.isArray(body)
        && 'data' in body && 'meta' in body) {
      return body.data;
    }
    return body;
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
        const errBody = await res.json().catch(() => ({}));
        const err = errBody && errBody.error
          ? errBody.error
          : { code: `HTTP_${res.status}`, message: errBody.message || `Request failed: ${res.status}` };
        const e = new Error(err.message);
        e.code = err.code;
        e.details = err.details;
        throw e;
      }

      const ct = res.headers.get('content-type');
      if (ct && ct.includes('application/json')) {
        return Api._unwrap(await res.json());
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
