// ── CONSTANTES ────────────────────────────────────────────────────────────────

var STORAGE_PROCS   = 'suporte_procs_v3';
var STORAGE_CATS    = 'suporte_cats_v3';
var STORAGE_HISTORY = 'suporte_history_v3';

var DEFAULT_CATS = [
  { id: 'nfc',         label: 'NFC',         icon: 'ti-device-mobile', fixed: true },
  { id: 'xml',         label: 'XML',         icon: 'ti-file-code',     fixed: true },
  { id: 'impressao',   label: 'Impressão',   icon: 'ti-printer',       fixed: true },
  { id: 'atualizacao', label: 'Atualização', icon: 'ti-refresh',       fixed: true },
  { id: 'instalacao',  label: 'Instalação',  icon: 'ti-package',       fixed: true },
  { id: 'geral',       label: 'Geral',       icon: 'ti-tool',          fixed: true }
];

var CUSTOM_ICONS = [
  'ti-settings', 'ti-database', 'ti-wifi', 'ti-server', 'ti-shield',
  'ti-coin', 'ti-chart-bar', 'ti-users', 'ti-key', 'ti-bug'
];

var CAT_COLORS = {
  nfc:         { bg: '#E1F5EE', color: '#085041' },
  xml:         { bg: '#E6F1FB', color: '#0C447C' },
  impressao:   { bg: '#FAEEDA', color: '#633806' },
  atualizacao: { bg: '#EEEDFE', color: '#3C3489' },
  instalacao:  { bg: '#EAF3DE', color: '#27500A' },
  geral:       { bg: '#FAECE7', color: '#712B13' }
};

var STATUS_LABELS = {
  pendente:  'A fazer',
  andamento: 'Em andamento',
  resolvido: 'Resolvido'
};

var STATUS_ICONS = {
  pendente:  'ti-circle-dashed',
  andamento: 'ti-progress',
  resolvido: 'ti-circle-check'
};

var MAX_HISTORY = 30;

// ── ESTADO ────────────────────────────────────────────────────────────────────

var procs      = [];
var cats       = [];
var accessHistory    = [];
var currentView = 'dashboard'; // dashboard | favorites | history | category | all
var selCat     = null;
var editId     = null;
var stepCount  = 0;
var pendingStepImages = {}; // stepRowId -> array of base64 images (while editing)

// ── STORAGE SEGURO ────────────────────────────────────────────────────────────

