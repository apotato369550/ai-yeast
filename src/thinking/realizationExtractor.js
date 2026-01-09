import config from '../config.js';

/**
 * Extract thinking and realization blocks from LLM response
 */
export function extractThinkingAndRealizations(content) {
  const thinkingRegex = /<thinking\s+depth="(\d)">([\s\S]*?)<\/thinking>/g;
  const realizationRegex = /<realizations>([\s\S]*?)<\/realizations>/g;

  const thinkingMatches = [...content.matchAll(thinkingRegex)];
  const realizationMatches = [...content.matchAll(realizationRegex)];

  return {
    thinking_blocks: thinkingMatches.map(m => ({
      depth: parseInt(m[1]),
      content: m[2].trim(),
    })),
    realizations: realizationMatches.map(m => m[1].trim()),
  };
}

/**
 * Validate thinking blocks against configured limits
 */
export function validateThinkingBlocks(thinkingBlocks) {
  const limit = parseInt(config.THINKING_BLOCKS_PER_QUERY || '3');

  if (thinkingBlocks.length > limit) {
    return {
      valid: false,
      warning: `Thinking limit exceeded: ${thinkingBlocks.length} blocks > ${limit} allowed`,
      exceeded_count: thinkingBlocks.length - limit,
    };
  }

  return { valid: true, warning: null };
}

/**
 * Parse realizations into bullets
 */
export function parseRealizations(realizationText) {
  return realizationText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-') || line.startsWith('•'))
    .map(line => line.replace(/^[-•]\s*/, '').trim())
    .filter(line => line.length > 0);
}

/**
 * Calculate saliency for realizations based on thinking depth
 */
export function calculateRealizationSaliency(interactionSaliency, thinkingDepth) {
  const multiplier = config.THINKING_REALIZATION_SALIENCY_MULT || 0.9;
  const depthFactor = Math.min(thinkingDepth / 3, 1.0); // Normalize depth to 0-1

  return Math.min(
    interactionSaliency * multiplier * (0.7 + depthFactor * 0.3),
    1.0
  );
}

export default {
  extractThinkingAndRealizations,
  validateThinkingBlocks,
  parseRealizations,
  calculateRealizationSaliency,
};
