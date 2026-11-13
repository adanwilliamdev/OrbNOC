/*
 * OrbNOC — comportamento do navegador (sem bibliotecas, sem etapa de build).
 * As páginas são renderizadas pelo servidor; este arquivo só cuida de:
 *  - WebSocket (/ws): ao receber mudanças, atualiza os fragmentos HTML marcados com data-fragment.
 *    A atualização é feita "no lugar" (morph): só o que mudou é tocado, então foco, rolagem, linhas
 *    abertas e animações continuam onde estavam, e valores que mudam piscam de leve;
 *  - filtros, ordenação e layout do mapa sem recarregar a página (a URL continua compartilhável);
 *  - ações (ping, remover, limite de latência, Telegram, usuários...) via API JSON;
 *  - horário local, avisos (toasts), confirmações, som de alerta, pan/zoom do mapa e diagnóstico.
 */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  // ---------------------------------------------------------------- utilidades

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function dismissToast(el, now) {
    if (!el || el.classList.contains('leaving')) return;
    if (now || reducedMotion()) { el.remove(); return; }
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 500);
  }

  // Aviso curto no canto da tela: fecha sozinho, pausa com o mouse em cima e tem botão de fechar.
  function toast(message, kind = 'info', ms = 4500) {
    const box = $('#toasts');
    if (!box) return;
    while (box.children.length >= 4) dismissToast(box.firstElementChild, true);
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
    const text = document.createElement('span');
    text.className = 'toast-msg';
    text.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-x';
    close.setAttribute('aria-label', 'Fechar aviso');
    close.textContent = '×';
    close.addEventListener('click', () => dismissToast(el));
    el.append(text, close);
    box.appendChild(el);
    let timer = setTimeout(() => dismissToast(el), ms);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(() => dismissToast(el), 1800); });
  }

  // Confirmação no padrão visual do app (no lugar do confirm() do navegador). Resolve true/false.
  function confirmDialog({ title, message, confirm = 'Confirmar', danger = false }) {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'dialog dialog-confirm';
      dialog.setAttribute('aria-labelledby', 'confirm-title');
      const form = document.createElement('form');
      form.method = 'dialog';
      form.className = 'stack';
      const h = document.createElement('h3');
      h.id = 'confirm-title';
      h.textContent = title;
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = message;
      const actions = document.createElement('div');
      actions.className = 'form-actions';
      const ok = document.createElement('button');
      ok.type = 'submit';
      ok.value = 'ok';
      ok.className = 'btn btn-sm ' + (danger ? 'btn-danger-solid' : 'btn-primary');
      ok.textContent = confirm;
      const cancel = document.createElement('button');
      cancel.type = 'submit';
      cancel.value = 'cancel';
      cancel.className = 'btn btn-ghost btn-sm';
      cancel.textContent = 'Cancelar';
      actions.append(ok, cancel);
      form.append(h, p, actions);
      dialog.appendChild(form);
      dialog.addEventListener('close', () => { const yes = dialog.returnValue === 'ok'; dialog.remove(); resolve(yes); });
      document.body.appendChild(dialog);
      dialog.showModal();
      cancel.focus(); // o gesto padrão (Enter) é o seguro
    });
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
  let again = false;
  let staleWhileHidden = false;
  let refreshTimer = null;
  let selectedNode = null; // chave do nó aberto no painel do mapa
  let baseTitle = null;

  // Elementos cujo valor mudando merece um piscar discreto.
  const FLASH = '.lat, .kpi-value, .bar-val, .tile-lat, .orb-num, .uptime-big, .pill, .w-chips b, .w-facts b';

  function flash(el) {
    if (!el || reducedMotion()) return;
    el.classList.remove('flash');
    void el.offsetWidth; // reinicia a animação
    el.classList.add('flash');
    el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
  }

  const keyOf = (n) => {
    if (n.nodeType !== 1) return null;
    if (n.dataset.row) return 'row:' + n.dataset.row;
    if (n.dataset.detail) return 'det:' + n.dataset.detail;
    if (n.dataset.key) return 'key:' + n.dataset.key;
    return n.id ? 'id:' + n.id : null;
  };
  const classKey = (el) => el.className && el.className.baseVal !== undefined
    ? el.className.baseVal.replace(/\bflash\b/g, '').trim().replace(/\s+/g, ' ')
    : (el.getAttribute('class') || '').replace(/\bflash\b/g, '').trim().replace(/\s+/g, ' ');

  function syncAttributes(a, b) {
    // não mexe no que o navegador controla: linha aberta, painel do mapa, zoom, arrasto e botão ocupado
    if (a.dataset && a.dataset.busy) return;
    const keepHidden = a.matches('[data-detail], #map-detail');
    const panZoom = a.matches('[data-pan-zoom]');
    for (const { name, value } of Array.from(b.attributes)) {
      if (name === 'hidden' && keepHidden) continue;
      if (name === 'viewBox' && panZoom) { a.dataset.home = value; if (viewState.has(a.id)) continue; }
      if (name === 'class') {
        if (panZoom) continue;
        if (classKey(a) !== value.trim().replace(/\s+/g, ' ')) {
          a.setAttribute('class', value);
          if (a.matches('.pill')) flash(a);
        }
        continue;
      }
      if (a.getAttribute(name) !== value) a.setAttribute(name, value);
    }
    for (const { name } of Array.from(a.attributes)) {
      if (b.hasAttribute(name)) continue;
      if (name === 'hidden' && keepHidden) continue;
      if (name === 'class' && panZoom) continue;
      if (name === 'class' && classKey(a) === '') continue;
      if (name === 'viewBox' && panZoom) continue;
      a.removeAttribute(name);
    }
  }

  function morph(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b.cloneNode(true)); return; }
    if (a.nodeType !== 1) {
      if (a.nodeValue !== b.nodeValue) {
        a.nodeValue = b.nodeValue;
        if (a.nodeType === 3 && a.parentElement && a.parentElement.matches(FLASH) && a.nodeValue.trim()) flash(a.parentElement);
      }
      return;
    }
    syncAttributes(a, b);
    if (a.matches('#map-detail')) return; // preenchido pelo navegador (nó selecionado)
    const mode = a.dataset.localtime;
    if (mode && mode !== 'rel' && a.getAttribute('data-iso') === b.getAttribute('data-iso')) return; // horário já formatado
    morphChildren(a, b);
  }

  function morphChildren(from, to) {
    const olds = Array.from(from.childNodes);
    const byKey = new Map();
    olds.forEach((n) => { const k = keyOf(n); if (k) byKey.set(k, n); });
    const used = new Set();
    let ref = from.firstChild;
    for (const nn of Array.from(to.childNodes)) {
      const k = keyOf(nn);
      let match = null;
      if (k) {
        match = byKey.get(k) || null;
        if (match && used.has(match)) match = null;
      } else {
        while (ref && (used.has(ref) || keyOf(ref))) ref = ref.nextSibling; // pula nós de chave (casam por chave)
        if (ref && ref.nodeType === nn.nodeType && ref.nodeName === nn.nodeName) match = ref;
      }
      if (match) {
        used.add(match);
        if (k) {
          if (match !== ref) from.insertBefore(match, ref); // reordena sem recriar
          else ref = ref.nextSibling;
        } else ref = match.nextSibling;
        morph(match, nn);
      } else {
        const copy = nn.cloneNode(true);
        used.add(copy);
        from.insertBefore(copy, k ? ref : ref);
      }
    }
    olds.forEach((n) => { if (!used.has(n) && n.parentNode === from) n.remove(); });
  }

  function applyFragment(el, html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    morphChildren(el, tpl.content);
  }

  function restoreUiState() {
    expandedRows.forEach((id) => {
      const row = $('[data-detail="' + id + '"]');
      if (row) row.hidden = false;
    });
    $$('[data-action="toggle-row"]').forEach((b) => b.setAttribute('aria-expanded', String(expandedRows.has(b.dataset.id))));
    restorePanZoom();
    restoreNode();
  }

  function updateTitle() {
    const hero = $('[data-offline]');
    if (!hero) return;
    baseTitle = baseTitle || document.title.replace(/^\(\d+\)\s*/, '');
    const n = Number(hero.dataset.offline) || 0;
    document.title = n > 0 ? '(' + n + ') ' + baseTitle : baseTitle;
  }

  async function refreshFragments(force = false) {
    if (document.hidden && !force) { staleWhileHidden = true; return; }
    if (refreshing) { again = true; return; }
    const targets = $$('[data-fragment]');
    if (!targets.length) return;
    refreshing = true;
    const search = location.search;
    try {
      const loaded = await Promise.all(targets.map(async (el) => {
        const base = el.dataset.fragment;
        const query = search ? search.slice(1) : '';
        const url = query ? base + (base.includes('?') ? '&' : '?') + query : base;
        const response = await fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' } });
        if (response.status === 401) { location.href = '/login'; return null; }
        if (!response.ok) return null;
        return [el, await response.text()];
      }));
      if (search !== location.search) {
        again = true; // a URL mudou durante o pedido: descarta esta resposta e busca de novo
      } else {
        loaded.forEach((item) => {
          if (!item || item[0]._last === item[1]) return;
          applyFragment(item[0], item[1]);
          item[0]._last = item[1];
        });
        formatAllLocal();
        restoreUiState();
        updateTitle();
      }
    } catch (e) {
      /* rede instável: tenta de novo no próximo ciclo */
    } finally {
      refreshing = false;
      if (again) { again = false; scheduleRefresh(0, true); }
    }
  }

  function scheduleRefresh(delay = 300, force = false) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshFragments(force), delay);
  }

  // ---------------------------------------------- navegação sem recarregar (filtros e mapa)

  const softPage = () => $$('[data-fragment]').length > 0 && !document.body.classList.contains('wall-body');

  function filtersForm() { return $('form.filters'); }

  // Os controles de filtro ficam fora do fragmento; depois de trocar a URL eles são alinhados a ela.
  function syncFilterControls() {
    const params = new URLSearchParams(location.search);
    const form = filtersForm();
    if (form) {
      ['sort', 'dir', 'status', 'q', 'min', 'max'].forEach((name) => {
        const field = form.elements[name];
        if (!field) return;
        field.value = params.get(name) || (name === 'status' ? 'all' : name === 'sort' ? 'name' : name === 'dir' ? 'asc' : '');
      });
      const status = params.get('status') || 'all';
      $$('.segmented a', form).forEach((a) => a.classList.toggle('on', (new URL(a.href).searchParams.get('status') || 'all') === status));
      const active = ['q', 'min', 'max'].some((k) => params.get(k)) || status !== 'all';
      const clear = $('[data-clear]', form);
      if (clear) clear.classList.toggle('is-off', !active);
      const adv = $('details.advanced', form);
      if (adv && (params.get('min') || params.get('max'))) adv.open = true;
    }
    const mode = params.get('mode');
    $$('[data-mode-link]').forEach((a) => a.classList.toggle('on', new URL(a.href).searchParams.get('mode') === (mode || 'hierarchical')));
  }

  function softNavigate(url, replace = false) {
    const target = new URL(url, location.href);
    if (target.search === location.search) return;
    const modeOf = (search) => new URLSearchParams(search).get('mode') || 'hierarchical';
    if (modeOf(target.search) !== modeOf(location.search)) { viewState.clear(); clearNode(); } // outro layout: zoom e nó escolhido não valem mais
    history[replace ? 'replaceState' : 'pushState']({}, '', target.pathname + target.search);
    syncFilterControls();
    refreshFragments(true);
  }

  window.addEventListener('popstate', () => { viewState.clear(); clearNode(); syncFilterControls(); refreshFragments(true); });

  function filterUrlFromForm(form) {
    const params = new URLSearchParams();
    const data = new FormData(form);
    const defaults = { status: 'all', sort: 'name', dir: 'asc' };
    data.forEach((value, name) => {
      const v = String(value).trim();
      if (v && defaults[name] !== v) params.set(name, v);
    });
    const qs = params.toString();
    return location.pathname + (qs ? '?' + qs : '');
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
      if (!svg.dataset.home) svg.dataset.home = svg.getAttribute('viewBox');
      if (viewState.has(svg.id)) svg.setAttribute('viewBox', viewState.get(svg.id).join(' '));
    });
  }

  function zoomMap(factor) {
    const svg = $('[data-pan-zoom]');
    if (!svg) return;
    const [x, y, w, h] = currentBox(svg);
    const box = [x + (w - w * factor) / 2, y + (h - h * factor) / 2, w * factor, h * factor];
    svg.setAttribute('viewBox', box.join(' '));
    viewState.set(svg.id, box);
  }

  function resetMap() {
    const svg = $('[data-pan-zoom]');
    if (!svg) return;
    viewState.delete(svg.id);
    if (svg.dataset.home) svg.setAttribute('viewBox', svg.dataset.home);
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
  let dragMoved = false; // o clique que termina um arrasto não fecha o painel do nó
  document.addEventListener('pointerdown', (event) => {
    const svg = event.target.closest && event.target.closest('[data-pan-zoom]');
    if (!svg || event.target.closest('.node')) return;
    drag = { svg, x: event.clientX, y: event.clientY, box: currentBox(svg) };
    dragMoved = false;
    svg.classList.add('dragging');
  });
  document.addEventListener('pointermove', (event) => {
    if (!drag) return;
    if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 4) dragMoved = true;
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

  const nodeKey = (node) => (node.dataset.title || '') + '|' + (node.dataset.sub || '');

  function showNode(node) {
    const panel = $('#map-detail');
    if (!panel) return;
    ['title', 'sub', 'status', 'latency', 'checked'].forEach((key) => {
      const el = $('[data-d="' + key + '"]', panel);
      if (el) el.textContent = node.dataset[key] || '—';
    });
    panel.hidden = false;
    selectedNode = nodeKey(node);
    $$('.node.selected').forEach((n) => n.classList.remove('selected'));
    node.classList.add('selected');
  }

  // Depois de cada atualização o nó escolhido continua aberto, com os valores novos.
  function restoreNode() {
    const panel = $('#map-detail');
    if (!panel || !selectedNode) return;
    const node = $$('.node').find((n) => nodeKey(n) === selectedNode);
    if (node) showNode(node);
    else { panel.hidden = true; selectedNode = null; }
  }

  function clearNode() {
    selectedNode = null;
    $$('.node.selected').forEach((n) => n.classList.remove('selected'));
    const panel = $('#map-detail');
    if (panel) panel.hidden = true;
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
    async refresh(el) {
      el.dataset.busy = '1';
      el.classList.add('is-busy');
      await refreshFragments(true);
      el.classList.remove('is-busy');
      delete el.dataset.busy;
      toast('Atualizado', 'info', 1500);
    },
    'map-zoom-in'() { zoomMap(1 / 1.25); },
    'map-zoom-out'() { zoomMap(1.25); },
    'map-reset'() { resetMap(); },
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
      $$('[data-action="toggle-row"][data-id="' + id + '"]').forEach((b) => b.setAttribute('aria-expanded', String(!row.hidden)));
    },
    async ping(el) {
      el.disabled = true;
      el.dataset.busy = '1';
      el.classList.add('is-busy');
      try {
        const r = await api('/api/devices/' + el.dataset.id + '/ping', { method: 'POST' });
        toast(r.error ? r.name + ': sem resposta (' + r.error + ')' : r.name + ': ' + r.latency_ms + ' ms (' + r.method + ')', r.error ? 'bad' : 'ok');
        refreshFragments();
      } catch (e) { toast(errorText(e), 'bad'); } finally {
        el.disabled = false;
        el.classList.remove('is-busy');
        delete el.dataset.busy;
      }
    },
    async 'test-all'(el) {
      const ids = [...new Set($$('[data-action="ping"]').map((b) => b.dataset.id))];
      if (!ids.length) { toast('Nenhum dispositivo para testar', 'warn'); return; }
      el.disabled = true;
      el.classList.add('is-busy');
      let ok = 0;
      let done = 0;
      const label = el.textContent;
      for (const id of ids) {
        el.textContent = 'Testando ' + (++done) + '/' + ids.length;
        try { const r = await api('/api/devices/' + id + '/ping', { method: 'POST' }); if (!r.error) ok++; } catch (e) { /* conta como falha */ }
      }
      el.textContent = label;
      el.classList.remove('is-busy');
      el.disabled = false;
      toast(ok + ' de ' + ids.length + ' responderam', ok === ids.length ? 'ok' : 'warn');
      refreshFragments();
    },
    async remove(el) {
      if (!(await confirmDialog({ title: 'Remover dispositivo', message: '“' + el.dataset.name + '” e todo o histórico dele serão apagados. Isso não pode ser desfeito.', confirm: 'Remover', danger: true }))) return;
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
      if (!(await confirmDialog({ title: 'Remover Telegram', message: 'Os alertas deixam de ser enviados ao Telegram e o token salvo é apagado.', confirm: 'Remover', danger: true }))) return;
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
      if (!(await confirmDialog({ title: 'Remover usuário', message: '“' + el.dataset.name + '” e todos os dados dele serão apagados. Isso não pode ser desfeito.', confirm: 'Remover', danger: true }))) return;
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
    if (event.target.closest && event.target.closest('[data-pan-zoom]') && !dragMoved) clearNode();

    // clicar fora da caixa de um diálogo (no fundo escurecido) fecha o diálogo
    if (event.target instanceof HTMLDialogElement && event.target.open) {
      const r = event.target.getBoundingClientRect();
      const outside = event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
      if (outside) { event.target.close(); return; }
    }

    // filtros, ordenação e layout do mapa sem recarregar a página
    const link = event.target.closest && event.target.closest('a[href]');
    if (link && softPage() && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
        && !link.target && link.origin === location.origin && link.pathname === location.pathname
        && link.closest('.segmented, thead, .filters, .actions')) {
      event.preventDefault();
      const url = new URL(link.href);
      if (link.closest('.filters .segmented')) {
        // os links de status foram montados quando a página abriu; o status vem deles, o resto vem da URL atual
        const params = new URLSearchParams(location.search);
        const status = url.searchParams.get('status');
        if (status) params.set('status', status); else params.delete('status');
        url.search = params.toString();
      }
      softNavigate(url.pathname + url.search);
      return;
    }

    const el = event.target.closest && event.target.closest('[data-action]');
    if (!el) {
      // a linha inteira abre os detalhes (botões e links dentro dela seguem funcionando)
      const row = event.target.closest && event.target.closest('tr.row');
      if (row && !event.target.closest('button, a, input, select, textarea') && window.getSelection().toString() === '') {
        actions['toggle-row']({ dataset: { id: row.dataset.row } });
      }
      return;
    }
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

    if (form.matches && form.matches('form.filters') && softPage()) {
      event.preventDefault();
      softNavigate(filterUrlFromForm(form));
      return;
    }
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

  // busca e faixa de latência filtram enquanto você digita
  let filterTimer = null;
  document.addEventListener('input', (event) => {
    const field = event.target;
    const form = field.form;
    if (!form || !form.matches('form.filters') || !softPage() || field.type === 'hidden') return;
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => softNavigate(filterUrlFromForm(form), true), 280);
  });

  document.addEventListener('keydown', (event) => {
    // "/" leva direto à busca, como em tantas ferramentas
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
      const search = $('form.filters input[type="search"]');
      if (search) { event.preventDefault(); search.focus(); search.select(); }
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const node = event.target.closest && event.target.closest('.node');
      if (node) { event.preventDefault(); showNode(node); }
    }
  });

  // ------------------------------------------------------------ wallboard (TV)

  function tickClock() {
    const now = new Date();
    $$('[data-clock="time"]').forEach((el) => {
      el.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    $$('[data-clock="date"]').forEach((el) => {
      const text = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      el.textContent = text.charAt(0).toUpperCase() + text.slice(1);
    });
  }

  let wakeLock = null;
  async function keepAwake() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { /* sem permissão: a TV segue as regras de energia dela */ }
  }

  function setupWall() {
    if (!document.body.classList.contains('wall-body')) return;
    let idle = null;
    const wake = () => {
      document.body.classList.remove('wall-idle');
      clearTimeout(idle);
      idle = setTimeout(() => document.body.classList.add('wall-idle'), 5000);
    };
    ['mousemove', 'pointerdown', 'keydown', 'touchstart'].forEach((name) => document.addEventListener(name, wake, { passive: true }));
    wake();
    keepAwake();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
    document.addEventListener('keydown', (event) => {
      if ((event.key === 'f' || event.key === 'F') && !event.ctrlKey && !event.metaKey && !event.altKey) actions.fullscreen();
    });
  }

  // ------------------------------------------------------------------- início

  function enhancePage() {
    // link "pular para o conteúdo" para quem navega pelo teclado
    const main = $('main.page');
    if (main && !$('.skip-link')) {
      main.id = main.id || 'conteudo';
      main.tabIndex = -1;
      const skip = document.createElement('a');
      skip.className = 'skip-link';
      skip.href = '#' + main.id;
      skip.textContent = 'Ir para o conteúdo';
      document.body.prepend(skip);
    }
    $$('[data-conn]').forEach((el) => { el.setAttribute('role', 'status'); });
    $$('[data-action="toggle-row"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    restorePanZoom();
    syncFilterControls();
    updateTitle();
  }

  // Quem deixa a aba em segundo plano não gasta rede; ao voltar, tudo atualiza na hora.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && staleWhileHidden) { staleWhileHidden = false; refreshFragments(); }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    enhancePage();
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
    if ($('[data-clock]')) { tickClock(); setInterval(tickClock, 1000); }
    setupWall();
    if ($$('[data-fragment]').length) setInterval(refreshFragments, 30000);
  });
})();
