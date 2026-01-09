import { loadJSON, saveJSON, getMemoryPaths } from '../store.js';
import { applyDecayToEpisodic, calculateRelevanceWeight, sortByRelevance } from './decay.js';
import { randomUUID } from 'crypto';

const MAX_EPISODIC_MEMORIES = 50;

export async function loadEpisodic() {
  const paths = getMemoryPaths();
  const data = loadJSON(paths.episodicRaw);
  return data?.memories || [];
}

export async function loadEpisodicWithDecay() {
  const memories = await loadEpisodic();
  return applyDecayToEpisodic(memories);
}

export async function addEpisodic(content, source = 'interaction', confidence = 0.9, metadata = {}) {
  const memories = await loadEpisodic();
  const newMemory = {
    id: randomUUID().slice(0, 8),
    timestamp: new Date().toISOString(),
    content,
    source,
    confidence,
    access_count: 0,
    ...metadata,
  };
  memories.push(newMemory);

  if (memories.length > MAX_EPISODIC_MEMORIES) {
    const decayedWithRelevance = applyDecayToEpisodic(memories);
    const sorted = sortByRelevance(decayedWithRelevance);
    memories.length = 0;
    for (let i = 0; i < MAX_EPISODIC_MEMORIES && i < sorted.length; i++) {
      const orig = memories.find((m) => m.id === sorted[i].id);
      if (orig) memories.push(orig);
    }
  }

  const paths = getMemoryPaths();
  await saveJSON(paths.episodicRaw, {
    memories,
    version: '0.4.0',
    updated_at: new Date().toISOString(),
  });
  return newMemory;
}

export async function incrementAccess(ids) {
  if (!ids || ids.length === 0) return;
  const memories = await loadEpisodic();
  let changed = false;
  memories.forEach((m) => {
    if (ids.includes(m.id)) {
      m.access_count = (m.access_count || 0) + 1;
      changed = true;
    }
  });

  if (changed) {
    const paths = getMemoryPaths();
    await saveJSON(paths.episodicRaw, {
      memories,
      version: '0.4.0',
      updated_at: new Date().toISOString(),
    });
  }
}

export async function getEpisodicSummary() {
  const memories = await loadEpisodic();
  const decayed = applyDecayToEpisodic(memories);
  const totalDecay = decayed.reduce((sum, m) => sum + m.decay, 0);
  const avgDecay = memories.length > 0 ? totalDecay / memories.length : 0;

  return {
    count: memories.length,
    avgDecay: parseFloat(avgDecay.toFixed(2)),
    oldest: memories.length > 0 ? memories[0].timestamp : null,
    newest: memories.length > 0 ? memories[memories.length - 1].timestamp : null,
  };
}

export default { loadEpisodic, loadEpisodicWithDecay, addEpisodic, getEpisodicSummary, incrementAccess };
