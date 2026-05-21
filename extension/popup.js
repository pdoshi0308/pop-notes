/* eslint-disable no-undef */
// Popform popup controller.
// Reads helpers from window: PopformPhone, PopformAPI, Pusher.

(function () {
  const $ = (id) => document.getElementById(id);

  const screens = {
    login: $('screen-login'),
    main: $('screen-main'),
  };
  const states = {
    input: $('state-input'),
    waiting: $('state-waiting'),
    result: $('state-result'),
  };

  let session = null;          // { access_token, refresh_token, ... }
  let workspace = null;        // { id, name, pusher_key, pusher_cluster }
  let pusher = null;
  let activeChannel = null;
  let pendingE164 = null;
  let lastFields = null;

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  init().catch(showFatalError);

  async function init() {
    const stored = await chrome.storage.local.get(['session', 'workspace']);
    session = stored.session || null;
    workspace = stored.workspace || null;

    if (session && workspace) {
      try {
        await refreshProfile();
        showScreen('main');
        return;
      } catch {
        // fall through to login
      }
    }
    showScreen('login');
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.hidden = k !== name;
    });
    if (name === 'main') {
      setState('input');
      $('practice-name').textContent = workspace?.name ?? 'Your practice';
      $('avatar-initial').textContent = (workspace?.name ?? 'P').slice(0, 1).toUpperCase();
      ensurePusher();
    }
  }

  function setState(name) {
    Object.entries(states).forEach(([k, el]) => {
      el.hidden = k !== name;
    });
  }

  function showFatalError(err) {
    console.error('[Popform]', err);
    document.body.innerHTML =
      '<div style="padding:20px;font-family:Inter,sans-serif;color:#EF4444">' +
      'Popform failed to start.<br>' +
      (err && err.message ? err.message : err) +
      '</div>';
  }

  // ---------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    const btn = $('login-submit');
    const errEl = $('login-error');
    errEl.hidden = true;
    btn.disabled = true;
    btn.classList.add('loading');
    try {
      session = await PopformAPI.signIn(email, password);
      await chrome.storage.local.set({ session });
      await refreshProfile();
      showScreen('main');
    } catch (err) {
      errEl.textContent = friendlyError(err);
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  });

  $('forgot-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: (POPFORM_CONFIG.API_BASE || '') + '/dashboard/login',
    });
  });

  async function refreshProfile() {
    const data = await PopformAPI.withFreshToken(session, (tok) => PopformAPI.getMe(tok));
    workspace = data.workspace;
    await chrome.storage.local.set({ workspace });
  }

  // ---------------------------------------------------------------------
  // Sign out
  // ---------------------------------------------------------------------
  $('signout').addEventListener('click', async () => {
    await chrome.storage.local.remove(['session', 'workspace']);
    session = null;
    workspace = null;
    teardownPusher();
    $('phone').value = '';
    showScreen('login');
  });

  // ---------------------------------------------------------------------
  // Phone input + send
  // ---------------------------------------------------------------------
  const phoneInput = $('phone');
  const sendBtn = $('send-btn');

  phoneInput.addEventListener('input', () => {
    const pos = phoneInput.selectionStart;
    const before = phoneInput.value;
    const formatted = PopformPhone.formatUk(before);
    phoneInput.value = formatted;
    // Best-effort: keep the caret roughly where it was.
    if (pos != null) {
      const delta = formatted.length - before.length;
      const next = Math.max(0, pos + delta);
      phoneInput.setSelectionRange(next, next);
    }
    sendBtn.disabled = !PopformPhone.toE164(formatted);
  });

  $('send-btn').addEventListener('click', async () => {
    const e164 = PopformPhone.toE164(phoneInput.value);
    if (!e164) return;
    sendBtn.classList.add('loading');
    sendBtn.disabled = true;
    const errEl = $('send-error');
    errEl.hidden = true;
    try {
      await PopformAPI.withFreshToken(session, (tok) => PopformAPI.sendForm(tok, e164));
      pendingE164 = e164;
      $('waiting-sub').textContent =
        'Waiting for ' + e164.replace(/^\+44/, '0').replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') + ' to fill it in…';
      subscribeToPatient(e164);
      setState('waiting');
    } catch (err) {
      errEl.textContent = friendlyError(err);
      errEl.hidden = false;
    } finally {
      sendBtn.classList.remove('loading');
      sendBtn.disabled = false;
    }
  });

  $('cancel-wait').addEventListener('click', () => {
    unsubscribeFromPatient();
    resetMainScreen();
  });

  $('send-another').addEventListener('click', () => {
    resetMainScreen();
  });

  function resetMainScreen() {
    phoneInput.value = '';
    sendBtn.disabled = true;
    pendingE164 = null;
    lastFields = null;
    setState('input');
    phoneInput.focus();
  }

  // ---------------------------------------------------------------------
  // Pusher
  // ---------------------------------------------------------------------
  function ensurePusher() {
    if (pusher || !workspace?.pusher_key || !workspace?.pusher_cluster) return;
    try {
      pusher = new Pusher(workspace.pusher_key, {
        cluster: workspace.pusher_cluster,
        forceTLS: true,
      });
    } catch (err) {
      console.error('Pusher init failed', err);
    }
  }

  function subscribeToPatient(e164) {
    ensurePusher();
    if (!pusher) return;
    unsubscribeFromPatient();
    const name = PopformPhone.channelForE164(e164);
    activeChannel = pusher.subscribe(name);
    activeChannel.bind('patient.registered', (data) => {
      lastFields = data && data.fields ? data.fields : {};
      renderResult(lastFields);
      setState('result');
      unsubscribeFromPatient();
    });
  }

  function unsubscribeFromPatient() {
    if (pusher && activeChannel) {
      pusher.unsubscribe(activeChannel.name);
    }
    activeChannel = null;
  }

  function teardownPusher() {
    unsubscribeFromPatient();
    if (pusher) {
      try { pusher.disconnect(); } catch {}
    }
    pusher = null;
  }

  // ---------------------------------------------------------------------
  // Result rendering
  // ---------------------------------------------------------------------
  const FIELD_DISPLAY = {
    full_name: { label: 'Full name', icon: '👤' },
    mobile_number: { label: 'Mobile', icon: '📱' },
    email: { label: 'Email', icon: '✉️' },
    date_of_birth: { label: 'Date of birth', icon: '🎂' },
    address_line_1: { label: 'Address line 1', icon: '🏠' },
    address_line_2: { label: 'Address line 2', icon: '🏠' },
    postcode: { label: 'Postcode', icon: '📍' },
    gp_name: { label: 'GP name', icon: '🩺' },
    nhs_private: { label: 'NHS or private', icon: '🏥' },
    emergency_contact_name: { label: 'Emergency contact', icon: '🚨' },
    emergency_contact_number: { label: 'Emergency number', icon: '📞' },
    hear_about_us: { label: 'How they heard about us', icon: '🔍' },
    medical_conditions: { label: 'Medical conditions', icon: '📝' },
    custom_1: { label: 'Custom 1', icon: '✨' },
    custom_2: { label: 'Custom 2', icon: '✨' },
  };

  function renderResult(fields) {
    const list = $('result-fields');
    list.innerHTML = '';
    Object.entries(fields).forEach(([k, v]) => {
      if (!v && v !== 0) return;
      const meta = FIELD_DISPLAY[k] || { label: k.replace(/_/g, ' '), icon: '•' };
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="field-icon">${meta.icon}</span>
        <div class="field-text">
          <div class="field-label">${escapeHtml(meta.label)}</div>
          <div class="field-value"></div>
        </div>
        <button class="copy-btn" title="Copy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      `;
      li.querySelector('.field-value').textContent = String(v);
      li.querySelector('.copy-btn').addEventListener('click', (e) => {
        copyValue(String(v), e.currentTarget);
      });
      list.appendChild(li);
    });
  }

  function buildCopyAll(fields) {
    return Object.entries(fields)
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => {
        const meta = FIELD_DISPLAY[k] || { label: k.replace(/_/g, ' ') };
        return `${meta.label}: ${v}`;
      })
      .join('\n');
  }

  $('copy-all').addEventListener('click', async (e) => {
    if (!lastFields) return;
    const text = buildCopyAll(lastFields);
    await copyValue(text, e.currentTarget);
  });

  async function copyValue(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const prev = button.innerHTML;
      button.classList.add('copied');
      if (button.id === 'copy-all') {
        button.textContent = 'Copied';
        setTimeout(() => {
          button.textContent = 'Copy all';
          button.classList.remove('copied');
        }, 1200);
      } else {
        button.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => {
          button.innerHTML = prev;
          button.classList.remove('copied');
        }, 1200);
      }
    } catch (err) {
      console.error('clipboard write failed', err);
    }
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function friendlyError(err) {
    const m = err && err.message ? err.message : 'Something went wrong.';
    if (/invalid login/i.test(m)) return 'That email or password didn\'t work.';
    if (/twilio/i.test(m)) return 'SMS could not be sent — check Twilio settings.';
    if (/realtime/i.test(m)) return 'Realtime keys missing — check Pusher settings.';
    return m;
  }
})();
