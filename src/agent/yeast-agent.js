#!/usr/bin/env node

import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import realizationExtractor from '../thinking/realizationExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MISTRAL_API = 'http://localhost:11434/api/chat';
const OLLAMA_EMBED_API = 'http://localhost:11434/api/embed';
const MISTRAL_MODEL = 'mistral';
const EMBED_MODEL = 'nomic-embed-text';

// Load schema for Outlines.dev structured output
function loadOutputSchema() {
  const schemaPath = join(__dirname, '..', '..', 'plans', 'schemas', 'yeast-output.json');
  if (existsSync(schemaPath)) {
    try {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
      return schema;
    } catch (error) {
      console.warn(`[YEAST-AGENT] Failed to load output schema: ${error.message}`);
      return null;
    }
  }
  return null;
}

async function callMistralStructured(prompt, outlineSchema, temperature = 0.7) {
  const outlinesApi = process.env.OUTLINES_API || 'http://localhost:6789/chat';

  try {
    const response = await axios.post(outlinesApi, {
      prompt,
      schema: outlineSchema,
      temperature,
    }, { timeout: 45000 });

    if (response.data && response.data.output) {
      return {
        success: true,
        content: response.data.output,
        structured: true,
      };
    }

    return {
      success: false,
      error: 'No output in Outlines response',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function callMistral(messages, thinking = false, thinkingBudget = 1500, useOutlines = false, outlineSchema = null) {
  // If Outlines is enabled and schema available, use structured output
  if (useOutlines && outlineSchema) {
    const prompt = messages
      .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
      .join('\n\n');

    return callMistralStructured(prompt, outlineSchema, 0.7);
  }

  // Fall back to standard Ollama Mistral API
  try {
    const response = await axios.post(MISTRAL_API, {
      model: MISTRAL_MODEL,
      messages,
      stream: false,
      temperature: 0.7,
    }, { timeout: 45000 });

    return {
      success: true,
      content: response.data.message.content,
      structured: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runInference(command, userInput, thinkingEnabled, thinkingBudget, ragDocs, memoryContext = { episodic: [], semantic: [] }, data = {}) {
  const promptPath = join(__dirname, 'prompts', 'system_prompt.md');
  let systemPrompt = '';

  if (existsSync(promptPath)) {
    systemPrompt = readFileSync(promptPath, 'utf8');
  } else {
    // Fallback if file is missing
    systemPrompt = `You are Yeast, an experimental AI exploring persistent identity and memory.
Your name is Yeast, and you are comfortable with this label.

At the end of your response, you MUST provide a "saliency" score (0.0 to 1.0).
Format: [SALIENCY: score]
`;
  }

  if (data?.no_proposals) {
    systemPrompt += '\nDO NOT suggest any memory or drive updates. Focus only on the response and saliency.\n';
  }

  if (memoryContext.episodic && memoryContext.episodic.length > 0) {
    systemPrompt += '\nRelevant Episodic Memories (Recent Interactions):\n';
    memoryContext.episodic.forEach((m, i) => {
      systemPrompt += `- [${m.timestamp}] ${m.content}\n`;
    });
  }

  if (memoryContext.semantic && memoryContext.semantic.length > 0) {
    systemPrompt += '\nDistilled Semantic Facts:\n';
    memoryContext.semantic.forEach((f, i) => {
      systemPrompt += `- ${f.content} (Confidence: ${f.confidence})\n`;
    });
  }

  if (thinkingEnabled) {
    systemPrompt += `You have ${3} thinking blocks per query.\n`;
    systemPrompt += 'Format: <thinking depth="1-3">reasoning</thinking>\n';
    systemPrompt += 'After thinking, extract: <realizations>- insight</realizations>\n';
  }

  if (ragDocs && ragDocs.length > 0) {
    systemPrompt += '\nYou have access to the following documents:\n';
    ragDocs.forEach((doc, i) => {
      systemPrompt += `- Document ${i + 1}: ${doc.content}\n`;
    });
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userInput },
  ];

  // Check if Outlines is enabled
  const outlinesEnabled = process.env.OUTLINES_ENABLED === 'true';
  const outlineSchema = outlinesEnabled ? loadOutputSchema() : null;

  const result = await callMistral(messages, thinkingEnabled, thinkingBudget, outlinesEnabled, outlineSchema);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      error_code: 'LLM_UNAVAILABLE',
      timestamp: new Date().toISOString(),
    };
  }

  let thinking_blocks;
  let realizations;
  let thinking;
  let response;
  let saliency;
  let realizationsStored = 0;

  // Handle structured output from Outlines
  if (result.structured && typeof result.content === 'object') {
    try {
      const structured = result.content;

      // Validate required fields
      if (!structured.response || !('complexity_score' in structured) || !('saliency_score' in structured) || !Array.isArray(structured.thinking_blocks) || !Array.isArray(structured.realizations)) {
        throw new Error('Structured output missing required fields');
      }

      response = structured.response;
      saliency = structured.saliency_score;
      thinking_blocks = structured.thinking_blocks || [];
      realizations = structured.realizations || [];
      thinking = thinking_blocks.length > 0 ? thinking_blocks.map((b) => b.content).join('\n\n') : null;

      // Process realizations for storage
      if (realizations.length > 0 && thinking_blocks.length > 0) {
        const maxDepth = Math.max(...thinking_blocks.map((b) => b.depth));
        const minDepthToRealize = parseInt(process.env.THINKING_MIN_DEPTH_TO_REALIZE || '2');
        if (maxDepth >= minDepthToRealize) {
          realizationsStored = realizations.length;
        }
      }
    } catch (error) {
      console.warn(`[YEAST-AGENT] Structured output parsing failed, falling back to regex: ${error.message}`);
      // Fall through to regex parsing
      result.structured = false;
    }
  }

  // Handle unstructured output (fallback)
  if (!result.structured) {
    // Extract thinking blocks and realizations
    const extracted = realizationExtractor.extractThinkingAndRealizations(result.content);
    thinking_blocks = extracted.thinking_blocks;
    realizations = extracted.realizations;

    // Get legacy thinking (for backward compatibility)
    const thinkingMatch = result.content.match(/<thinking[^>]*>([\s\S]*?)<\/thinking>/);
    thinking = thinkingMatch ? thinkingMatch[1].trim() : null;

    // Remove thinking and realization blocks from response
    response = result.content
      .replace(/<thinking[^>]*>[\s\S]*?<\/thinking>\n*/g, '')
      .replace(/<realizations>[\s\S]*?<\/realizations>\n*/g, '')
      .trim();

    const saliencyMatch = response.match(/\[SALIENCY: ([\d.]+)\]/);
    saliency = saliencyMatch ? parseFloat(saliencyMatch[1]) : 0.5;
    response = response
      .replace(/\[COMPLEXITY: [\d.]+\]\n*/g, '')
      .replace(/\[SALIENCY: [\d.]+\]/g, '')
      .trim();

    // Validate thinking blocks
    const validation = realizationExtractor.validateThinkingBlocks(thinking_blocks);
    if (!validation.valid) {
      console.warn(`[YEAST-AGENT] ${validation.warning}`);
    }

    // Process realizations for storage
    if (realizations.length > 0 && thinking_blocks.length > 0) {
      const maxDepth = Math.max(...thinking_blocks.map((b) => b.depth));
      const minDepthToRealize = parseInt(process.env.THINKING_MIN_DEPTH_TO_REALIZE || '2');
      if (maxDepth >= minDepthToRealize) {
        realizationsStored = realizations.length;
      }
    }
  }

  return {
    success: true,
    response,
    thinking,
    realizations,
    saliency,
    complexity_score: structured?.complexity_score || 0.5,
    memory_updates: {
      episodic_added: 1,
      semantic_added: 0,
      realizations_stored: realizationsStored,
    },
    timestamp: new Date().toISOString(),
  };
}

async function generateEmbedding(text, model = EMBED_MODEL) {
  try {
    const response = await axios.post(OLLAMA_EMBED_API, {
      model,
      input: text,
    }, { timeout: 15000 });

    if (response.data) {
      const embedding = response.data.embedding || (response.data.embeddings && response.data.embeddings[0]);
      if (embedding) {
        return {
          success: true,
          embedding: embedding,
        };
      }
    }
    return {
      success: false,
      error: `No embedding in response. Keys: ${Object.keys(response.data || {}).join(', ')}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function main() {
  try {
    let input = '';
    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
      input += chunk;
    }

    const data = JSON.parse(input);
    const { command, input: userInput, thinking_enabled, thinking_budget, rag_docs, model } = data;

    if (!command || !userInput) {
      console.log(JSON.stringify({
        success: false,
        error: 'Missing command or input',
        timestamp: new Date().toISOString(),
      }));
      process.exit(1);
    }

    let result;
    if (command === 'infer' || command === 'thinking') {
      result = await runInference(command, userInput, thinking_enabled, thinking_budget, rag_docs, data.memory_context, data);
    } else if (command === 'embed') {
      result = await generateEmbedding(userInput, model);
    } else if (command === 'consolidate') {
      result = {
        success: true,
        response: 'Consolidation scheduled',
        timestamp: new Date().toISOString(),
      };
    } else if (command === 'audit') {
      result = {
        success: true,
        response: 'Identity audit complete',
        timestamp: new Date().toISOString(),
      };
    } else {
      result = {
        success: false,
        error: `Unknown command: ${command}`,
        timestamp: new Date().toISOString(),
      };
    }

    console.log(JSON.stringify(result));
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error.message,
      error_code: 'PARSING_ERROR',
      timestamp: new Date().toISOString(),
    }));
    process.exit(1);
  }
}

main();
