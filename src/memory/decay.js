import config from '../config.js';

export function calculateDecay(createdAt, halfLifeDays = config.MEMORY_DECAY_HALF_LIFE_DAYS) {
  try {
    const created = new Date(createdAt);
    const now = new Date();
    const ageDays = (now - created) / (1000 * 60 * 60 * 24);
    if (ageDays < 0) return 1.0;
    const decayFactor = Math.pow(0.5, ageDays / halfLifeDays);
    return Math.max(0.0, Math.min(1.0, decayFactor));
  } catch (error) {
    return 1.0;
  }
}

export function calculateRelevanceWeight(memory) {
  const decay = calculateDecay(memory.timestamp);
  const confidence = memory.confidence || 0.9;
  return decay * confidence;
}

export function applyDecayToEpisodic(memories) {
  return memories.map((mem) => ({
    ...mem,
    decay: calculateDecay(mem.timestamp),
    relevance_weight: calculateRelevanceWeight(mem),
  }));
}

export function sortByRelevance(memories) {
  return [...memories].sort((a, b) => calculateRelevanceWeight(b) - calculateRelevanceWeight(a));
}

export default { calculateDecay, calculateRelevanceWeight, applyDecayToEpisodic, sortByRelevance };
