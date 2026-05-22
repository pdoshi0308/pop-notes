// Thin wrappers around Supabase auth + the Popform API.
// Auth is done by hitting Supabase's /auth/v1/token endpoint directly — no SDK
// needed, which keeps the extension bundle small.

(function (root) {
  const CFG = root.POPFORM_CONFIG || {};

  async function jsonFetch(url, opts) {
    const res = await fetch(url, opts);
    let body;
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok) {
      const msg = body.error_description || body.error || body.msg || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return body;
  }

  async function signIn(email, password) {
    return jsonFetch(
      CFG.SUPABASE_URL + '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CFG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      }
    );
  }

  async function refresh(refreshToken) {
    return jsonFetch(
      CFG.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CFG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );
  }

  async function getMe(accessToken) {
    return jsonFetch(CFG.API_BASE + '/api/me', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
  }

  async function sendForm(accessToken, phone) {
    return jsonFetch(CFG.API_BASE + '/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ phone }),
    });
  }

  async function getWorkspace(accessToken) {
    return jsonFetch(CFG.API_BASE + '/api/workspace', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
  }

  async function updateWorkspace(accessToken, patch) {
    return jsonFetch(CFG.API_BASE + '/api/workspace', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify(patch),
    });
  }

  // Wrap a call so that on 401 we transparently try to refresh the session.
  async function withFreshToken(session, fn) {
    try {
      return await fn(session.access_token);
    } catch (err) {
      const msg = (err && err.message) || '';
      const looksLikeAuthIssue =
        /401|invalid|expired|jwt/i.test(msg);
      if (!looksLikeAuthIssue || !session.refresh_token) throw err;
      const refreshed = await refresh(session.refresh_token);
      // Persist the refreshed session AND update the caller's in-memory copy.
      // Supabase rotates refresh tokens, so the old one is now spent — mutating
      // the live object keeps the next call from refreshing with a dead token.
      await chrome.storage.local.set({ session: refreshed });
      Object.assign(session, refreshed);
      return await fn(refreshed.access_token);
    }
  }

  root.PopformAPI = {
    signIn,
    refresh,
    getMe,
    sendForm,
    getWorkspace,
    updateWorkspace,
    withFreshToken,
  };
})(window);
