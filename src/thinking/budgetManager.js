import config from '../config.js';

export function estimateTokens(text) {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

export function truncateThinkingToBudget(thinkingBlock, budget = config.THINKING_BUDGET) {
  const tokens = estimateTokens(thinkingBlock);

  if (tokens <= budget) {
    return { truncated: false, thinking: thinkingBlock, tokens };
  }

  const cutoffWords = Math.floor((budget / 1.3) * 0.95);
  const words = thinkingBlock.split(/\s+/);
  const truncated = words.slice(0, cutoffWords).join(' ') + ' [thinking truncated at budget]';

  return { truncated: true, thinking: truncated, tokens: estimateTokens(truncated) };
}

export function trackBudgetUsage(thinking) {
  const tokens = estimateTokens(thinking);
  const budget = config.THINKING_BUDGET;
  const usage = (tokens / budget * 100).toFixed(1);

  return {
    tokens_used: tokens,
    tokens_budget: budget,
    percentage_used: parseFloat(usage),
    exceeded: tokens > budget,
  };
}

export function formatThinkingForDisplay(thinkingText) {
  const lines = thinkingText.split('\n');
  const formatted = lines.map((line) => `  > ${line}`).join('\n');
  return `[yeast! thinking...]\n${formatted}`;
}

export default { estimateTokens, truncateThinkingToBudget, trackBudgetUsage, formatThinkingForDisplay };
