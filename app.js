const { buildEmailPreview, cloneFlowDefinition, createUniqueNumber, normalizeAdminFlow, parseOptions, trimSelectionsAfterStep } = FlowCore;

const storageKeys = {
  flowDefinition: 'adminFlowDefinition',
  records: 'flowRecords',
};

const flowSteps = document.querySelector('#flow-steps');
const completeButton = document.querySelector('#complete-flow');
const resetButton = document.querySelector('#reset-flow');
const resultCard = document.querySelector('#result-card');
const searchForm = document.querySelector('#search-form');
const searchInput = document.querySelector('#search-input');
const searchResults = document.querySelector('#search-results');
const dataForm = document.querySelector('#optional-data');
const emailPreview = document.querySelector('#email-preview');
const adminForm = document.querySelector('#admin-flow-form');
const adminSteps = document.querySelector('#admin-steps');
const addStepButton = document.querySelector('#add-step');
const restoreDefaultsButton = document.querySelector('#restore-defaults');

let flowDefinition = loadFlowDefinition();
let selections = {};
let activeStepIndex = 0;

function loadFlowDefinition() {
  const saved = JSON.parse(localStorage.getItem(storageKeys.flowDefinition) || 'null');
  return Array.isArray(saved) && saved.length ? saved : cloneFlowDefinition();
}

function saveFlowDefinition() {
  localStorage.setItem(storageKeys.flowDefinition, JSON.stringify(flowDefinition));
}

function loadRecords() {
  return JSON.parse(localStorage.getItem(storageKeys.records) || '{}');
}

function saveRecords(records) {
  localStorage.setItem(storageKeys.records, JSON.stringify(records));
}

function optionButton(step, option, selected) {
  const button = document.createElement('button');
  button.className = `option ${selected ? 'selected' : ''}`;
  button.type = 'button';
  button.dataset.step = step.id;
  button.dataset.value = option;

  const check = document.createElement('span');
  check.className = 'check';
  check.textContent = '✓';

  const label = document.createElement('span');
  label.textContent = option;

  button.append(check, label);
  return button;
}

function renderFlow() {
  flowSteps.replaceChildren();
  flowDefinition.forEach((step, index) => {
    if (index > activeStepIndex) return;

    const selected = selections[step.id];
    const card = document.createElement('article');
    card.className = `step-card ${index === activeStepIndex ? 'active' : ''}`;

    const titleRow = document.createElement('div');
    titleRow.className = 'step-title';

    const title = document.createElement('h3');
    title.textContent = `${index + 1}. ${step.title}`;

    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = selected ? '✓ Selected' : 'Pending';

    const optionGrid = document.createElement('div');
    optionGrid.className = 'option-grid';
    step.options.forEach((option) => optionGrid.appendChild(optionButton(step, option, selected === option)));

    titleRow.append(title, status);
    card.append(titleRow, optionGrid);
    flowSteps.appendChild(card);
  });
  completeButton.disabled = Object.keys(selections).length !== flowDefinition.length;
}

function uniqueNumber() {
  return createUniqueNumber(loadRecords(), () => crypto.getRandomValues(new Uint32Array(1)));
}

function optionalData() {
  return Object.fromEntries(new FormData(dataForm).entries());
}

function updateEmailPreview() {
  emailPreview.textContent = buildEmailPreview(optionalData(), selections, flowDefinition);
}

function resetFlowState() {
  selections = {};
  activeStepIndex = 0;
  resultCard.classList.add('hidden');
  renderFlow();
  updateEmailPreview();
}