function storageGet(key) {
  try { return localStorage.getItem(key); } catch(e) { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch(e) { return false; }
}

// ── PERSISTÊNCIA ──────────────────────────────────────────────────────────────

function loadData() {
  var p = storageGet(STORAGE_PROCS);
  var c = storageGet(STORAGE_CATS);
  var h = storageGet(STORAGE_HISTORY);

  if (c) {
    try { cats = JSON.parse(c); } catch(e) { cats = DEFAULT_CATS.slice(); }
  } else {
    cats = DEFAULT_CATS.slice();
  }

  if (p) {
    try { procs = JSON.parse(p); } catch(e) { procs = getDefaultProcs(); }
  } else {
    procs = getDefaultProcs();
    saveProcs();
  }

  if (h) {
    try { accessHistory = JSON.parse(h); } catch(e) { accessHistory = []; }
  } else {
    accessHistory = [];
  }

  // Garantir campos novos em procedimentos antigos
  for (var i = 0; i < procs.length; i++) {
    if (procs[i].status === undefined) procs[i].status = 'pendente';
    if (procs[i].favorite === undefined) procs[i].favorite = false;
    if (procs[i].client === undefined) procs[i].client = { name: '', phone: '' };
    if (!procs[i].steps) procs[i].steps = [];
    for (var j = 0; j < procs[i].steps.length; j++) {
      if (typeof procs[i].steps[j] === 'string') {
        procs[i].steps[j] = { text: procs[i].steps[j], images: [] };
      }
      if (!procs[i].steps[j].images) procs[i].steps[j].images = [];
    }
  }
}

function saveProcs() {
  storageSet(STORAGE_PROCS, JSON.stringify(procs));
}

function saveCats() {
  storageSet(STORAGE_CATS, JSON.stringify(cats));
}

function saveHistory() {
  storageSet(STORAGE_HISTORY, JSON.stringify(accessHistory));
}

function getDefaultProcs() {
  return [
    {
      id: 1,
      title: 'Configurar impressora fiscal',
      cat: 'impressao',
      status: 'resolvido',
      favorite: true,
      steps: [
        { text: 'Verificar se a impressora está conectada à rede ou USB', images: [] },
        { text: 'Acessar Configurações > Periféricos > Impressoras', images: [] },
        { text: 'Clicar em Adicionar impressora e selecionar o modelo', images: [] },
        { text: 'Instalar o driver caso solicitado', images: [] },
        { text: 'Realizar impressão de teste pelo sistema', images: [] }
      ],
      obs: 'Para impressoras Bematech, usar driver versão 3.x ou superior.',
      client: { name: '', phone: '' }
    },
    {
      id: 2,
      title: 'Emitir NFC-e manualmente',
      cat: 'nfc',
      status: 'pendente',
      favorite: false,
      steps: [
        { text: 'Acessar o menu Fiscal > NFC-e', images: [] },
        { text: 'Selecionar a venda pelo número do cupom', images: [] },
        { text: 'Revisar os dados do cliente e itens', images: [] },
        { text: 'Clicar em Transmitir e aguardar o retorno da SEFAZ', images: [] },
        { text: 'Imprimir o DANFE ou enviar por e-mail ao cliente', images: [] }
      ],
      obs: 'Certificado digital deve estar válido. Verificar prazo de validade mensalmente.',
      client: { name: '', phone: '' }
    },
    {
      id: 3,
      title: 'Importar XML de nota de entrada',
      cat: 'xml',
      status: 'andamento',
      favorite: false,
      steps: [
        { text: 'Baixar o XML da NF-e no portal do fornecedor ou e-mail', images: [] },
        { text: 'Acessar Estoque > Entrada de Mercadoria > Importar XML', images: [] },
        { text: 'Selecionar o arquivo .xml baixado', images: [] },
        { text: 'Conferir os itens, quantidades e preços com a NF física', images: [] },
        { text: 'Confirmar a entrada e arquivar o XML', images: [] }
      ],
      obs: '',
      client: { name: '', phone: '' }
    }
  ];
}

// ── HISTÓRICO ─────────────────────────────────────────────────────────────────

function logHistory(procId) {
  var p = findProc(procId);
  if (!p) return;

  // remove entrada anterior do mesmo procedimento
  history = accessHistory.filter(function(h) { return h.procId !== procId; });

  accessHistory.unshift({
    procId: procId,
    title: p.title,
    cat: p.cat,
    timestamp: Date.now()
  });

  if (accessHistory.length > MAX_HISTORY) history = accessHistory.slice(0, MAX_HISTORY);
  saveHistory();
}

function clearHistory() {
  if (!confirm('Limpar todo o histórico de acessos?')) return;
  accessHistory = [];
  saveHistory();
  render();
}

function formatRelativeTime(ts) {
  var diff = Date.now() - ts;
  var min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return 'há ' + min + ' min';
  var hr = Math.floor(min / 60);
  if (hr < 24) return 'há ' + hr + 'h';
  var day = Math.floor(hr / 24);
  if (day === 1) return 'ontem';
  return 'há ' + day + ' dias';
}

// ── HELPERS DE DADOS ─────────────────────────────────────────────────────────

function findProc(id) {
  for (var i = 0; i < procs.length; i++) {
    if (procs[i].id === id) return procs[i];
  }
  return null;
}

function getCatMeta(id) {
  for (var i = 0; i < cats.length; i++) {
    if (cats[i].id === id) return cats[i];
  }
  return { label: id, icon: 'ti-tool' };
}

function getBadgeStyle(catId) {
  var s = CAT_COLORS[catId] || { bg: '#F1EFE8', color: '#5F5E5A' };
  return 'background:' + s.bg + ';color:' + s.color;
}

function getFavorites() {
  return procs.filter(function(p) { return p.favorite; });
}

// ── NAVEGAÇÃO / VIEWS ────────────────────────────────────────────────────────

function setView(view, catId) {
  currentView = view;
  selCat = catId || null;
  var s = document.getElementById('search');
  if (s) s.value = '';
  var sf = document.getElementById('status-filter');
  if (sf) sf.value = '';
  render();
  closeSidebar();
}

function onSearchInput() {
  var q = document.getElementById('search').value.trim();
  if (q && currentView === 'dashboard') {
    currentView = 'all';
    selCat = null;
  }
  render();
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────

function renderSidebar() {
  // itens de visão geral
  setActiveClass('view-dashboard', currentView === 'dashboard');
  setActiveClass('view-favorites', currentView === 'favorites');
  setActiveClass('view-history', currentView === 'history');
  setActiveClass('view-notes', currentView === 'notes');

  var favCount = document.getElementById('fav-count');
  if (favCount) favCount.textContent = getFavorites().length;

  // categorias
  var list = document.getElementById('cat-list');
  if (list) {
    var html = '';
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      var count = procs.filter(function(p) { return p.cat === c.id; }).length;
      var active = (currentView === 'category' && selCat === c.id);
      html += '<div class="cat-item' + (active ? ' active' : '') + '" onclick="setView(\'category\',\'' + c.id + '\')">'
        + '<i class="ti ' + c.icon + ' cat-icon"></i>'
        + '<span>' + esc(c.label) + '</span>'
        + '<span class="cat-count">' + count + '</span>'
        + '</div>';
    }
    list.innerHTML = html;
  }

  var stat = document.getElementById('total-stat');
  if (stat) stat.textContent = procs.length + ' procedimento' + (procs.length !== 1 ? 's' : '') + ' no total';
}

function setActiveClass(id, isActive) {
  var el = document.getElementById(id);
  if (!el) return;
  if (isActive) el.classList.add('active');
  else el.classList.remove('active');
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────────────────────

function render() {
  renderSidebar();

  var dashboardEl = document.getElementById('dashboard-view');
  var historyEl   = document.getElementById('history-view');
  var gridEl      = document.getElementById('cards-grid');
  var notesEl     = document.getElementById('notes-view');

  var q = document.getElementById('search') ? document.getElementById('search').value.trim().toLowerCase() : '';
  var statusFilter = document.getElementById('status-filter') ? document.getElementById('status-filter').value : '';

  // título do topo
  var title = 'Painel';
  if (currentView === 'favorites') title = 'Favoritos';
  else if (currentView === 'history') title = 'Histórico';
  else if (currentView === 'notes') title = 'Anotações';
  else if (currentView === 'category') title = getCatMeta(selCat).label;
  else if (currentView === 'all') title = 'Todos os procedimentos';

  var titleEl = document.getElementById('content-title');
  var topbarEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = title;
  if (topbarEl) topbarEl.textContent = title;

  // mostrar/esconder seções
  if (currentView === 'notes') {
    dashboardEl.style.display = 'none';
    historyEl.style.display = 'none';
    gridEl.style.display = 'none';
    if (notesEl) notesEl.style.display = '';
    renderNotesView();
    var countElN = document.getElementById('content-count');
    if (countElN) countElN.textContent = notes.length + ' anotaç' + (notes.length !== 1 ? 'ões' : 'ão');
    return;
  }

  if (notesEl) notesEl.style.display = 'none';

  if (currentView === 'dashboard' && !q) {
    dashboardEl.style.display = '';
    historyEl.style.display = 'none';
    gridEl.style.display = 'none';
    renderDashboard();
    var countEl = document.getElementById('content-count');
    if (countEl) countEl.textContent = '';
    return;
  }

  if (currentView === 'history' && !q) {
    dashboardEl.style.display = 'none';
    historyEl.style.display = '';
    gridEl.style.display = 'none';
    renderHistory();
    var countEl2 = document.getElementById('content-count');
    if (countEl2) countEl2.textContent = accessHistory.length + ' acesso' + (accessHistory.length !== 1 ? 's' : '');
    return;
  }

  // lista de cards (all / favorites / category / busca)
  dashboardEl.style.display = 'none';
  historyEl.style.display = 'none';
  gridEl.style.display = '';

  var filtered = procs.filter(function(p) {
    var matchView = true;
    if (currentView === 'favorites') matchView = p.favorite;
    else if (currentView === 'category') matchView = p.cat === selCat;
    // 'all' e dashboard-com-busca: sem filtro de view

    var matchStatus = !statusFilter || p.status === statusFilter;

    var matchQ = !q
      || p.title.toLowerCase().indexOf(q) !== -1
      || p.steps.some(function(s) { return s.text.toLowerCase().indexOf(q) !== -1; })
      || (p.obs && p.obs.toLowerCase().indexOf(q) !== -1)
      || (p.client && p.client.name && p.client.name.toLowerCase().indexOf(q) !== -1);

    return matchView && matchStatus && matchQ;
  });

  var countEl3 = document.getElementById('content-count');
  if (countEl3) countEl3.textContent = filtered.length + ' procedimento' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    gridEl.innerHTML = '<div class="empty-state">'
      + '<i class="ti ti-search"></i>'
      + '<p>Nenhum procedimento encontrado.<br>'
      + (!q && currentView !== 'favorites' ? '<button class="see-link" onclick="openModal()">Criar novo →</button>' : 'Tente outra busca ou filtro.')
      + '</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    html += renderCardHtml(filtered[i]);
  }
  gridEl.innerHTML = html;
}

function renderCardHtml(p) {
  var meta = getCatMeta(p.cat);
  var statusLabel = STATUS_LABELS[p.status] || STATUS_LABELS.pendente;
  var statusIcon = STATUS_ICONS[p.status] || STATUS_ICONS.pendente;
  var statusClass = 'badge-status-' + (p.status || 'pendente');

  return '<div class="proc-card" id="card-' + p.id + '">'
    + '<div class="proc-card-top">'
    + '<div class="proc-title-wrap">'
    + '<div>'
    + '<div class="proc-title">' + esc(p.title) + '</div>'
    + '<div class="proc-badges">'
    + '<span class="badge" style="' + getBadgeStyle(p.cat) + '">'
    + '<i class="ti ' + meta.icon + '" style="font-size:12px"></i> ' + esc(meta.label)
    + '</span>'
    + '<span class="badge ' + statusClass + '">'
    + '<i class="ti ' + statusIcon + '" style="font-size:12px"></i> ' + statusLabel
    + '</span>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '<div class="proc-actions">'
    + '<button class="icon-btn fav' + (p.favorite ? ' active' : '') + '" onclick="toggleFavorite(' + p.id + ', event)" title="Favoritar">'
    + '<i class="ti ' + (p.favorite ? 'ti-star-filled' : 'ti-star') + '"></i></button>'
    + '<button class="icon-btn" onclick="openEdit(' + p.id + ')" title="Editar"><i class="ti ti-edit"></i></button>'
    + '<button class="icon-btn del" onclick="deleteProc(' + p.id + ')" title="Excluir"><i class="ti ti-trash"></i></button>'
    + '</div>'
    + '</div>'
    + '<div class="proc-steps-preview">'
    + p.steps.length + ' passo' + (p.steps.length !== 1 ? 's' : '') + ' · '
    + '<button class="see-link" onclick="openView(' + p.id + ')">ver procedimento →</button>'
    + '</div>'
    + '</div>';
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────

function renderDashboard() {
  var total = procs.length;
  var resolvido = procs.filter(function(p) { return p.status === 'resolvido'; }).length;
  var andamento = procs.filter(function(p) { return p.status === 'andamento'; }).length;
  var pendente  = procs.filter(function(p) { return p.status === 'pendente'; }).length;

  setText('m-total', total);
  setText('m-resolvido', resolvido);
  setText('m-andamento', andamento);
  setText('m-pendente', pendente);

  // recentes
  var recentEl = document.getElementById('recent-list');
  if (recentEl) {
    if (!accessHistory.length) {
      recentEl.innerHTML = '<div class="mini-empty">Nenhum acesso registrado ainda.</div>';
    } else {
      var html = '';
      var shown = accessHistory.slice(0, 5);
      for (var i = 0; i < shown.length; i++) {
        var h = shown[i];
        var exists = findProc(h.procId);
        if (!exists) continue;
        html += '<div class="mini-item" onclick="openView(' + h.procId + ')">'
          + '<i class="ti ti-file-text" style="color:var(--accent)"></i>'
          + '<span class="mini-item-title">' + esc(h.title) + '</span>'
          + '<span class="mini-item-meta">' + formatRelativeTime(h.timestamp) + '</span>'
          + '</div>';
      }
      recentEl.innerHTML = html || '<div class="mini-empty">Nenhum acesso registrado ainda.</div>';
    }
  }

  // favoritos
  var favEl = document.getElementById('fav-list');
  if (favEl) {
    var favs = getFavorites();
    if (!favs.length) {
      favEl.innerHTML = '<div class="mini-empty">Nenhum favorito ainda. Clique na estrela de um procedimento.</div>';
    } else {
      var fhtml = '';
      for (var j = 0; j < favs.length; j++) {
        var f = favs[j];
        var fmeta = getCatMeta(f.cat);
        fhtml += '<div class="mini-item" onclick="openView(' + f.id + ')">'
          + '<i class="ti ti-star-filled" style="color:var(--star)"></i>'
          + '<span class="mini-item-title">' + esc(f.title) + '</span>'
          + '<span class="mini-item-meta">' + esc(fmeta.label) + '</span>'
          + '</div>';
      }
      favEl.innerHTML = fhtml;
    }
  }

  // visão por categoria
  var catGrid = document.getElementById('cat-overview-grid');
  if (catGrid) {
    var chtml = '';
    for (var k = 0; k < cats.length; k++) {
      var c = cats[k];
      var count = procs.filter(function(p) { return p.cat === c.id; }).length;
      chtml += '<div class="proc-card" style="cursor:pointer" onclick="setView(\'category\',\'' + c.id + '\')">'
        + '<div class="proc-card-top">'
        + '<div class="proc-title-wrap"><div>'
        + '<div class="proc-title"><i class="ti ' + c.icon + '" style="color:var(--accent);margin-right:6px"></i>' + esc(c.label) + '</div>'
        + '</div></div>'
        + '</div>'
        + '<div class="proc-steps-preview">' + count + ' procedimento' + (count !== 1 ? 's' : '') + '</div>'
        + '</div>';
    }
    catGrid.innerHTML = chtml;
  }

  updateAlertBadge();
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── HISTÓRICO (VIEW) ─────────────────────────────────────────────────────────

function renderHistory() {
  var el = document.getElementById('history-list');
  if (!el) return;

  if (!accessHistory.length) {
    el.innerHTML = '<div class="empty-state"><i class="ti ti-history"></i><p>Nenhum acesso registrado ainda.<br>Abra um procedimento para começar o histórico.</p></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < accessHistory.length; i++) {
    var h = accessHistory[i];
    var exists = findProc(h.procId);
    var meta = getCatMeta(h.cat);
    html += '<div class="mini-item"' + (exists ? ' onclick="openView(' + h.procId + ')"' : ' style="opacity:0.5;cursor:default"') + '>'
      + '<i class="ti ' + meta.icon + '" style="color:var(--accent)"></i>'
      + '<span class="mini-item-title">' + esc(h.title) + (!exists ? ' (removido)' : '') + '</span>'
      + '<span class="mini-item-meta">' + formatRelativeTime(h.timestamp) + '</span>'
      + '</div>';
  }
  el.innerHTML = html;
}

// ── FAVORITOS / STATUS ───────────────────────────────────────────────────────

function toggleFavorite(id, e) {
  if (e) e.stopPropagation();
  var p = findProc(id);
  if (!p) return;
  p.favorite = !p.favorite;
  saveProcs();
  render();
}

// ── MODAL VISUALIZAÇÃO ───────────────────────────────────────────────────────

function openView(id) {
  var p = findProc(id);
  if (!p) return;

  logHistory(id);

  var meta = getCatMeta(p.cat);
  var statusLabel = STATUS_LABELS[p.status] || STATUS_LABELS.pendente;
  var statusIcon = STATUS_ICONS[p.status] || STATUS_ICONS.pendente;
  var statusClass = 'badge-status-' + (p.status || 'pendente');

  var stepsHtml = '';
  for (var i = 0; i < p.steps.length; i++) {
    var s = p.steps[i];
    var imgsHtml = '';
    if (s.images && s.images.length) {
      for (var j = 0; j < s.images.length; j++) {
        imgsHtml += '<img src="' + s.images[j] + '" onclick="openLightbox(\'' + s.images[j].replace(/'/g,"\\'") + '\')" alt="Imagem do passo ' + (i+1) + '" />';
      }
    }
    stepsHtml += '<div class="view-step">'
      + '<div class="step-num">' + (i + 1) + '</div>'
      + '<div class="view-step-body">'
      + '<div class="step-text">' + esc(s.text) + '</div>'
      + (imgsHtml ? '<div class="step-images">' + imgsHtml + '</div>' : '')
      + '</div>'
      + '</div>';
  }

  var obsHtml = p.obs ? '<div class="obs-box"><strong>Obs:</strong> ' + esc(p.obs) + '</div>' : '';

  var contactHtml = '';
  if (p.client && (p.client.name || p.client.phone)) {
    contactHtml = '<div class="contact-box">'
      + (p.client.name ? '<span><i class="ti ti-user"></i>' + esc(p.client.name) + '</span>' : '')
      + (p.client.phone ? '<span><i class="ti ti-phone"></i>' + esc(p.client.phone) + '</span>' : '')
      + '</div>';
  }

  var html = '<div id="print-area">'
    + '<div class="view-header">'
    + '<div>'
    + '<div class="view-title">' + esc(p.title) + '</div>'
    + '<div class="view-badges">'
    + '<span class="badge" style="' + getBadgeStyle(p.cat) + '">'
    + '<i class="ti ' + meta.icon + '" style="font-size:12px"></i> ' + esc(meta.label)
    + '</span>'
    + '<span class="badge ' + statusClass + '">'
    + '<i class="ti ' + statusIcon + '" style="font-size:12px"></i> ' + statusLabel
    + '</span>'
    + '</div>'
    + '</div>'
    + '<div class="view-actions">'
    + '<button class="icon-btn fav' + (p.favorite ? ' active' : '') + '" onclick="toggleFavorite(' + p.id + ');reopenView(' + p.id + ')" title="Favoritar">'
    + '<i class="ti ' + (p.favorite ? 'ti-star-filled' : 'ti-star') + '"></i></button>'
    + '<button class="icon-btn" onclick="printProc()" title="Imprimir / exportar PDF"><i class="ti ti-printer"></i></button>'
    + '<button class="icon-btn" onclick="closeModal(\'view-modal\');openEdit(' + p.id + ')" title="Editar"><i class="ti ti-edit"></i></button>'
    + '<button class="icon-btn" onclick="closeModal(\'view-modal\')" title="Fechar"><i class="ti ti-x"></i></button>'
    + '</div>'
    + '</div>'
    + '<div class="view-steps">' + stepsHtml + '</div>'
    + obsHtml
    + contactHtml
    + '</div>';

  document.getElementById('view-modal-content').innerHTML = html;
  document.getElementById('view-modal').style.display = 'flex';
}

function reopenView(id) {
  openView(id);
}

function printProc() {
  window.print();
}

function openLightbox(src) {
  var lb = document.createElement('div');
  lb.className = 'image-lightbox';
  lb.onclick = function() { lb.remove(); };
  var img = document.createElement('img');
  img.src = src;
  lb.appendChild(img);
  document.body.appendChild(lb);
}

// ── MODAL PROCEDIMENTO (CRIAR/EDITAR) ────────────────────────────────────────

function populateCatSelect() {
  var sel = document.getElementById('f-cat');
  if (!sel) return;
  var html = '';
  for (var i = 0; i < cats.length; i++) {
    html += '<option value="' + cats[i].id + '">' + esc(cats[i].label) + '</option>';
  }
  sel.innerHTML = html;
}

function openModal() {
  editId = null;
  stepCount = 0;
  pendingStepImages = {};

  setVal('f-title', '');
  setVal('f-obs', '');
  setVal('f-client-name', '');
  setVal('f-client-phone', '');
  var se = document.getElementById('steps-editor');
  if (se) se.innerHTML = '';

  var mt = document.getElementById('modal-title');
  if (mt) mt.textContent = 'Novo procedimento';

  populateCatSelect();
  setVal('f-status', 'pendente');
  addStep();

  var modal = document.getElementById('proc-modal');
  if (modal) modal.style.display = 'flex';
}

function openEdit(id) {
  var p = findProc(id);
  if (!p) return;

  editId = id;
  stepCount = 0;
  pendingStepImages = {};

  var mt = document.getElementById('modal-title');
  if (mt) mt.textContent = 'Editar procedimento';

  setVal('f-title', p.title);
  setVal('f-obs', p.obs || '');
  setVal('f-client-name', (p.client && p.client.name) || '');
  setVal('f-client-phone', (p.client && p.client.phone) || '');

  var se = document.getElementById('steps-editor');
  if (se) se.innerHTML = '';

  populateCatSelect();
  setVal('f-cat', p.cat);
  setVal('f-status', p.status || 'pendente');

  for (var j = 0; j < p.steps.length; j++) {
    addStep(p.steps[j].text, p.steps[j].images);
  }

  var modal = document.getElementById('proc-modal');
  if (modal) modal.style.display = 'flex';
}

function setVal(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val;
}

function addStep(text, images) {
  text = text || '';
  images = images || [];
  stepCount++;
  var rowId = 'step-' + stepCount;
  pendingStepImages[rowId] = images.slice();

  var num = document.querySelectorAll('.step-edit-row').length + 1;
  var div = document.createElement('div');
  div.className = 'step-edit-row';
  div.id = rowId;

  div.innerHTML = '<div class="step-edit-top">'
    + '<span>' + num + '.</span>'
    + '<input type="text" placeholder="Descreva o passo..." value="' + esc(text) + '" />'
    + '<button class="icon-btn del" onclick="removeStep(\'' + rowId + '\')" title="Remover passo"><i class="ti ti-x"></i></button>'
    + '</div>'
    + '<div class="step-img-row" id="' + rowId + '-imgs"></div>'
    + '<div>'
    + '<label class="img-upload-btn">'
    + '<i class="ti ti-photo-plus" style="font-size:14px"></i> Adicionar imagem'
    + '<input type="file" accept="image/*" multiple style="display:none" onchange="handleStepImage(event, \'' + rowId + '\')" />'
    + '</label>'
    + '</div>';

  document.getElementById('steps-editor').appendChild(div);
  renderStepImages(rowId);
}

function handleStepImage(event, rowId) {
  var files = event.target.files;
  if (!files || !files.length) return;

  var remaining = files.length;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var reader = new FileReader();
    reader.onload = (function(rId) {
      return function(e) {
        pendingStepImages[rId] = pendingStepImages[rId] || [];
        pendingStepImages[rId].push(e.target.result);
        renderStepImages(rId);
      };
    })(rowId);
    reader.readAsDataURL(file);
  }
  event.target.value = '';
}

function renderStepImages(rowId) {
  var container = document.getElementById(rowId + '-imgs');
  if (!container) return;
  var imgs = pendingStepImages[rowId] || [];
  var html = '';
  for (var i = 0; i < imgs.length; i++) {
    html += '<div class="step-img-thumb">'
      + '<img src="' + imgs[i] + '" alt="prévia" />'
      + '<button class="rm-img" onclick="removeStepImage(\'' + rowId + '\',' + i + ')" title="Remover imagem"><i class="ti ti-x"></i></button>'
      + '</div>';
  }
  container.innerHTML = html;
}

function removeStepImage(rowId, idx) {
  if (!pendingStepImages[rowId]) return;
  pendingStepImages[rowId].splice(idx, 1);
  renderStepImages(rowId);
}

function removeStep(rowId) {
  var el = document.getElementById(rowId);
  if (el) el.remove();
  delete pendingStepImages[rowId];
  renumberSteps();
}

function renumberSteps() {
  var rows = document.querySelectorAll('.step-edit-row');
  for (var i = 0; i < rows.length; i++) {
    rows[i].querySelector('.step-edit-top span').textContent = (i + 1) + '.';
  }
}

function saveProc() {
  var title = (document.getElementById('f-title').value || '').trim();
  if (!title) { showToast('Informe o título do procedimento.'); return; }

  var rows = document.querySelectorAll('.step-edit-row');
  var steps = [];
  for (var i = 0; i < rows.length; i++) {
    var input = rows[i].querySelector('.step-edit-top input');
    var text = input.value.trim();
    if (!text) continue;
    var rowId = rows[i].id;
    steps.push({
      text: text,
      images: (pendingStepImages[rowId] || []).slice()
    });
  }

  if (!steps.length) { showToast('Adicione pelo menos um passo.'); return; }

  var catEl = document.getElementById('f-cat');
  var statusEl = document.getElementById('f-status');
  var obsEl = document.getElementById('f-obs');
  var clientName = document.getElementById('f-client-name').value.trim();
  var clientPhone = document.getElementById('f-client-phone').value.trim();

  var proc = {
    id:       editId || Date.now(),
    title:    title,
    cat:      catEl ? catEl.value : 'geral',
    status:   statusEl ? statusEl.value : 'pendente',
    steps:    steps,
    obs:      obsEl ? obsEl.value.trim() : '',
    client:   { name: clientName, phone: clientPhone },
    favorite: false
  };

  if (editId) {
    var existing = findProc(editId);
    proc.favorite = existing ? existing.favorite : false;
    for (var k = 0; k < procs.length; k++) {
      if (procs[k].id === editId) { procs[k] = proc; break; }
    }
    showToast('Procedimento atualizado.');
  } else {
    procs.unshift(proc);
    showToast('Procedimento salvo.');
  }

  saveProcs();
  closeModal('proc-modal');
  render();
}

function deleteProc(id) {
  if (!confirm('Excluir este procedimento? Essa ação não pode ser desfeita.')) return;
  procs = procs.filter(function(p) { return p.id !== id; });
  history = accessHistory.filter(function(h) { return h.procId !== id; });
  saveProcs();
  saveHistory();
  render();
  showToast('Procedimento excluído.');
}

// ── MODAL CATEGORIAS ──────────────────────────────────────────────────────────

function openCatModal() {
  renderCatManage();
  var modal = document.getElementById('cat-modal');
  if (modal) modal.style.display = 'flex';
  var inp = document.getElementById('new-cat-input');
  if (inp) inp.focus();
}

function renderCatManage() {
  var list = document.getElementById('cat-manage-list');
  if (!list) return;
  var html = '';
  for (var i = 0; i < cats.length; i++) {
    var c = cats[i];
    html += '<div class="cat-manage-item' + (c.fixed ? ' fixed' : '') + '">'
      + '<i class="ti ' + c.icon + ' cat-icon"></i>'
      + '<span>' + esc(c.label) + '</span>'
      + '<button class="cat-del-btn" onclick="deleteCat(\'' + c.id + '\')" title="Remover"><i class="ti ti-x"></i></button>'
      + '</div>';
  }
  list.innerHTML = html;
}

function addCat() {
  var input = document.getElementById('new-cat-input');
  if (!input) return;
  var label = input.value.trim();
  if (!label) return;

  for (var i = 0; i < cats.length; i++) {
    if (cats[i].label.toLowerCase() === label.toLowerCase()) {
      showToast('Categoria já existe.');
      return;
    }
  }

  var id   = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
  var icon = CUSTOM_ICONS[cats.length % CUSTOM_ICONS.length];
  cats.push({ id: id, label: label, icon: icon, fixed: false });

  saveCats();
  input.value = '';
  renderCatManage();
  renderSidebar();
  showToast('Categoria "' + label + '" adicionada.');
}

function deleteCat(id) {
  if (cats.length <= 1) {
    showToast('É preciso manter ao menos uma categoria.');
    return;
  }

  var inUse = procs.some(function(p) { return p.cat === id; });
  var fallback = cats.filter(function(c) { return c.id !== id; })[0];

  if (inUse) {
    if (!confirm('Existem procedimentos nessa categoria. Mover para "' + fallback.label + '"?')) return;
    for (var j = 0; j < procs.length; j++) {
      if (procs[j].cat === id) procs[j].cat = fallback.id;
    }
    saveProcs();
  }

  cats = cats.filter(function(c) { return c.id !== id; });
  if (currentView === 'category' && selCat === id) {
    currentView = 'dashboard';
    selCat = null;
  }
  saveCats();
  renderCatManage();
  render();
}
          

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function checkOverlayClose(e, id) {
  if (e.target && e.target.classList.contains('modal-overlay')) closeModal(id);
}

function esc(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

var toastTimer;
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('show'); }, 2500);
}

function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.toggle('open');
  if (ov) ov.classList.toggle('visible');
}

function closeSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('visible');
}



var STORAGE_NOTES = 'suporte_notes_v1';
var notes = [];
var currentNoteId = null;
var autoSaveTimer = null;
var olCounters = {}; 

function loadNotes() {
  var raw = storageGet(STORAGE_NOTES);
  if (raw) {
    try { notes = JSON.parse(raw); } catch(e) { notes = []; }
  } else {
    notes = [];
  }
}

function saveNotes() {
  storageSet(STORAGE_NOTES, JSON.stringify(notes));
}

function findNote(id) {
  return notes.find(function(n) { return n.id === id; }) || null;
}

function createNote() {
  var note = {
    id: Date.now(),
    title: '',
    blocks: [],
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  notes.unshift(note);
  saveNotes();
  renderNotesView();
  openNote(note.id);
}

function deleteCurrentNote() {
  if (!currentNoteId) return;
  if (!confirm('Excluir esta anotação? Essa ação não pode ser desfeita.')) return;
  notes = notes.filter(function(n) { return n.id !== currentNoteId; });
  saveNotes();
  currentNoteId = null;
  renderNotesView();
}

function toggleNotePin() {
  if (!currentNoteId) return;
  var note = findNote(currentNoteId);
  if (!note) return;
  note.pinned = !note.pinned;
  saveNotes();
  renderNotesList();
  updatePinBtn(note.pinned);
}

function updatePinBtn(pinned) {
  var btn = document.getElementById('note-pin-btn');
  if (!btn) return;
  btn.style.color = pinned ? 'var(--accent)' : '';
  btn.title = pinned ? 'Desafixar' : 'Fixar';
}

function openNote(id) {
  currentNoteId = id;
  var note = findNote(id);
  if (!note) return;

  document.getElementById('notes-empty-state').style.display = 'none';
  document.getElementById('notes-editor').style.display = 'flex';

  document.getElementById('note-title-input').value = note.title;
  updatePinBtn(note.pinned);
  updateNoteMeta(note);
  renderBlocks(note.blocks);
  renderNotesList();
}

function updateNoteMeta(note) {
  var el = document.getElementById('note-meta');
  if (!el) return;
  var d = new Date(note.updatedAt);
  el.textContent = 'Atualizado ' + formatRelativeTime(note.updatedAt) + ' · ' + d.toLocaleDateString('pt-BR');
}

function renderNotesList() {
  var container = document.getElementById('notes-list-sidebar');
  if (!container) return;

  var sorted = notes.slice().sort(function(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  if (!sorted.length) {
    container.innerHTML = '<div class="notes-empty-sidebar">Nenhuma anotação ainda.<br>Clique em "+ Nova anotação".</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < sorted.length; i++) {
    var n = sorted[i];
    var preview = getNotePlainText(n).slice(0, 60) || 'Sem conteúdo...';
    var active = n.id === currentNoteId ? ' active' : '';
    html += '<div class="note-list-item' + active + '" onclick="openNote(' + n.id + ')">'
      + '<div class="note-list-title">'
      + (n.pinned ? '<i class="ti ti-pin pin-icon"></i>' : '')
      + esc(n.title || 'Sem título')
      + '</div>'
      + '<div class="note-list-preview">' + esc(preview) + '</div>'
      + '<div class="note-list-date">' + formatRelativeTime(n.updatedAt) + '</div>'
      + '</div>';
  }
  container.innerHTML = html;

  var countEl = document.getElementById('notes-count');
  if (countEl) countEl.textContent = notes.length;
}

function getNotePlainText(note) {
  return (note.blocks || []).map(function(b) { return b.text || ''; }).join(' ').trim();
}

function renderNotesView() {
  renderNotesList();
  if (!currentNoteId || !findNote(currentNoteId)) {
    document.getElementById('notes-empty-state').style.display = 'flex';
    document.getElementById('notes-editor').style.display = 'none';
  }
}

function renderBlocks(blocks) {
  var container = document.getElementById('note-blocks');
  if (!container) return;
  container.innerHTML = '';
  olCounters = {};
  for (var i = 0; i < blocks.length; i++) {
    appendBlockEl(blocks[i]);
  }
}

function appendBlockEl(block) {
  var container = document.getElementById('note-blocks');
  if (!container) return;

  if (block.type === 'hr') {
    var hr = document.createElement('div');
    hr.className = 'note-block block-hr';
    hr.dataset.blockId = block.id;
    hr.dataset.type = 'hr';
    var del = document.createElement('button');
    del.className = 'block-del';
    del.innerHTML = '<i class="ti ti-x"></i>';
    del.onclick = function() { removeBlock(block.id); };
    hr.appendChild(del);
    container.appendChild(hr);
    return;
  }

  var div = document.createElement('div');
  div.className = 'note-block block-' + block.type;
  div.dataset.blockId = block.id;
  div.dataset.type = block.type;

  if (block.type === 'ul') {
    var pre = document.createElement('span');
    pre.className = 'block-prefix';
    pre.textContent = '•';
    div.appendChild(pre);
  } else if (block.type === 'ol') {
    if (!olCounters[block.id]) olCounters[block.id] = getOlIndex(block.id);
    var pre2 = document.createElement('span');
    pre2.className = 'block-prefix';
    pre2.textContent = olCounters[block.id] + '.';
    div.appendChild(pre2);
  } else if (block.type === 'check') {
    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'block-check-input';
    chk.checked = !!block.checked;
    if (block.checked) div.classList.add('done');
    chk.onchange = (function(bid) {
      return function(e) {
        var note = findNote(currentNoteId);
        if (!note) return;
        var b = note.blocks.find(function(x) { return x.id === bid; });
        if (b) {
          b.checked = e.target.checked;
          div.classList.toggle('done', e.target.checked);
          autoSaveNote();
        }
      };
    })(block.id);
    div.appendChild(chk);
  }

  var textarea = document.createElement('textarea');
  textarea.className = 'block-input';
  textarea.placeholder = getBlockPlaceholder(block.type);
  textarea.value = block.text || '';
  textarea.rows = 1;
  textarea.dataset.blockId = block.id;
  autoResize(textarea);

  textarea.addEventListener('input', (function(bid) {
    return function(e) {
      autoResize(e.target);
      var note = findNote(currentNoteId);
      if (!note) return;
      var b = note.blocks.find(function(x) { return x.id === bid; });
      if (b) b.text = e.target.value;
      autoSaveNote();
    };
  })(block.id));

  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertBlockAfter(block.id, block.type === 'h1' || block.type === 'h2' || block.type === 'h3' ? 'p' : block.type);
    }
    if (e.key === 'Backspace' && textarea.value === '') {
      e.preventDefault();
      removeBlock(block.id);
    }
  });

  div.appendChild(textarea);

  var delBtn = document.createElement('button');
  delBtn.className = 'block-del';
  delBtn.innerHTML = '<i class="ti ti-x"></i>';
  delBtn.onclick = function() { removeBlock(block.id); };
  div.appendChild(delBtn);

  container.appendChild(div);
  return div;
}

