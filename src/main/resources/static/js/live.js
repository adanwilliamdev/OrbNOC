/*
 * OrbNOC — comportamento do navegador (sem bibliotecas, sem etapa de build).
 * As páginas são renderizadas pelo servidor; este arquivo só cuida de:
 *  - WebSocket (/ws): ao receber mudanças, recarrega os fragmentos HTML marcados com data-fragment;
 *  - ações (ping, remover, limite de latência, Telegram, usuários...) via API JSON;
 *  - horário local, toasts, som de alerta, pan/zoom do mapa e diagnóstico.
 */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  // ---------------------------------------------------------------- utilidades

  function toast(message, kind = 'info', ms = 4500) {
    const box = $('#toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  async function api(path, { method = 'GET', body } = {}) {
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401 && !location.pathname.startsWith('/login')) {
      location.href = '/login';
      throw new Error('Sessão expirada');
    }
    let data = null;
    try { data = await response.json(); } catch (e) { /* resposta sem corpo */ }
    if (!response.ok) throw new Error((data && data.detail) || 'Erro ' + response.status);
    return data;
  }

  const errorText = (e) => (e && e.message) || 'Erro inesperado';

  // ------------------------------------------------------------ horário local

  function formatLocal(el) {
    const iso = el.dataset.iso || el.getAttribute('datetime');
    if (!iso) return;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return;
    switch (el.dataset.localtime) {
      case 'rel': return; // texto relativo vem do servidor e é atualizado nos fragmentos
      case 'hm':
        el.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        break;
      case 'dmh':
        el.textContent = date.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit' }) + 'h';
        break;
      default:
        el.textContent = date.toLocaleString();
    }
  }
  const formatAllLocal = (root = document) => $$('[data-localtime]', root).forEach(formatLocal);

  // ---------------------------------------------------- fragmentos em tempo real

  const expandedRows = new Set();
  let refreshing = false;
  let refreshTimer = null;

  function restoreUiState() {
    expandedRows.forEach((id) => {
      const row = $('[data-detail="' + id + '"]');
      if (row) row.hidden = false;
    });
    restorePanZoom();
  }

  async function refreshFragments() {
    if (refreshing) return;
    const targets = $$('[data-fragment]');
    if (!targets.length) return;
    refreshing = true;
    try {
      await Promise.all(targets.map(async (el) => {
        const base = el.dataset.fragment;
        const query = location.search ? location.search.slice(1) : '';
        const url = query ? base + (base.includes('?') ? '&' : '?') + query : base;
        const response = await fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' } });
        if (response.status === 401) { location.href = '/login'; return; }
        if (!response.ok) return;
        const html = await response.text();
        if (el._last !== html) {
          el.innerHTML = html;
          el._last = html;
        }
      }));
      formatAllLocal();
      restoreUiState();
    } catch (e) {
      /* rede instável: tenta de novo no próximo ciclo */
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh(delay = 300) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshFragments, delay);
  }

  // ----------------------------------------------------------------------- som

  let audio = null;
  const soundOn = () => localStorage.getItem('orbnoc.sound') === 'on';

  function renderSoundState() {
    $$('[data-sound-state]').forEach((el) => { el.textContent = soundOn() ? 'ligado' : 'desligado'; });
  }

  function beep() {
    if (!soundOn()) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.25);
    } catch (e) { /* áudio indisponível */ }
  }

  // ----------------------------------------------------------------- WebSocket

  let socket = null;
  let retry = 1000;

  function setConn(state, text) {
    $$('[data-conn]').forEach((el) => {
      el.textContent = text;
      el.classList.toggle('live', state === 'live');
      el.classList.toggle('down', state === 'down');
    });
  }

  function connect() {
    if (!$('[data-conn]') && !$('[data-fragment]')) return;
    const scheme = location.protocol === 'https:' ? 'wss://' : 'ws://';
    socket = new WebSocket(scheme + location.host + '/ws');
    socket.onopen = () => { retry = 1000; setConn('live', 'Ao vivo'); };
    socket.onmessage = (message) => {
      let data;
      try { data = JSON.parse(message.data); } catch (e) { return; }
      if (data.type === 'devices_update') {
        scheduleRefresh();
      } else if (data.type === 'event' && data.event) {
        const ev = data.event;
        const kind = ev.severity === 'error' ? 'bad' : ev.severity === 'warning' ? 'warn' : ev.severity === 'success' ? 'ok' : 'info';
        toast(ev.message, kind, 7000);
        if (ev.severity === 'error') beep();
        scheduleRefresh(150);
      }
    };
    socket.onclose = (event) => {
      if (event.code === 4401) { location.href = '/login'; return; }
      if (event.code === 4403) { setConn('down', 'Origem bloqueada'); return; }
      setConn('down', 'Reconectando…');
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 30000);
    };
    socket.onerror = () => socket.close();
  }

  // ----------------------------------------------------------- mapa: pan e zoom

  const viewState = new Map(); // id do svg -> viewBox atual (preserva o zoom entre atualizações)

  function restorePanZoom() {
    $$('[data-pan-zoom]').forEach((svg) => {
      if (viewState.has(svg.id)) svg.setAttribute('viewBox', viewState.get(svg.id).join(' '));
    });
  }

  function currentBox(svg) {
    return svg.getAttribute('viewBox').split(/\s+/).map(Number);
  }

  document.addEventListener('wheel', (event) => {
    const svg = event.target.closest && event.target.closest('[data-pan-zoom]');
    if (!svg) return;
    event.preventDefault();
    const [x, y, w, h] = currentBox(svg);
    const factor = event.deltaY > 0 ? 1.12 : 1 / 1.12;
    const rect = svg.getBoundingClientRect();
    const px = x + ((event.clientX - rect.left) / rect.width) * w;
    const py = y + ((event.clientY - rect.top) / rect.height) * h;
    const nw = w * factor;
    const nh = h * factor;
    const box = [px - (px - x) * factor, py - (py - y) * factor, nw, nh];
    svg.setAttribute('viewBox', box.join(' '));
    viewState.set(svg.id, box);
  }, { passive: false });

  let drag = null;
  document.addEventListener('pointerdown', (event) => {
    const svg = event.target.closest && event.target.closest('[data-pan-zoom]');
    if (!svg || event.target.closest('.node')) return;
    drag = { svg, x: event.clientX, y: event.clientY, box: currentBox(svg), moved: false };
    svg.classList.add('dragging');
  });
  document.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const rect = drag.svg.getBoundingClientRect();
    const dx = ((event.clientX - drag.x) / rect.width) * drag.box[2];
    const dy = ((event.clientY - drag.y) / rect.height) * drag.box[3];
    const box = [drag.box[0] - dx, drag.box[1] - dy, drag.box[2], drag.box[3]];
    drag.svg.setAttribute('viewBox', box.join(' '));
    viewState.set(drag.svg.id, box);
  });
  document.addEventListener('pointerup', () => {
    if (drag) drag.svg.classList.remove('dragging');
    drag = null;
  });

  function showNode(node) {
    const panel = $('#map-detail');
    if (!panel) return;
    ['title', 'sub', 'status', 'latency', 'checked'].forEach((key) => {
      const el = $('[data-d="' + key + '"]', panel);
      if (el) el.textContent = node.dataset[key] || '—';
    });
    panel.hidden = false;
  }

  // ------------------------------------------------------------------- diálogos

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && !dialog.open) dialog.showModal();
    return dialog;
  }
  const closeDialog = (el) => { const d = el.closest('dialog'); if (d) d.close(); };

  function showError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  // ------------------------------------------------------------------- ações

  let slaDeviceId = null;

  async function saveSla(threshold) {
    try {
      await api('/api/alerts/sla/configure', { method: 'POST', body: { device_id: slaDeviceId, threshold_ms: threshold } });
      toast(threshold ? 'Limite de ' + threshold + ' ms salvo' : 'Limite removido', 'ok');
      closeDialog($('#sla-form'));
      refreshFragments();
    } catch (e) { toast(errorText(e), 'bad'); }
  }

  const actions = {
    async logout() {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* segue para o login */ }
      location.href = '/login';
    },
    refresh() { refreshFragments(); toast('Atualizado', 'info', 1500); },
    sound() {
      localStorage.setItem('orbnoc.sound', soundOn() ? 'off' : 'on');
      renderSoundState();
      beep();
    },
    'toggle-add'() {
      const form = $('#add-device-form');
      form.hidden = !form.hidden;
      if (!form.hidden) $('input[name="name"]', form).focus();
    },
    'toggle-row'(el) {
      const id = el.dataset.id;
      const row = $('[data-detail="' + id + '"]');
      if (!row) return;
      row.hidden = !row.hidden;
      if (row.hidden) expandedRows.delete(id); else expandedRows.add(id);
    },
    async ping(el) {
      el.disabled = true;
      try {
        const r = await api('/api/devices/' + el.dataset.id + '/ping', { method: 'POST' });
        toast(r.error ? r.name + ': sem resposta (' + r.error + ')' : r.name + ': ' + r.latency_ms + ' ms (' + r.method + ')', r.error ? 'bad' : 'ok');
        refreshFragments();
      } catch (e) { toast(errorText(e), 'bad'); } finally { el.disabled = false; }
    },
    async 'test-all'(el) {
      const ids = [...new Set($$('[data-action="ping"]').map((b) => b.dataset.id))];
      if (!ids.length) { toast('Nenhum dispositivo para testar', 'warn'); return; }
      el.disabled = true;
      let ok = 0;
      for (const id of ids) {
        try { const r = await api('/api/devices/' + id + '/ping', { method: 'POST' }); if (!r.error) ok++; } catch (e) { /* conta como falha */ }
      }
      el.disabled = false;
      toast(ok + ' de ' + ids.length + ' responderam', ok === ids.length ? 'ok' : 'warn');
      refreshFragments();
    },
    async remove(el) {
      if (!confirm('Remover "' + el.dataset.name + '" e todo o histórico dele?')) return;
      try {
        await api('/api/devices/' + el.dataset.id, { method: 'DELETE' });
        toast('Dispositivo removido', 'ok');
        refreshFragments();
      } catch (e) { toast(errorText(e), 'bad'); }
    },
    sla(el) {
      slaDeviceId = Number(el.dataset.id);
      $('#sla-name').textContent = el.dataset.name;
      $('#sla-input').value = el.dataset.threshold || '';
      openDialog('sla-dialog');
    },
    'sla-clear'() { saveSla(null); },
    'close-dialog'(el) { closeDialog(el); },
    async telegram() {
      const dialog = openDialog('telegram-dialog');
      const form = $('#telegram-form');
      showError('telegram-error', '');
      try {
        const cfg = await api('/api/alerts/telegram');
        form.elements.chat_id.value = cfg.chat_id || '';
        form.elements.enabled.checked = !!cfg.enabled;
        form.elements.bot_token.value = '';
        form.elements.bot_token.placeholder = cfg.bot_token_set ? 'token salvo — deixe vazio para manter' : '123456:ABC...';
        const status = $('#telegram-status');
        status.hidden = false;
        status.textContent = cfg.enabled ? 'Notificações ativas.' : 'Notificações desativadas.';
      } catch (e) { showError('telegram-error', errorText(e)); }
      return dialog;
    },
    async 'telegram-remove'() {
      if (!confirm('Remover a configuração do Telegram?')) return;
      try {
        await api('/api/alerts/telegram', { method: 'DELETE' });
        toast('Telegram removido', 'ok');
        closeDialog($('#telegram-form'));
      } catch (e) { showError('telegram-error', errorText(e)); }
    },
    async ack(el) {
      try { await api('/api/alerts/' + el.dataset.id + '/ack', { method: 'POST' }); refreshFragments(); } catch (e) { toast(errorText(e), 'bad'); }
    },
    async 'ack-all'() {
      try { await api('/api/alerts/ack-all', { method: 'POST' }); refreshFragments(); } catch (e) { toast(errorText(e), 'bad'); }
    },
    'user-new'() { showError('user-error', ''); $('#user-form').reset(); openDialog('user-dialog'); },
    async 'user-toggle'(el) {
      try { await api('/api/users/' + el.dataset.id, { method: 'PATCH', body: { is_active: el.dataset.active === 'true' } }); location.reload(); } catch (e) { toast(errorText(e), 'bad'); }
    },
    async 'user-role'(el) {
      try { await api('/api/users/' + el.dataset.id, { method: 'PATCH', body: { role: el.dataset.role } }); location.reload(); } catch (e) { toast(errorText(e), 'bad'); }
    },
    'user-reset'(el) {
      $('#reset-form').dataset.id = el.dataset.id;
      $('#reset-name').textContent = el.dataset.name;
      $('#reset-form').reset();
      showError('reset-error', '');
      openDialog('reset-dialog');
    },
    async 'user-delete'(el) {
      if (!confirm('Remover o usuário "' + el.dataset.name + '" e todos os dados dele?')) return;
      try { await api('/api/users/' + el.dataset.id, { method: 'DELETE' }); location.reload(); } catch (e) { toast(errorText(e), 'bad'); }
    },
    'diag-tool'(el) { setDiagTool(el.dataset.tool); },
    print() { window.print(); },
    fullscreen() {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
    },
  };

  document.addEventListener('click', (event) => {
    const node = event.target.closest && event.target.closest('.node');
    if (node) { showNode(node); return; }
    if (event.target.closest && event.target.closest('[data-pan-zoom]')) {
      const panel = $('#map-detail');
      if (panel) panel.hidden = true;
    }
    const el = event.target.closest && event.target.closest('[data-action]');
    if (!el) return;
    const handler = actions[el.dataset.action];
    if (handler) { event.preventDefault(); handler(el); }
  });

  // ------------------------------------------------------------- diagnóstico

  function setDiagTool(tool) {
    const form = $('#diag-form');
    if (!form) return;
    form.elements.tool.value = tool;
    $$('[data-action="diag-tool"]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
    $$('.tool-field').forEach((f) => f.classList.toggle('show', f.dataset.for.split(' ').includes(tool)));
    const label = $('[data-host-label]');
    if (label) label.textContent = tool === 'dns' ? 'Domínio' : 'Host';
  }

  // -------------------------------------------------------------- formulários

  function formValues(form) {
    const values = {};
    new FormData(form).forEach((v, k) => { values[k] = typeof v === 'string' ? v.trim() : v; });
    return values;
  }
  const intOrNull = (v) => (v === undefined || v === '' ? null : Number(v));

  document.addEventListener('submit', async (event) => {
    const form = event.target;

    if (form.id === 'login-form') {
      event.preventDefault();
      showError('login-error', '');
      const v = formValues(form);
      try {
        await api('/api/auth/login', { method: 'POST', body: { username: v.username, password: v.password } });
        location.href = '/';
      } catch (e) { showError('login-error', errorText(e)); }
    } else if (form.id === 'register-form') {
      event.preventDefault();
      showError('register-error', '');
      try {
        await api('/api/auth/register', { method: 'POST', body: formValues(form) });
        location.href = '/';
      } catch (e) { showError('register-error', errorText(e)); }
    } else if (form.id === 'add-device-form') {
      event.preventDefault();
      showError('add-error', '');
      const v = formValues(form);
      const body = {
        name: v.name, ip: v.ip, location: v.location || null, check_type: v.check_type,
        port: v.check_type === 'tcp' ? intOrNull(v.port) : null,
        interval_seconds: intOrNull(v.interval_seconds), failure_threshold: intOrNull(v.failure_threshold),
        sla_threshold_ms: intOrNull(v.sla_threshold_ms),
      };
      try {
        await api('/api/devices', { method: 'POST', body });
        form.reset();
        form.hidden = true;
        toast('Dispositivo adicionado', 'ok');
        refreshFragments();
      } catch (e) { showError('add-error', errorText(e)); }
    } else if (form.id === 'sla-form') {
      event.preventDefault();
      const value = $('#sla-input').value;
      if (!value) { toast('Informe o limite em ms ou use "Remover limite"', 'warn'); return; }
      saveSla(Number(value));
    } else if (form.id === 'telegram-form') {
      event.preventDefault();
      showError('telegram-error', '');
      const els = form.elements;
      try {
        const r = await api('/api/alerts/telegram', {
          method: 'PUT',
          body: { enabled: els.enabled.checked, bot_token: els.bot_token.value.trim() || null, chat_id: els.chat_id.value.trim() || null },
        });
        if (r.test_sent === true) toast('Telegram configurado — mensagem de teste enviada', 'ok');
        else if (r.test_sent === false) showError('telegram-error', 'Salvo, mas o teste falhou: ' + (r.test_error || 'erro desconhecido'));
        else toast('Configuração salva', 'ok');
        if (r.test_sent !== false) closeDialog(form);
      } catch (e) { showError('telegram-error', errorText(e)); }
    } else if (form.id === 'user-form') {
      event.preventDefault();
      showError('user-error', '');
      try {
        await api('/api/users', { method: 'POST', body: formValues(form) });
        location.reload();
      } catch (e) { showError('user-error', errorText(e)); }
    } else if (form.id === 'reset-form') {
      event.preventDefault();
      showError('reset-error', '');
      try {
        await api('/api/users/' + form.dataset.id, { method: 'PATCH', body: { password: form.elements.password.value } });
        closeDialog(form);
        toast('Senha atualizada', 'ok');
      } catch (e) { showError('reset-error', errorText(e)); }
    } else if (form.id === 'diag-form') {
      event.preventDefault();
      const out = $('#diag-result');
      out.innerHTML = '<p class="muted empty">Executando…</p>';
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      try {
        const response = await fetch('/ui/diagnostic/run', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        if (response.status === 401) { location.href = '/login'; return; }
        out.innerHTML = response.ok ? await response.text() : '<div class="alert-box">Falha ao executar o diagnóstico</div>';
      } catch (e) {
        out.innerHTML = '<div class="alert-box">Não foi possível falar com o servidor</div>';
      } finally { button.disabled = false; }
    }
  });

  document.addEventListener('change', (event) => {
    const select = event.target;
    if (select.name === 'check_type' && select.form && select.form.id === 'add-device-form') {
      $$('[data-tcp-only]', select.form).forEach((el) => { el.hidden = select.value !== 'tcp'; });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      const node = event.target.closest && event.target.closest('.node');
      if (node) { event.preventDefault(); showNode(node); }
    }
  });

  // ------------------------------------------------------------------- início

  document.addEventListener('DOMContentLoaded', async () => {
    formatAllLocal();
    renderSoundState();
    setDiagTool(($('#diag-form') && $('#diag-form').elements.tool.value) || 'full');
    if ($('#register-box')) {
      try {
        const cfg = await api('/api/auth/config');
        if (cfg.registration_enabled) $('#register-box').hidden = false;
      } catch (e) { /* sem registro */ }
    }
    connect();
    if ($$('[data-fragment]').length) setInterval(refreshFragments, 30000);
  });
})();
