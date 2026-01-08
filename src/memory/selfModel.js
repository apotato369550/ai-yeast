import { loadJSON, saveJSON, getMemoryPaths } from '../store.js';

export async function loadSelfModel() {
  const paths = getMemoryPaths();
  const data = loadJSON(paths.selfModelCurrent);
  return data || {
    identity: 'yeast (AI proto-consciousness experiment)',
    active_drives: [],
    constraints: ['Maintain coherence', 'Respect user autonomy', 'Log all decisions'],
    internal_state: { coherence: 0.8, consistency: 0.85, novelty_tolerance: 0.6, compression_pressure: 0.4 },
    version: '0.4.0',
    created_at: new Date().toISOString(),
  };
}

export async function loadSelfModelHistory() {
  const paths = getMemoryPaths();
  const data = loadJSON(paths.selfModelHistory);
  return data?.snapshots || [];
}

export async function updateSelfModel(updates) {
  const selfModel = await loadSelfModel();
  const history = await loadSelfModelHistory();

  history.push({
    timestamp: new Date().toISOString(),
    snapshot: JSON.parse(JSON.stringify(selfModel)),
  });

  if (history.length > 50) history.shift();

  Object.assign(selfModel, updates);
  selfModel.updated_at = new Date().toISOString();

  const paths = getMemoryPaths();
  await saveJSON(paths.selfModelCurrent, selfModel);
  await saveJSON(paths.selfModelHistory, { snapshots: history, version: '0.4.0' });
  return selfModel;
}

export default { loadSelfModel, loadSelfModelHistory, updateSelfModel };