function getOlIndex(blockId) {
  var note = findNote(currentNoteId);
  if (!note) return 1;
  var count = 0;
  for (var i = 0; i < note.blocks.length; i++) {
    if (note.blocks[i].type === 'ol') count++;
    if (note.blocks[i].id === blockId) return count;
  }
  return count || 1;
}

function getBlockPlaceholder(type) {
  var map = {
    h1: 'Título grande', h2: 'Título', h3: 'Subtítulo',
    p: 'Escreva algo...', ul: 'Item de lista', ol: 'Item numerado',
    check: 'Tarefa...', quote: 'Citação...', code: 'Código...',
    hr: ''
  };
  return map[type] || 'Escreva...';
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function insertBlock(type) {
  var note = findNote(currentNoteId);
  if (!note) { createNote(); return; }
  var block = { id: Date.now(), type: type, text: '', checked: false };
  note.blocks.push(block);
  saveNotes();
  var el = appendBlockEl(block);
  if (el) {
    var ta = el.querySelector('textarea');
    if (ta) { ta.focus(); autoResize(ta); }
  }
}

function insertBlockAfter(afterId, type) {
  var note = findNote(currentNoteId);
  if (!note) return;
  var idx = note.blocks.findIndex(function(b) { return b.id === afterId; });
  var block = { id: Date.now(), type: type, text: '', checked: false };
  if (idx >= 0) note.blocks.splice(idx + 1, 0, block);
  else note.blocks.push(block);
  saveNotes();
  renderBlocks(note.blocks);
  setTimeout(function() {
    var el = document.querySelector('[data-block-id="' + block.id + '"] textarea');
    if (el) { el.focus(); autoResize(el); }
  }, 0);
}

function removeBlock(blockId) {
  var note = findNote(currentNoteId);
  if (!note) return;
  note.blocks = note.blocks.filter(function(b) { return b.id !== blockId; });
  saveNotes();
  renderBlocks(note.blsocks);
  var tas = document.querySelectorAll('#note-blocks textarea');
  if (tas.length) tas[tas.length - 1].focus();
}

function autoSaveNote() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(function() {
    var note = findNote(currentNoteId);
    if (!note) return;
    note.title = document.getElementById('note-title-input').value;
    note.updatedAt = Date.now();
    saveNotes();
    updateNoteMeta(note);
    renderNotesList();
  }, 600);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var icon = document.getElementById('theme-icon');
  if (icon) {
    icon.className = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
  }
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  var next = current === 'dark' ? 'light' : 'dark';
  storageSet('suporte_theme', next);
  applyTheme(next);
}

