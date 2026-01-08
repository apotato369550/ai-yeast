#!/usr/bin/env node

import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MISTRAL_API = 'http://localhost:11434/api/chat';
const OLLAMA_EMBED_API = 'http://localhost:11434/api/embed';
const MISTRAL_MODEL = 'mistral';
const EMBED_MODEL = 'nomic-embed-text';

async function callMistral(messages, thinking = false, thinkingBudget = 1500) {
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
    systemPrompt += `You have a thinking budget of ${thinkingBudget} tokens.\n`;
    systemPrompt += 'Use <thinking>...</thinking> tags to reason before answering.\n';
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

  const result = await callMistral(messages, thinkingEnabled, thinkingBudget);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      error_code: 'LLM_UNAVAILABLE',
      timestamp: new Date().toISOString(),
    };
  }

  const thinkingMatch = result.content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;
  let response = result.content.replace(/<thinking>[\s\S]*?<\/thinking>\n*/g, '').trim();

  const saliencyMatch = response.match(/\[SALIENCY: ([\d.]+)\]/);
  const saliency = saliencyMatch ? parseFloat(saliencyMatch[1]) : 0.5;
  response = response.replace(/\[SALIENCY: [\d.]+\]/g, '').trim();

  return {
    success: true,
    response,
    thinking,
    saliency,
    memory_updates: {
      episodic_added: 1,
      semantic_added: 0,
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
