/* eslint-disable no-undef */
// Popform popup controller.
// Reads helpers from window: PopformPhone, PopformAPI, Pusher.

(function () {
  const $ = (id) => document.getElementById(id);

  const screens = {
    login: $('screen-login'),
    main: $('screen-main'),
    settings: $('screen-settings'),
  };
  const states = {
    input: $('state-input'),
    waiting: $('state-waiting'),
    result: $('state-result'),
  };

  let session = null;          // { access_token, refresh_token, ... }
  let workspace = null;        // { id, name, pusher_key, pusher_cluster }
  let role = null;             // 'admin' | 'receptionist'
  let pusher = null;
  let activeChannel = null;
  let pendingE164 = null;
  let lastFields = null;

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  // Apply the brand name from config to every element marked [data-brand-name].
  // Allows renaming the product by editing config.js only.
  const brandName =
    (window.POPFORM_CONFIG && window.POPFORM_CONFIG.BRAND_NAME) || 'Pingform';
  document.querySelectorAll('[data-brand-name]').forEach((el) => {
    el.textContent = brandName;
  });
  document.title = brandName;

  // Reveal the WhatsApp send button only when enabled in config.
  if (window.POPFORM_CONFIG && window.POPFORM_CONFIG.ENABLE_WHATSAPP) {
    const wa = document.getElementById('wa-btn');
    if (wa) wa.hidden = false;
  }

  init().catch(showFatalError);

  async function init() {
    const stored = await chrome.storage.local.get(['session', 'workspace', 'role']);
    session = stored.session || null;
    workspace = stored.workspace || null;
    role = stored.role || null;

    if (session && workspace) {
      // Show the main screen immediately from cached data. A transient server
      // or network error must never bounce a signed-in user back to login —
      // only an irrecoverable session (rejected refresh token) should.
      showScreen('main');
      refreshProfile().catch((err) => {
        if (isSessionExpired(err)) {
          clearSession();
          showScreen('login');
        }
      });
      return;
    }
    showScreen('login');
  }

  function isSessionExpired(err) {
    const m = (err && err.message) || '';
    return /refresh.?token|invalid.?grant|not.*found|bad_jwt/i.test(m);
  }

  function clearSession() {
    chrome.storage.local.remove(['session', 'workspace', 'role']);
    session = null;
    workspace = null;
    role = null;
    teardownPusher();
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.hidden = k !== name;
    });
    if (name === 'main') {
      setState('input');
      $('practice-name').textContent = workspace?.name ?? 'Your business';
      $('avatar-initial').textContent = (workspace?.name ?? 'P').slice(0, 1).toUpperCase();
      $('open-settings').hidden = role !== 'admin';
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
      brandName + ' failed to start.<br>' +
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
      url: (POPFORM_CONFIG.API_BASE || '') + '/dashboard/forgot',
    });
  });

  async function refreshProfile() {
    const data = await PopformAPI.withFreshToken(session, (tok) => PopformAPI.getMe(tok));
    workspace = data.workspace;
    role = data.user?.role ?? null;
    renderBilling(data.billing);
    await chrome.storage.local.set({ workspace, role });
  }

  function renderBilling(billing) {
    const strip = $('billing-strip');
    if (!billing) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    $('billing-plan').textContent = billing.plan_name || billing.plan || 'Free';
    $('billing-usage').textContent = `${billing.sms_used} / ${billing.sms_limit}`;
    const pct = Math.min(
      100,
      Math.round((billing.sms_used / Math.max(billing.sms_limit, 1)) * 100)
    );
    const fill = $('billing-bar-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('warn', pct >= 90);
  }

  // ---------------------------------------------------------------------
  // Sign out
  // ---------------------------------------------------------------------
  $('signout').addEventListener('click', () => {
    clearSession();
    $('phone').value = '';
    showScreen('login');
  });

  // ---------------------------------------------------------------------
  // Settings (admins only)
  // ---------------------------------------------------------------------
  $('open-settings').addEventListener('click', () => openSettings());
  $('settings-back').addEventListener('click', () => showScreen('main'));

  const SETTINGS_FIELDS = {
    name: 'ws-name',
    twilio_account_sid: 'ws-tw-sid',
    twilio_auth_token: 'ws-tw-token',
    twilio_from_number: 'ws-tw-from',
    pusher_app_id: 'ws-ps-app',
    pusher_key: 'ws-ps-key',
    pusher_secret: 'ws-ps-secret',
    pusher_cluster: 'ws-ps-cluster',
    sms_template: 'ws-sms',
  };

  async function openSettings() {
    showScreen('settings');
    $('settings-loading').hidden = false;
    $('settings-fields').hidden = true;
    $('settings-error').hidden = true;
    $('settings-saved').hidden = true;
    try {
      const data = await PopformAPI.withFreshToken(session, (tok) =>
        PopformAPI.getWorkspace(tok)
      );
      const ws = data.workspace || {};
      for (const [key, el] of Object.entries(SETTINGS_FIELDS)) {
        $(el).value = ws[key] ?? '';
      }
      $('settings-loading').hidden = true;
      $('settings-fields').hidden = false;
      $('settings-fields').disabled = false;
    } catch (err) {
      $('settings-loading').textContent = friendlyError(err);
    }
  }

  $('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('settings-save');
    const errEl = $('settings-error');
    const savedEl = $('settings-saved');
    errEl.hidden = true;
    savedEl.hidden = true;
    btn.classList.add('loading');
    $('settings-fields').disabled = true;
    try {
      const patch = {};
      for (const [key, el] of Object.entries(SETTINGS_FIELDS)) {
        patch[key] = $(el).value.trim();
      }
      await PopformAPI.withFreshToken(session, (tok) =>
        PopformAPI.updateWorkspace(tok, patch)
      );
      // Refresh local profile so the new practice name + Pusher key take effect.
      await refreshProfile();
      $('practice-name').textContent = workspace?.name ?? 'Your business';
      teardownPusher();
      ensurePusher();
      savedEl.hidden = false;
    } catch (err) {
      errEl.textContent = friendlyError(err);
      errEl.hidden = false;
    } finally {
      btn.classList.remove('loading');
      $('settings-fields').disabled = false;
    }
  });

  // ---------------------------------------------------------------------
  // Phone input + send
  // ---------------------------------------------------------------------
  const phoneInput = $('phone');
  const sendBtn = $('send-btn');
  const waBtn = $('wa-btn');

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
    const valid = !PopformPhone.toE164(formatted);
    sendBtn.disabled = valid;
    waBtn.disabled = valid;
  });

  // Build the registration link the patient/client opens. Mirrors the URL the
  // server builds in /api/send so SMS and WhatsApp point at the same form.
  function buildFormLink(e164) {
    const base = (window.POPFORM_CONFIG && window.POPFORM_CONFIG.API_BASE) || '';
    const ref = e164.replace(/^\+/, '');
    return `${base}/register?workspace=${encodeURIComponent(
      workspace?.id ?? ''
    )}&ref=${encodeURIComponent(ref)}`;
  }

  // Send via WhatsApp: no SMS/Twilio. We still subscribe to the realtime
  // channel so the completed form lands back in the panel, then open WhatsApp
  // pre-filled to the recipient for reception to tap send.
  $('wa-btn').addEventListener('click', async () => {
    const e164 = PopformPhone.toE164(phoneInput.value);
    if (!e164) return;
    const errEl = $('send-error');
    errEl.hidden = true;
    waBtn.disabled = true;
    // Subscribe before sending so we don't race the client's submission.
    subscribeToPatient(e164);
    pendingE164 = e164;
    try {
      const result = await PopformAPI.withFreshToken(session, (tok) =>
        PopformAPI.sendForm(tok, e164, 'whatsapp')
      );
      if (result && result.manual) {
        // No WhatsApp sender configured server-side yet → open WhatsApp for a
        // manual send (graceful fallback until the Twilio sender is approved).
        const link = result.link || buildFormLink(e164);
        const msg = encodeURIComponent(
          `Hi! ${workspace?.name ?? 'We'} ${
            workspace?.name ? 'has' : 'have'
          } asked you to complete a quick registration form. It only takes 1 minute 👉 ${link}`
        );
        chrome.tabs.create({ url: `https://wa.me/${e164.replace(/^\+/, '')}?text=${msg}` });
        renderDevLink(link);
      } else {
        // Sent automatically via Twilio WhatsApp — no manual step.
        renderDevLink(null);
      }
      $('waiting-sub').textContent =
        'Waiting for ' +
        e164.replace(/^\+44/, '0').replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') +
        ' to fill it in…';
      setState('waiting');
    } catch (err) {
      unsubscribeFromPatient();
      errEl.textContent = friendlyError(err);
      errEl.hidden = false;
    } finally {
      waBtn.disabled = false;
    }
  });

  $('send-btn').addEventListener('click', async () => {
    const e164 = PopformPhone.toE164(phoneInput.value);
    if (!e164) return;
    sendBtn.classList.add('loading');
    sendBtn.disabled = true;
    const errEl = $('send-error');
    errEl.hidden = true;
    // Subscribe BEFORE calling /api/send so we don't race the patient.
    subscribeToPatient(e164);
    pendingE164 = e164;
    try {
      const result = await PopformAPI.withFreshToken(session, (tok) =>
        PopformAPI.sendForm(tok, e164)
      );
      $('waiting-sub').textContent =
        'Waiting for ' +
        e164.replace(/^\+44/, '0').replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') +
        ' to fill it in…';
      renderDevLink(result && result.dev_mode ? result.link : null);
      setState('waiting');
    } catch (err) {
      unsubscribeFromPatient();
      errEl.textContent = friendlyError(err);
      errEl.hidden = false;
    } finally {
      sendBtn.classList.remove('loading');
      sendBtn.disabled = false;
    }
  });

  function renderDevLink(link) {
    let host = document.getElementById('dev-link');
    if (!link) {
      if (host) host.remove();
      return;
    }
    if (!host) {
      host = document.createElement('div');
      host.id = 'dev-link';
      host.className = 'dev-link';
      $('state-waiting').appendChild(host);
    }
    const waMsg = encodeURIComponent(
      `Hi, please fill in this quick registration form (1 minute): ${link}`
    );
    const smsBody = encodeURIComponent(
      `Hi! Please fill in this quick registration form: ${link}`
    );
    host.innerHTML = `
      <div class="dev-link-title">Share the form link</div>
      <div class="dev-link-actions">
        <button type="button" class="share-btn" data-action="copy">📋 Copy</button>
        <button type="button" class="share-btn" data-action="whatsapp">💬 WhatsApp</button>
        <button type="button" class="share-btn" data-action="sms">📱 SMS</button>
      </div>
      <a href="#" class="dev-link-url" data-action="open"></a>
    `;
    host.querySelector('.dev-link-url').textContent = link;

    host.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        const action = el.getAttribute('data-action');
        if (action === 'copy') {
          await navigator.clipboard.writeText(link);
          el.textContent = '✓ Copied';
          setTimeout(() => (el.textContent = '📋 Copy'), 1500);
        } else if (action === 'whatsapp') {
          chrome.tabs.create({ url: `https://wa.me/?text=${waMsg}` });
        } else if (action === 'sms') {
          chrome.tabs.create({ url: `sms:?&body=${smsBody}` });
        } else if (action === 'open') {
          chrome.tabs.create({ url: link });
        }
      });
    });
  }

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
    waBtn.disabled = true;
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
    if (/realtime/i.test(m)) return 'Realtime keys missing — check Pusher settings.';
    // The /api/send endpoint already returns specific, user-readable messages
    // (e.g. Twilio auth/verification failures) — surface them as-is.
    return m;
  }
})();