function loadTheme() {
  var saved = storageGet('suporte_theme') || 'light';
  applyTheme(saved);
}


document.addEventListener('DOMContentLoaded', function() {
  loadTheme();
  loadUsers();
  loadSession();
  loadAlerts();
  loadData();

  if (!currentUser) {
    showLoginScreen();
  } else {
    hideLoginScreen();
    loadNotes();
    updateUserUI();
    render();
  }
  var alertDateInp = document.getElementById('alert-new-date');
  if (alertDateInp) alertDateInp.value = new Date().toISOString().slice(0,10);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeModal('proc-modal');
      closeModal('cat-modal');
      closeModal('view-modal');
      var lb = document.querySelector('.image-lightbox');
      if (lb) lb.remove();
    }
  });
});

var STORAGE_USERS    = 'suporte_users_v1';
var STORAGE_SESSION  = 'suporte_session_v1';
var STORAGE_ALERTS   = 'suporte_alerts_v1';

var currentUser = null;
var users = [];
var alerts = [];     

var USER_COLORS = ['#880000','#0C447C','#085041','#3C3489','#633806','#27500A','#712B13','#555550'];
var USER_AVATARS = ['ti-user-circle','ti-user','ti-user-star','ti-user-bolt','ti-user-heart','ti-user-shield'];

