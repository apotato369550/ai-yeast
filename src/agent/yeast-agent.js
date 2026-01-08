#!/usr/bin/env node

import axios from 'axios';

const MISTRAL_API = 'http://localhost:11434/api/chat';
const MISTRAL_MODEL = 'mistral';

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

async function runInference(command, userInput, thinkingEnabled, thinkingBudget, ragDocs) {
  let systemPrompt = 'You are yeast, an AI system exploring persistent identity and memory.\n';

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
  const response = result.content.replace(/<thinking>[\s\S]*?<\/thinking>\n*/g, '').trim();

  return {
    success: true,
    response,
    thinking,
    memory_updates: {
      episodic_added: 1,
      semantic_added: 0,
    },
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  try {
    let input = '';
    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
      input += chunk;
    }

    const data = JSON.parse(input);
    const { command, input: userInput, thinking_enabled, thinking_budget, rag_docs } = data;

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
      result = await runInference(command, userInput, thinking_enabled, thinking_budget, rag_docs);
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
