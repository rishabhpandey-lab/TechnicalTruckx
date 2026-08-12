const assert = require('node:assert/strict');
const {
  buildEmailPreview,
  cloneFlowDefinition,
  createUniqueNumber,
  normalizeAdminFlow,
  parseOptions,
  trimSelectionsAfterStep,
} = require('../flowCore');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('parseOptions trims blank lines and keeps admin-provided choices', () => {
  assert.deepEqual(parseOptions(' Routine \n\nUrgent\n Vehicle off-road '), ['Routine', 'Urgent', 'Vehicle off-road']);
});

test('normalizeAdminFlow drops incomplete rows and assigns stable step ids', () => {
  assert.deepEqual(normalizeAdminFlow([
    { title: ' Service ', options: [' PM ', ''] },
    { title: ' ', options: ['Ignored'] },
  ]), [{ id: 'step1', title: 'Service', options: ['PM'] }]);
});

test('normalizeAdminFlow falls back to defaults if all admin rows are empty', () => {
  assert.deepEqual(normalizeAdminFlow([{ title: ' ', options: [] }]), cloneFlowDefinition());
});

test('trimSelectionsAfterStep removes downstream choices after earlier selection changes', () => {
  const flow = [
    { id: 'service', title: 'Service', options: ['A'] },
    { id: 'priority', title: 'Priority', options: ['B'] },
    { id: 'location', title: 'Location', options: ['C'] },
  ];
  assert.deepEqual(trimSelectionsAfterStep({ service: 'A', priority: 'B', location: 'C' }, flow, 1), { service: 'A', priority: 'B' });
});

test('createUniqueNumber retries when a generated id already exists', () => {
  const existing = { 'TT-000001': {} };
  const values = [1, 35];
  const id = createUniqueNumber(existing, () => [values.shift()]);
  assert.equal(id, 'TT-00000Z');
});

test('buildEmailPreview marks missing optional data while including selected flow', () => {
  const preview = buildEmailPreview(
    { customerName: 'Ava', vehicleId: '', contactEmail: '', notes: 'Send quote' },
    { service: 'Breakdown', priority: 'Urgent' },
    [
      { id: 'service', title: 'Service', options: [] },
      { id: 'priority', title: 'Priority', options: [] },
    ],
  );
  assert.match(preview, /Customer: Ava/);
  assert.match(preview, /Vehicle \/ Asset ID: \[not entered\]/);
  assert.match(preview, /Flow: Breakdown > Urgent/);
  assert.match(preview, /Notes: Send quote/);
});

for (const { name, fn } of tests) {
  fn();
  console.log(`✓ ${name}`);
}
