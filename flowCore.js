(function attachFlowCore(globalScope) {
  const defaultFlowDefinition = Object.freeze([
    Object.freeze({
      id: 'serviceType',
      title: 'Select service type',
      options: Object.freeze(['Preventive maintenance', 'Breakdown support', 'Compliance inspection']),
    }),
    Object.freeze({
      id: 'priority',
      title: 'Select priority',
      options: Object.freeze(['Routine', 'Urgent', 'Vehicle off-road']),
    }),
    Object.freeze({
      id: 'location',
      title: 'Select location type',
      options: Object.freeze(['Workshop visit', 'Mobile technician', 'Remote guidance']),
    }),
  ]);

  function cloneFlowDefinition(flowDefinition = defaultFlowDefinition) {
    return flowDefinition.map((step) => ({ ...step, options: [...step.options] }));
  }

  function normalizeAdminFlow(rawSteps) {
    const normalized = rawSteps
      .map((step, index) => ({
        id: `step${index + 1}`,
        title: step.title.trim(),
        options: step.options.map((option) => option.trim()).filter(Boolean),
      }))
      .filter((step) => step.title && step.options.length);

    return normalized.length ? normalized : cloneFlowDefinition();
  }

  function parseOptions(value) {
    return value.split('\n').map((option) => option.trim()).filter(Boolean);
  }

  function trimSelectionsAfterStep(selections, flowDefinition, stepIndex) {
    return Object.fromEntries(
      Object.entries(selections).filter(([key]) => flowDefinition.findIndex((step) => step.id === key) <= stepIndex),
    );
  }

  function createUniqueNumber(existingRecords, randomValues) {
    let id;
    do {
      const random = randomValues()[0].toString(36).toUpperCase();
      id = `TT-${random.slice(0, 6).padStart(6, '0')}`;
    } while (existingRecords[id]);
    return id;
  }

  function buildEmailPreview(data, selections, flowDefinition) {
    const chosen = flowDefinition.map((step) => selections[step.id]).filter(Boolean).join(' > ') || 'No flow selections yet';
    return `Subject: Service request details\n\nCustomer: ${data.customerName || '[not entered]'}\nVehicle / Asset ID: ${data.vehicleId || '[not entered]'}\nContact: ${data.contactEmail || '[not entered]'}\nFlow: ${chosen}\nNotes: ${data.notes || '[not entered]'}`;
  }

  const api = {
    buildEmailPreview,
    cloneFlowDefinition,
    createUniqueNumber,
    defaultFlowDefinition,
    normalizeAdminFlow,
    parseOptions,
    trimSelectionsAfterStep,
  };

  globalScope.FlowCore = api;
  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