function getDefaultUsers() {
  return [
    { id: 'u_ingrid', name: 'Ingrid', color: '#880000', avatar: 'ti-user-circle', password: '123456' },
    { id: 'u_lucia', name: 'Lúcia', color: '#0C447C', avatar: 'ti-user-star', password: '123456' }
  ];
}

function loadUsers() {
  var raw = storageGet(STORAGE_USERS);
  if (raw) {
    try { users = JSON.parse(raw); } catch(e) { users = []; }
  } else {
    users = [];
  }

  if (!users.length) {
    users = getDefaultUsers();
    saveUsers();
    return;
  }

  for (var i = 0; i < users.length; i++) {
    if (!users[i].password) users[i].password = '123456';
  }
  saveUsers();
}

function saveUsers() { storageSet(STORAGE_USERS, JSON.stringify(users)); }

function loadSession() {
  var raw = storageGet(STORAGE_SESSION);
  if (raw) { try { currentUser = JSON.parse(raw); } catch(e) { currentUser = null; } }
  if (currentUser) {
    var found = users.find(function(u) { return u.id === currentUser.id; });
    if (!found) currentUser = null;
  }
}

function saveSession() {
  if (currentUser) storageSet(STORAGE_SESSION, JSON.stringify(currentUser));
  else storageSet(STORAGE_SESSION, '');
}


