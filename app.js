const flowSteps = document.querySelector('#flow-steps');
const resultCard = document.querySelector('#result-card');
const searchForm = document.querySelector('#search-form');
const searchInput = document.querySelector('#search-input');
const searchResults = document.querySelector('#search-results');
const dataForm = document.querySelector('#optional-data');
const adminEditor = document.querySelector('#admin-editor');

let journey = { queue:null, path:[], startedAt:null };

async function api(url, options={}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderStart() {
  journey = {queue:null, path:[], startedAt:new Date().toISOString()};
  resultCard.classList.add('hidden');
  flowSteps.innerHTML = `
    <div class="option-grid category-choice">
      <button class="option" data-queue="Technical"><strong>Technical</strong><span>Technical support issues</span></button>
      <button class="option" data-queue="Billing"><strong>Billing</strong><span>Billing and account issues</span></button>
    </div>`;
}

async function loadIssues(queue) {
  journey.queue = queue;
  journey.path = [{type:'category', label:queue}];
  flowSteps.innerHTML = '<p>Loading issues...</p>';
  try {
    const data = await api(`/api/flows/${encodeURIComponent(queue)}/issues`);
    if (!data.issues.length) {
      flowSteps.innerHTML = `<div class="empty">No ${escapeHtml(queue)} issues have been configured by the administrator yet.</div>`;
      return;
    }
    flowSteps.innerHTML = `<div class="breadcrumb">${escapeHtml(queue)}</div><div class="option-grid">${data.issues.map(i => `<button class="option" data-issue="${escapeHtml(i.issueId)}"><strong>${escapeHtml(i.title)}</strong></button>`).join('')}</div>`;
  } catch (error) { flowSteps.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

async function loadNode(nodeId, label) {
  journey.path.push({nodeId,label});
  flowSteps.innerHTML = '<p>Loading next options...</p>';
  try {
    const data = await api(`/api/flows/${encodeURIComponent(journey.queue)}/nodes/${encodeURIComponent(nodeId)}`);
    const node = data.node;
    if (!node.options?.length) {
      await completeJourney();
      return;
    }
    flowSteps.innerHTML = `<div class="breadcrumb">${journey.path.map(x=>escapeHtml(x.label)).join(' → ')}</div><h3>${escapeHtml(node.title)}</h3><div class="option-grid">${node.options.map(o=>`<button class="option" data-next="${escapeHtml(o.next || '')}" data-end="${o.end ? '1':'0'}"><strong>${escapeHtml(o.label)}</strong></button>`).join('')}</div>`;
  } catch (error) { flowSteps.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

async function completeJourney() {
  try {
    const data = Object.fromEntries(new FormData(dataForm).entries());
    const saved = await api('/api/journeys', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({queue:journey.queue,path:journey.path,data,startedAt:journey.startedAt})});
    resultCard.classList.remove('hidden');
    resultCard.innerHTML = `<strong>Journey complete</strong><p>Unique Journey ID: <b>${escapeHtml(saved.journeyId)}</b></p><button id="new-journey" class="secondary">Start New Journey</button>`;
    document.querySelector('#new-journey').onclick = renderStart;
    flowSteps.innerHTML = '<div class="empty">The journey has been saved. Use the Journey ID above to retrieve it later.</div>';
  } catch(error) { flowSteps.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

flowSteps.addEventListener('click', async event => {
  const queue = event.target.closest('[data-queue]');
  if (queue) return loadIssues(queue.dataset.queue);
  const issue = event.target.closest('[data-issue]');
  if (issue) return loadNode(issue.dataset.issue, issue.querySelector('strong').textContent);
  const next = event.target.closest('[data-next]');
  if (next) {
    const label = next.querySelector('strong').textContent;
    journey.path.push({nodeId: journey.path[journey.path.length-1]?.nodeId || '', label});
    if (next.dataset.end === '1' || !next.dataset.next) return completeJourney();
    return loadNode(next.dataset.next, label);
  }
});

searchForm.addEventListener('submit', async event => {
  event.preventDefault();
  const id = searchInput.value.trim().toUpperCase();
  searchResults.classList.remove('hidden');
  searchResults.innerHTML = 'Searching...';
  try {
    const data = await api(`/api/journeys/${encodeURIComponent(id)}`);
    searchResults.innerHTML = `<h2>Journey ${escapeHtml(data.journey.journeyId)}</h2><p>Category: ${escapeHtml(data.journey.queue)}</p><ol>${data.journey.path.map(p=>`<li>${escapeHtml(p.label)}</li>`).join('')}</ol>`;
  } catch(error) { searchResults.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
});

function renderAdmin() {
  adminEditor.innerHTML = `
    <div class="admin-note">Admin issue management is backed by MongoDB. Add or edit the issue list for either category. Each issue can later be given its own decision nodes and response branches.</div>
    <div class="admin-grid"><div class="admin-box"><h3>Technical Issues</h3><div id="technical-admin"></div></div><div class="admin-box"><h3>Billing Issues</h3><div id="billing-admin"></div></div></div>`;
  renderAdminQueue('Technical'); renderAdminQueue('Billing');
}

async function renderAdminQueue(queue) {
  const target = document.querySelector(`#${queue.toLowerCase()}-admin`);
  try {
    const data = await api(`/api/admin/flows/${queue}/issues`);
    target.innerHTML = data.issues.map(issue => `<div class="admin-item"><input value="${escapeHtml(issue.title)}" data-edit="${escapeHtml(issue.issueId)}"><button class="secondary" data-save="${escapeHtml(issue.issueId)}">Save</button><button class="secondary" data-delete="${escapeHtml(issue.issueId)}">Delete</button></div>`).join('') + `<div class="admin-add"><input id="add-${queue}" placeholder="New issue name"><button data-add="${queue}">Add Issue</button></div>`;
  } catch(error) { target.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

adminEditor.addEventListener('click', async event => {
  const add = event.target.closest('[data-add]');
  const save = event.target.closest('[data-save]');
  const del = event.target.closest('[data-delete]');
  try {
    if (add) {
      const input = document.querySelector(`#add-${add.dataset.add}`);
      if (!input.value.trim()) return;
      await api(`/api/admin/flows/${add.dataset.add}/issues`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:input.value.trim()})});
      await renderAdminQueue(add.dataset.add); return;
    }
    if (save) {
      const input = document.querySelector(`[data-edit="${CSS.escape(save.dataset.save)}"]`);
      await api(`/api/admin/issues/${save.dataset.save}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:input.value.trim()})});
      return;
    }
    if (del) {
      await api(`/api/admin/issues/${del.dataset.delete}`, {method:'DELETE'});
      await renderAdminQueue(del.closest('.admin-box').querySelector('h3').textContent.startsWith('Technical') ? 'Technical':'Billing');
    }
  } catch(error) { alert(error.message); }
});

document.querySelector('#refresh-admin').onclick = renderAdmin;
renderStart();
renderAdmin();
