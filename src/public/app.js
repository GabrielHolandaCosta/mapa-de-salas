const $ = selector => document.querySelector(selector);
const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const roleNames = { ADMIN: 'Administrador', EDITOR: 'Editor', VIEWER: 'Visualizador' };
let me = null;
let rows = [];
let importPreview = [];
let selectedDate = new Date().toISOString().slice(0, 10);

async function api(url, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(url, { ...options, headers: isForm ? options.headers : { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (response.status === 401) { $('#workspace').hidden = true; $('#login').hidden = false; throw new Error('Sua sessão terminou. Entre novamente.'); }
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error || 'Não foi possível concluir a ação.'); }
  return response.status === 204 ? null : response.json();
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dateOnly = value => value ? String(value).slice(0, 10) : null;
function weekday() { const day = new Date(`${selectedDate}T12:00:00`).getDay(); return day === 0 ? 5 : Math.max(0, Math.min(5, day - 1)); }
function canEdit() { return me && (me.role === 'ADMIN' || me.role === 'EDITOR'); }
function showSave(text = 'Atualizado') { $('#saveState').textContent = text; }

async function load() {
  const scope = $('#mode').value;
  const date = scope === 'DATA' ? selectedDate : '';
  rows = (await api(`/api/assignments?scope=${scope}&weekday=${$('#day').value}&date=${date}`)).rows;
  render();
}

function render() {
  const query = $('#search').value.toLowerCase().trim();
  const status = $('#statusFilter').value;
  const groups = Array.from({ length: 17 }, (_, index) => ({ room: index + 1, turns: rows.filter(row => row.room === index + 1) }))
    .filter(group => !query || String(group.room).padStart(2, '0').includes(query) || group.turns.some(turn => [turn.professional, turn.specialty, turn.code, turn.operator, turn.notes].join(' ').toLowerCase().includes(query)))
    .filter(group => !status || group.turns.some(turn => turn.status === status));
  const count = value => rows.filter(row => row.status === value).length;
  $('#stats').innerHTML = ['LIVRE', 'OCUPADA', 'RESERVADA', 'FECHADA'].map(value => `<div class="stat ${value}"><b>${count(value)}</b><span>${value[0] + value.slice(1).toLowerCase()}</span></div>`).join('');
  $('#rooms').innerHTML = groups.map(group => `<button class="room" data-room="${group.room}"><div class="room-title"><span>Sala</span><strong>${String(group.room).padStart(2, '0')}</strong></div>${group.turns.map(turn => `<div class="shift ${turn.status}"><strong>${turn.shift === 'MANHA' ? 'Manhã' : 'Tarde'} · ${turn.status}</strong><span>${esc(turn.professional || (turn.status === 'LIVRE' ? 'Disponível' : 'Sem profissional definido'))}</span>${turn.specialty ? `<small>${esc(turn.specialty)}</small>` : ''}${turn.needsReview ? '<small class="review-tag">Revisar importação</small>' : ''}</div>`).join('')}</button>`).join('');
  document.querySelectorAll('.room').forEach(button => button.onclick = () => openRoom(Number(button.dataset.room)));
}

function inputField(turn, key, label, type = 'text') {
  const disabled = canEdit() ? '' : 'disabled';
  if (type === 'textarea') return `<label>${label}<textarea data-id="${turn.id}" data-key="${key}" rows="3" ${disabled}>${esc(turn[key] || '')}</textarea></label>`;
  return `<label>${label}<input data-id="${turn.id}" data-key="${key}" value="${esc(turn[key] || '')}" ${disabled}></label>`;
}

function openRoom(room) {
  const turns = rows.filter(row => row.room === room);
  $('#editorTitle').textContent = `Sala ${String(room).padStart(2, '0')}`;
  $('#turns').className = 'turns';
  $('#turns').innerHTML = turns.map(turn => `<article class="turn ${turn.status}"><div class="turn-title"><h3>${turn.shift === 'MANHA' ? 'Manhã' : 'Tarde'}</h3><span class="save" id="state-${turn.id}">${canEdit() ? 'Salvo' : 'Somente leitura'}</span></div><label>Status<select data-id="${turn.id}" data-key="status" ${canEdit() ? '' : 'disabled'}>${['LIVRE', 'OCUPADA', 'RESERVADA', 'FECHADA'].map(value => `<option ${turn.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>${inputField(turn, 'professional', 'Profissional')}${inputField(turn, 'code', 'Código ou matrícula')}${inputField(turn, 'specialty', 'Especialidade')}${inputField(turn, 'operator', 'Secretária ou operador')}${inputField(turn, 'notes', 'Observações', 'textarea')}<div class="last-change"><strong>Última alteração</strong><span>${turn.lastEditedBy ? `${esc(turn.lastEditedBy)} · ` : ''}${new Date(turn.lastEditedAt || turn.updatedAt).toLocaleString('pt-BR')}</span></div>${canEdit() ? `<footer><button type="button" class="ghost clear" data-id="${turn.id}">Limpar turno</button></footer>` : ''}</article>`).join('');
  $('#editor').showModal();
  if (!canEdit()) return;
  document.querySelectorAll('#turns input,#turns textarea,#turns select').forEach(element => { let timer; element.oninput = () => { clearTimeout(timer); timer = setTimeout(() => saveTurn(element.dataset.id), 650); }; element.onchange = () => saveTurn(element.dataset.id); });
  document.querySelectorAll('.clear').forEach(button => button.onclick = async () => { if (!confirm('Limpar todas as informações deste turno?')) return; const turn = rows.find(row => row.id === button.dataset.id); Object.assign(turn, { status: 'LIVRE', professional: null, code: null, specialty: null, operator: null, notes: null }); await saveTurn(turn.id); });
}

async function saveTurn(id) {
  const turn = rows.find(row => row.id === id);
  document.querySelectorAll(`[data-id="${id}"]`).forEach(element => { turn[element.dataset.key] = element.value || null; });
  const state = $(`#state-${id}`); if (state) state.textContent = 'Salvando…'; showSave('Salvando…');
  try {
    let result;
    if ($('#mode').value === 'DATA' && turn.scope === 'PADRAO') {
      const payload = { ...turn, id: undefined, scope: 'DATA', date: selectedDate, weekday: null, version: undefined };
      result = await api('/api/assignments', { method: 'POST', body: JSON.stringify(payload) });
    } else {
      result = await api(`/api/assignments/${turn.id}`, { method: 'PUT', body: JSON.stringify({ ...turn, date: dateOnly(turn.date) }) });
    }
    Object.assign(turn, result.row); showSave('Salvo'); await load();
  } catch (error) { if (state) state.textContent = 'Erro ao salvar'; showSave('Erro ao salvar'); alert(error.message); }
}

async function showUsers(box) {
  const result = await api('/api/users');
  box.innerHTML = `<div class="section-head"><div><h3>Usuários</h3><p>Defina quem pode editar ou apenas visualizar.</p></div></div><form id="newUser" class="user-form"><input name="name" placeholder="Nome completo" required><input name="username" placeholder="Usuário" pattern="[a-zA-Z0-9._-]+" required><input name="password" type="password" minlength="6" placeholder="Senha (mínimo 6)" required><select name="role"><option value="VIEWER">Somente visualizar</option><option value="EDITOR">Pode editar</option><option value="ADMIN">Administrador</option></select><button>Criar usuário</button></form><div class="table-wrap"><table class="table"><tr><th>Pessoa</th><th>Permissão</th><th>Situação</th><th>Ações</th></tr>${result.rows.map(user => `<tr><td><strong>${esc(user.name)}</strong><br><span class="muted">@${esc(user.username || '')}</span></td><td><select data-role-user="${user.id}">${Object.entries(roleNames).map(([value,label])=>`<option value="${value}" ${user.role===value?'selected':''}>${label}</option>`).join('')}</select></td><td>${user.active ? 'Ativo' : 'Inativo'}</td><td class="user-actions"><button type="button" data-password-user="${user.id}">Nova senha</button><button type="button" data-user="${user.id}" data-active="${!user.active}">${user.active ? 'Desativar' : 'Reativar'}</button></td></tr>`).join('')}</table></div>`;
  $('#newUser').onsubmit = async event => { event.preventDefault(); await api('/api/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); showUsers(box); };
  box.querySelectorAll('[data-user]').forEach(button => button.onclick = async () => { await api(`/api/users/${button.dataset.user}`, { method: 'PATCH', body: JSON.stringify({ active: button.dataset.active === 'true' }) }); showUsers(box); });
  box.querySelectorAll('[data-role-user]').forEach(select => select.onchange = async () => { await api(`/api/users/${select.dataset.roleUser}`, { method: 'PATCH', body: JSON.stringify({ role: select.value }) }); showUsers(box); });
  box.querySelectorAll('[data-password-user]').forEach(button => button.onclick = async () => { const password = prompt('Digite a nova senha (mínimo de 6 caracteres):'); if (!password) return; await api(`/api/users/${button.dataset.passwordUser}`, { method: 'PATCH', body: JSON.stringify({ password }) }); alert('Senha alterada com sucesso.'); });
}

async function showHistory(box) {
  const result = await api('/api/audits');
  box.innerHTML = `<div class="section-head"><div><h3>Histórico</h3><p>Últimas pessoas que alteraram o mapa.</p></div></div><div class="table-wrap"><table class="table"><tr><th>Quando</th><th>Usuário</th><th>Sala e turno</th><th>Ação</th><th></th></tr>${result.rows.map(log => `<tr><td>${new Date(log.createdAt).toLocaleString('pt-BR')}</td><td>${esc(log.user.name)}<br><span class="muted">@${esc(log.user.username || '')}</span></td><td>Sala ${String(log.room || 0).padStart(2, '0')} · ${log.shift === 'MANHA' ? 'Manhã' : 'Tarde'}</td><td>${log.action}</td><td>${me.role === 'ADMIN' && log.before ? `<button data-restore="${log.id}">Restaurar</button>` : ''}</td></tr><tr><td colspan="5"><details><summary>Ver o que mudou</summary><pre>${esc(JSON.stringify(log.before, null, 2))}\n→\n${esc(JSON.stringify(log.after, null, 2))}</pre></details></td></tr>`).join('')}</table></div>`;
  box.querySelectorAll('[data-restore]').forEach(button => button.onclick = async () => { if (!confirm('Restaurar a versão anterior deste turno?')) return; await api(`/api/audits/${button.dataset.restore}/restore`, { method: 'POST' }); await showHistory(box); });
}

function previewTable() {
  return `<div class="import-summary"><strong>${importPreview.length} registros encontrados</strong><span>Todos preservam o texto original e ficam marcados para revisão.</span></div><div class="table-wrap"><table class="table"><tr><th>Sala</th><th>Dia</th><th>Turno</th><th>Status</th><th>Texto do Word</th></tr>${importPreview.slice(0, 220).map(row => `<tr><td>${String(row.room).padStart(2, '0')}</td><td>${days[row.weekday]}</td><td>${row.shift === 'MANHA' ? 'Manhã' : 'Tarde'}</td><td>${row.status}</td><td>${esc(row.rawText)}</td></tr>`).join('')}</table></div><button id="confirmImport">Confirmar importação</button>`;
}

async function showImport(box) {
  box.innerHTML = `<div class="section-head"><div><h3>Importar o Word</h3><p>Selecione o mapa original, revise a prévia e só então confirme.</p></div></div><label class="upload"><input id="wordFile" type="file" accept=".docx"><span>Selecionar documento Word</span></label><div id="importResult"><p class="review">O arquivo original nunca será alterado. ECO, Holter, ECG, EEG e outras áreas especiais ficam fora desta versão.</p></div>`;
  $('#wordFile').onchange = async event => { const file = event.target.files[0]; if (!file) return; const form = new FormData(); form.append('file', file); $('#importResult').innerHTML = '<p>Analisando documento…</p>'; try { const result = await api('/api/import/preview', { method: 'POST', body: form }); importPreview = result.rows; $('#importResult').innerHTML = previewTable(); $('#confirmImport').onclick = async () => { if (!confirm(`Importar ${importPreview.length} registros para a semana-padrão?`)) return; await api('/api/import/confirm', { method: 'POST', body: JSON.stringify({ rows: importPreview }) }); alert('Importação concluída. Os registros marcados podem ser revisados no mapa.'); await load(); showImport(box); }; } catch (error) { $('#importResult').innerHTML = `<p class="error">${esc(error.message)}</p>`; } };
}

async function admin(tab = me.role === 'ADMIN' ? 'users' : 'history') {
  if (me.role !== 'ADMIN' && tab !== 'history') tab = 'history';
  $('#admin').showModal();
  document.querySelectorAll('.tabs [data-tab]').forEach(button => { button.hidden = me.role !== 'ADMIN' && button.dataset.tab !== 'history'; button.classList.toggle('active', button.dataset.tab === tab); });
  const box = $('#adminContent'); box.innerHTML = '<p>Carregando…</p>';
  try { if (tab === 'users') await showUsers(box); else if (tab === 'history') await showHistory(box); else await showImport(box); } catch (error) { box.innerHTML = `<p class="error">${esc(error.message)}</p>`; }
}

async function init() {
  try { me = (await api('/api/auth/me')).user; } catch { return; }
  $('#login').hidden = true; $('#workspace').hidden = false; $('#date').value = selectedDate;
  $('#day').innerHTML = days.map((day, index) => `<option value="${index}">${day}</option>`).join(''); $('#day').value = weekday();
  $('#userBadge').textContent = `${me.name} · ${roleNames[me.role]}`; $('#adminBtn').hidden = false; $('#adminBtn').textContent = me.role === 'ADMIN' ? 'Administração' : 'Histórico';
  await load();
}

$('#loginForm').onsubmit = async event => { event.preventDefault(); try { me = (await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: $('#username').value, password: $('#password').value }) })).user; await init(); } catch (error) { $('#loginError').textContent = error.message; } };
$('#day').onchange = load; $('#mode').onchange = load; $('#date').onchange = () => { selectedDate = $('#date').value; $('#day').value = weekday(); load(); };
$('#prev').onclick = () => { $('#day').value = (+$('#day').value + 5) % 6; load(); }; $('#next').onclick = () => { $('#day').value = (+$('#day').value + 1) % 6; load(); };
$('#today').onclick = () => { $('#date').value = selectedDate = new Date().toISOString().slice(0, 10); $('#day').value = weekday(); load(); };
$('#search').oninput = render; $('#statusFilter').onchange = render; $('#theme').onclick = () => { document.body.classList.toggle('dark'); localStorage.setItem('mapa-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); };
$('#print').onclick = () => print(); $('#logout').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.reload(); }; $('#adminBtn').onclick = () => admin(); document.querySelectorAll('.tabs button').forEach(button => button.onclick = () => admin(button.dataset.tab));
if (localStorage.getItem('mapa-theme') === 'dark') document.body.classList.add('dark'); init();