function loadAlerts() {
  var raw = storageGet(STORAGE_ALERTS);
  if (raw) { try { alerts = JSON.parse(raw); } catch(e) { alerts = []; } }
  else { alerts = []; }
}

function saveAlerts() { storageSet(STORAGE_ALERTS, JSON.stringify(alerts)); }

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-root').style.display = 'none';
  renderLoginUsers();
}

function hideLoginScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-root').style.display = '';
}

function showLoginPassword(userId) {
  var allInputs = document.querySelectorAll('.login-password-input');
  var allButtons = document.querySelectorAll('.login-enter-btn');
  for (var i = 0; i < allInputs.length; i++) {
    allInputs[i].style.display = 'none';
  }
  for (var j = 0; j < allButtons.length; j++) {
    allButtons[j].style.display = 'none';
  }

  var input = document.getElementById('login-pass-' + userId);
  var btn = document.getElementById('login-enter-' + userId);
  if (input) {
    input.style.display = 'block';
    input.value = '';
    input.focus();
  }
  if (btn) btn.style.display = 'inline-flex';
}

function renderLoginUsers() {
  var grid = document.getElementById('login-user-grid');
  if (!grid) return;
  if (!users.length) {
    grid.innerHTML = '<div class="login-empty">Nenhum perfil criado ainda.<br>Crie o primeiro abaixo.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    html += '<div class="login-avatar-card" onclick="showLoginPassword(\'' + u.id + '\')" style="--ua-color:' + u.color + '">'
      + '<div class="login-avatar-icon"><i class="ti ' + u.avatar + '"></i></div>'
      + '<span class="login-avatar-name">' + esc(u.name) + '</span>'
      + '<input type="password" class="login-password-input" id="login-pass-' + u.id + '" placeholder="Senha" onkeydown="if(event.key===\'Enter\') loginAs(\'' + u.id + '\', document.getElementById(\'login-pass-' + u.id + '\').value)" onClick="event.stopPropagation()" />'
      + '<button class="btn-new login-enter-btn" id="login-enter-' + u.id + '" onclick="event.stopPropagation(); loginAs(\'' + u.id + '\', document.getElementById(\'login-pass-' + u.id + '\').value)">Entrar</button>'
      + '<button class="login-del-user" onclick="event.stopPropagation(); deleteUser(event,\'' + u.id + '\')" title="Remover perfil"><i class="ti ti-x"></i></button>'
      + '</div>';
  }
  grid.innerHTML = html;
}

function loginAs(userId, password) {
  var u = users.find(function(x) { return x.id === userId; });
  if (!u) return;

  var enteredPassword = (password || '').toString();
  var expectedPassword = (u.password || '123456').toString();

  if (enteredPassword !== expectedPassword) {
    showToast('Senha incorreta para ' + u.name + '.');
    return;
  }

  currentUser = u;
  saveSession();
  hideLoginScreen();
  loadNotes();
  updateUserUI();
  render();
  showToast('Olá, ' + u.name + '!');
}

function logout() {
  currentUser = null;
  saveSession();
  notes = [];
  currentNoteId = null;
  showLoginScreen();
}

function openCreateUserModal() {
  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-password').value = '';
  document.getElementById('new-user-password-confirm').value = '';
  document.getElementById('user-color-pick').value = USER_COLORS[users.length % USER_COLORS.length];
  var avatarBtns = document.querySelectorAll('.avatar-pick-btn');
  if (avatarBtns.length) {
    avatarBtns.forEach(function(btn) { btn.classList.remove('selected'); });
    avatarBtns[0].classList.add('selected');
  }
  document.getElementById('create-user-modal').style.display = 'flex';
  setTimeout(function() { document.getElementById('new-user-name').focus(); }, 50);
}

function closeCreateUserModal() {
  document.getElementById('create-user-modal').style.display = 'none';
}

function selectAvatar(el, icon) {
  document.querySelectorAll('.avatar-pick-btn').forEach(function(b) { b.classList.remove('selected'); });
  el.classList.add('selected');
}

function createUser() {
  var nameEl = document.getElementById('new-user-name');
  var name = (nameEl ? nameEl.value : '').trim();
  if (!name) { showToast('Digite um nome para o perfil.'); return; }

  var passwordEl = document.getElementById('new-user-password');
  var confirmEl = document.getElementById('new-user-password-confirm');
  var password = passwordEl ? passwordEl.value : '';
  var confirmPassword = confirmEl ? confirmEl.value : '';

  if (password !== confirmPassword) {
    showToast('As senhas não conferem.');
    return;
  }

  var colorEl = document.getElementById('user-color-pick');
  var color = colorEl ? colorEl.value : USER_COLORS[0];

  var selBtn = document.querySelector('.avatar-pick-btn.selected');
  var avatar = selBtn ? selBtn.dataset.icon : USER_AVATARS[0];

  var u = { id: 'u_' + Date.now(), name: name, color: color, avatar: avatar, password: password || '123456' };
  users.push(u);
  saveUsers();
  closeCreateUserModal();
  renderLoginUsers();
  showToast('Perfil "' + name + '" criado!');
}

function deleteUser(e, userId) {
  e.stopPropagation();
  if (!confirm('Remover este perfil? As anotações serão apagadas.')) return;
  users = users.filter(function(u) { return u.id !== userId; });
  var key = 'suporte_notes_v1_' + userId;
  try { localStorage.removeItem(key); } catch(ex) {}
  saveUsers();
  renderLoginUsers();
}

