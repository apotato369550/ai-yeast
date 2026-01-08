import { loadEpisodicWithDecay } from '../memory/episodic.js';
import { loadSemantic } from '../memory/semantic.js';
import { loadSelfModel } from '../memory/selfModel.js';
import config from '../config.js';

export async function buildThinkingContext(ragDocs = []) {
  const selfModel = await loadSelfModel();
  const episodicMemories = await loadEpisodicWithDecay();
  const semanticFacts = await loadSemantic();

  const recentEpisodic = episodicMemories.slice(-config.THINKING_MEMORY_DEPTH);
  const recentSemantic = semanticFacts.slice(-config.THINKING_MEMORY_DEPTH);

  let memoryContext = '<thinking_context>\n';
  memoryContext += 'RECENT MEMORIES (last 5 interactions):\n';

  if (recentEpisodic.length > 0) {
    memoryContext += '- Episodic:\n';
    recentEpisodic.forEach((mem) => {
      memoryContext += `  * ${mem.content} (decay: ${(mem.decay * 100).toFixed(0)}%)\n`;
    });
  } else {
    memoryContext += '- Episodic: (none)\n';
  }

  if (recentSemantic.length > 0) {
    memoryContext += '- Semantic:\n';
    recentSemantic.forEach((fact) => {
      memoryContext += `  * ${fact.content}\n`;
    });
  } else {
    memoryContext += '- Semantic: (none)\n';
  }

  memoryContext += `\n- Self Model:\n`;
  memoryContext += `  * Identity: ${selfModel.identity}\n`;
  if (selfModel.active_drives && selfModel.active_drives.length > 0) {
    memoryContext += '  * Active drives: ' + selfModel.active_drives.join(', ') + '\n';
  }
  if (selfModel.constraints && selfModel.constraints.length > 0) {
    memoryContext += '  * Constraints: ' + selfModel.constraints.join(', ') + '\n';
  }

  if (config.THINKING_RAG_CONTEXT && ragDocs.length > 0) {
    memoryContext += '\nRELEVANT DOCUMENTS (by relevance):\n';
    ragDocs.forEach((doc, i) => {
      const excerpt = doc.filename || 'unknown';
      memoryContext += `- Document ${i + 1}: ${excerpt}\n`;
    });
  }

  memoryContext += '</thinking_context>\n';
  return memoryContext;
}

export function extractThinkingBlock(responseText) {
  const thinkingMatch = responseText.match(/<thinking>([\s\S]*?)<\/thinking>/);
  if (thinkingMatch) return thinkingMatch[1].trim();
  return null;
}

export function removeThinkingBlock(responseText) {
  return responseText.replace(/<thinking>[\s\S]*?<\/thinking>\n*/g, '').trim();
}

export default { buildThinkingContext, extractThinkingBlock, removeThinkingBlock };
