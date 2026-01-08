import { loadJSON, saveJSON, getMemoryPaths } from '../store.js';
import { randomUUID } from 'crypto';

const MAX_SEMANTIC_FACTS = 100;

export async function loadSemantic() {
  const paths = getMemoryPaths();
  const data = loadJSON(paths.semanticDistilled);
  return data?.facts || [];
}

export async function addSemantic(content, source = 'consolidation', confidence = 0.85) {
  const facts = await loadSemantic();
  const newFact = {
    id: randomUUID().slice(0, 8),
    timestamp: new Date().toISOString(),
    content,
    source,
    confidence,
    revisions: [],
  };
  facts.push(newFact);

  if (facts.length > MAX_SEMANTIC_FACTS) {
    const sorted = [...facts].sort((a, b) => b.confidence - a.confidence);
    facts.length = 0;
    for (let i = 0; i < MAX_SEMANTIC_FACTS && i < sorted.length; i++) {
      facts.push(sorted[i]);
    }
  }

  const paths = getMemoryPaths();
  await saveJSON(paths.semanticDistilled, {
    facts,
    version: '0.4.0',
    updated_at: new Date().toISOString(),
  });
  return newFact;
}

export async function getSemanticSummary() {
  const facts = await loadSemantic();
  const avgConfidence = facts.length > 0 ? facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length : 0;

  return {
    count: facts.length,
    avgConfidence: parseFloat(avgConfidence.toFixed(2)),
    oldest: facts.length > 0 ? facts[0].timestamp : null,
    newest: facts.length > 0 ? facts[facts.length - 1].timestamp : null,
  };
}

export default { loadSemantic, addSemantic, getSemanticSummary };