function openPasswordModal() {
  if (!currentUser) return;
  document.getElementById('new-password').value = '';
  document.getElementById('new-password-confirm').value = '';
  document.getElementById('change-password-modal').style.display = 'flex';
  setTimeout(function() { document.getElementById('new-password').focus(); }, 50);
}

function closePasswordModal() {
  document.getElementById('change-password-modal').style.display = 'none';
}

function changePassword() {
  if (!currentUser) return;
  var newPasswordEl = document.getElementById('new-password');
  var confirmEl = document.getElementById('new-password-confirm');
  var password = newPasswordEl ? newPasswordEl.value : '';
  var confirmPassword = confirmEl ? confirmEl.value : '';

  if (!password || !confirmPassword) {
    showToast('Digite e confirme a nova senha.');
    return;
  }

  if (password !== confirmPassword) {
    showToast('As senhas não conferem.');
    return;
  }

  var user = users.find(function(u) { return u.id === currentUser.id; });
  if (!user) return;

  user.password = password;
  currentUser.password = password;
  saveUsers();
  saveSession();
  closePasswordModal();
  showToast('Senha alterada com sucesso.');
}

function updateUserUI() {
  var avatar = document.getElementById('sidebar-user-avatar');
  var name   = document.getElementById('sidebar-user-name');
  var panelCard = document.getElementById('profile-panel-card');
  var panelAvatar = document.getElementById('profile-panel-avatar');
  var panelName = document.getElementById('profile-panel-name');
  if (!currentUser) {
    if (avatar) avatar.innerHTML = '<i class="ti ti-user"></i>';
    if (name)   name.textContent = 'Sem perfil';
    if (panelCard) panelCard.style.display = 'none';
    return;
  }
  if (avatar) {
    avatar.innerHTML = '<i class="ti ' + currentUser.avatar + '"></i>';
    avatar.style.color = currentUser.color;
  }
  if (name) name.textContent = currentUser.name;
  if (panelCard) panelCard.style.display = 'flex';
  if (panelAvatar) {
    panelAvatar.innerHTML = '<i class="ti ' + currentUser.avatar + '"></i>';
    panelAvatar.style.color = currentUser.color;
  }
  if (panelName) panelName.textContent = currentUser.name;
}



function getNotesStorageKey() {
  if (currentUser) return 'suporte_notes_v1_' + currentUser.id;
  return STORAGE_NOTES; 
}
var _origLoadNotes = loadNotes;
loadNotes = function() {
  var raw = storageGet(getNotesStorageKey());
  if (raw) { try { notes = JSON.parse(raw); } catch(e) { notes = []; } }
  else { notes = []; }
};

var _origSaveNotes = saveNotes;
saveNotes = function() {
  storageSet(getNotesStorageKey(), JSON.stringify(notes));
};

function openAlertsModal() {
  renderAlerts();
  document.getElementById('alerts-modal').style.display = 'flex';
}

function closeAlertsModal() {
  document.getElementById('alerts-modal').style.display = 'none';
}

function renderAlerts() {
  var list = document.getElementById('alerts-list');
  if (!list) return;

  var open   = alerts.filter(function(a) { return !a.done; });
  var closed = alerts.filter(function(a) { return  a.done; });
  var sorted = open.concat(closed);

  if (!sorted.length) {
    list.innerHTML = '<div class="alerts-empty"><i class="ti ti-bell-off" style="font-size:32px;color:var(--text-3)"></i><p>Nenhum aviso registrado.</p></div>';
    updateAlertBadge();
    return;
  }

  var html = '';
  for (var i = 0; i < sorted.length; i++) {
    var a = sorted[i];
    var isOld = isOlderThanToday(a.date);
    var ageClass = isOld ? ' alert-old' : '';
    var doneClass = a.done ? ' alert-done' : '';
    html += '<div class="alert-item' + ageClass + doneClass + '">'
      + '<div class="alert-item-left">'
      + '<button class="alert-check-btn" onclick="toggleAlert(\'' + a.id + '\')" title="' + (a.done ? 'Reabrir' : 'Marcar como resolvido') + '">'
      + '<i class="ti ' + (a.done ? 'ti-circle-check-filled' : 'ti-circle-dashed') + '"></i></button>'
      + '<div class="alert-item-body">'
      + '<div class="alert-item-text">' + esc(a.text) + '</div>'
      + '<div class="alert-item-meta">'
      + '<span><i class="ti ti-user" style="font-size:11px"></i> ' + esc(a.authorName) + '</span>'
      + '<span><i class="ti ti-calendar" style="font-size:11px"></i> ' + formatAlertDate(a.date) + '</span>'
      + (isOld && !a.done ? '<span class="alert-overdue"><i class="ti ti-alert-triangle" style="font-size:11px"></i> Pendente do dia anterior</span>' : '')
      + '</div>'
      + '</div>'
      + '</div>'
      + '<button class="icon-btn del" onclick="deleteAlert(\'' + a.id + '\')" title="Remover"><i class="ti ti-trash"></i></button>'
      + '</div>';
  }
  list.innerHTML = html;
  updateAlertBadge();
}

function isOlderThanToday(dateStr) {
  var today = new Date();
  var d = new Date(dateStr);
  today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return d < today;
}

function formatAlertDate(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

function updateAlertBadge() {
  var open = alerts.filter(function(a) { return !a.done; });
  var btn = document.getElementById('alerts-badge');
  if (btn) {
    if (open.length) {
      btn.textContent = open.length;
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  }
  var overdue = alerts.filter(function(a) { return !a.done && isOlderThanToday(a.date); });
  var dashBadge = document.getElementById('dashboard-alert-banner');
  if (dashBadge) {
    if (overdue.length) {
      dashBadge.style.display = '';
      dashBadge.querySelector('.dab-count').textContent = overdue.length + ' aviso' + (overdue.length !== 1 ? 's' : '') + ' pendente' + (overdue.length !== 1 ? 's' : '') + ' do dia anterior';
    } else {
      dashBadge.style.display = 'none';
    }
  }
}

function addAlert() {
  if (!currentUser) { showToast('Faça login para adicionar avisos.'); return; }
  var inp = document.getElementById('alert-new-input');
  var dateInp = document.getElementById('alert-new-date');
  var text = (inp ? inp.value.trim() : '');
  if (!text) { showToast('Escreva o aviso antes de salvar.'); return; }

  var today = new Date();
  var dateStr = dateInp && dateInp.value ? dateInp.value : today.toISOString().slice(0,10);

  alerts.unshift({
    id: 'al_' + Date.now(),
    text: text,
    authorId: currentUser.id,
    authorName: currentUser.name,
    date: dateStr,
    done: false
  });

  saveAlerts();
  if (inp) inp.value = '';
  if (dateInp) dateInp.value = new Date().toISOString().slice(0,10);
  renderAlerts();
  showToast('Aviso adicionado.');
}

function toggleAlert(id) {
  var a = alerts.find(function(x) { return x.id === id; });
  if (!a) return;
  a.done = !a.done;
  saveAlerts();
  renderAlerts();
  renderDashboard();
}

function deleteAlert(id) {
  if (!confirm('Remover este aviso?')) return;
  alerts = alerts.filter(function(a) { return a.id !== id; });
  saveAlerts();
  renderAlerts();
  renderDashboard();
}