function renderAdminEditor() {
  adminSteps.replaceChildren();
  flowDefinition.forEach((step, index) => {
    const card = document.createElement('fieldset');
    card.className = 'admin-step';

    const legend = document.createElement('legend');
    legend.textContent = `Step ${index + 1}`;

    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Step title';
    const titleInput = document.createElement('input');
    titleInput.name = `step-title-${index}`;
    titleInput.value = step.title;
    titleInput.required = true;
    titleLabel.appendChild(titleInput);

    const optionsLabel = document.createElement('label');
    optionsLabel.textContent = 'Options (one per line)';
    const optionsInput = document.createElement('textarea');
    optionsInput.name = `step-options-${index}`;
    optionsInput.rows = 4;
    optionsInput.required = true;
    optionsInput.value = step.options.join('\n');
    optionsLabel.appendChild(optionsInput);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary compact';
    remove.textContent = 'Remove step';
    remove.disabled = flowDefinition.length === 1;
    remove.addEventListener('click', () => {
      flowDefinition.splice(index, 1);
      saveFlowDefinition();
      resetFlowState();
      renderAdminEditor();
    });

    card.append(legend, titleLabel, optionsLabel, remove);
    adminSteps.appendChild(card);
  });
}

function applyAdminChanges() {
  const updated = Array.from(adminSteps.querySelectorAll('.admin-step')).map((card, index) => ({
    title: card.querySelector(`[name="step-title-${index}"]`).value,
    options: parseOptions(card.querySelector(`[name="step-options-${index}"]`).value),
  }));

  flowDefinition = normalizeAdminFlow(updated);
  saveFlowDefinition();
  resetFlowState();
  renderAdminEditor();
}

flowSteps.addEventListener('click', (event) => {
  const option = event.target.closest('.option');
  if (!option) return;
  const stepIndex = flowDefinition.findIndex((step) => step.id === option.dataset.step);
  selections = trimSelectionsAfterStep(selections, flowDefinition, stepIndex);
  selections[option.dataset.step] = option.dataset.value;
  activeStepIndex = Math.min(stepIndex + 1, flowDefinition.length - 1);
  resultCard.classList.add('hidden');
  renderFlow();
  updateEmailPreview();
});

completeButton.addEventListener('click', () => {
  const id = uniqueNumber();
  const records = loadRecords();
  records[id] = { id, flowDefinition, selections, optionalData: optionalData(), createdAt: new Date().toISOString() };
  saveRecords(records);
  resultCard.classList.remove('hidden');
  resultCard.textContent = `Unique number generated: ${id}. Enter this number in the search bar to view all selected steps.`;
});

resetButton.addEventListener('click', resetFlowState);

dataForm.addEventListener('input', updateEmailPreview);

adminForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyAdminChanges();
});

addStepButton.addEventListener('click', () => {
  flowDefinition.push({ id: `step${flowDefinition.length + 1}`, title: 'New admin step', options: ['First option', 'Second option'] });
  saveFlowDefinition();
  resetFlowState();
  renderAdminEditor();
});

restoreDefaultsButton.addEventListener('click', () => {
  flowDefinition = cloneFlowDefinition();
  saveFlowDefinition();
  resetFlowState();
  renderAdminEditor();
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = searchInput.value.trim().toUpperCase();
  const record = loadRecords()[id];
  searchResults.classList.remove('hidden');
  searchResults.replaceChildren();

  const heading = document.createElement('h2');
  if (!record) {
    heading.textContent = 'No flow found';
    const message = document.createElement('p');
    message.textContent = `No saved flow matches ${id || 'your search'}.`;
    searchResults.append(heading, message);
    return;
  }

  heading.textContent = `Saved flow ${record.id}`;
  const created = document.createElement('p');
  created.textContent = `Created ${new Date(record.createdAt).toLocaleString()}`;

  const list = document.createElement('ol');
  record.flowDefinition.forEach((step) => {
    const item = document.createElement('li');
    item.textContent = `${step.title}: ${record.selections[step.id]}`;
    list.appendChild(item);
  });

  const dataTitle = document.createElement('h3');
  dataTitle.textContent = 'Optional data captured';
  const dataList = document.createElement('ul');
  [
    ['Customer', record.optionalData.customerName],
    ['Vehicle / Asset ID', record.optionalData.vehicleId],
    ['Email', record.optionalData.contactEmail],
    ['Notes', record.optionalData.notes],
  ].forEach(([label, value]) => {
    const item = document.createElement('li');
    item.textContent = `${label}: ${value || '[not entered]'}`;
    dataList.appendChild(item);
  });

  searchResults.append(heading, created, list, dataTitle, dataList);
});

renderAdminEditor();
renderFlow();
updateEmailPreview();
