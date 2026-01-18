import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const defaults = {
  APOLLO_HOST: 'apollo.local',
  APOLLO_USER: 'jay',
  APOLLO_PORT: '22',
  SSH_PRIVATE_KEY_PATH: '~/.homelab_keys/id_rsa',
  SSH_TIMEOUT_MS: '120000',
  RAG_DOCUMENTS_PATH: '~/yeast-documents',
  RAG_TOP_K: '3',
  RAG_EMBEDDINGS_MODEL: 'nomic-embed-text',
  RAG_EMBEDDING_DIMS: '384',
  RAG_ENABLED: 'true',
  OLLAMA_TIMEOUT_MS: '10000',
  OLLAMA_API_URL: '', // Optional override for direct HTTP access
  EMBEDDING_VIA_SSH: 'true', // Default to true if remote host is remote
  THINKING_ENABLED: 'true',
  THINKING_BUDGET: '1500',
  THINKING_MEMORY_DEPTH: '5',
  THINKING_RAG_CONTEXT: 'true',
  THINKING_AUTO_TRUNCATE: 'true',
  THINKING_BLOCKS_PER_QUERY: '3',
  THINKING_MIN_DEPTH_TO_REALIZE: '2',
  THINKING_STRICT_TAGS: 'true',
  THINKING_MEMORY_ENABLED: 'true',
  THINKING_REALIZATION_SALIENCY_MULT: '0.9',
  NO_PROPOSALS: 'false',
  MISTRAL_TIMEOUT_MS: '120000',
  MEMORY_DECAY_HALF_LIFE_DAYS: '3',
  MEMORY_DIR: '~/yeast-data',
  OUTLINES_ENABLED: 'false',
  OUTLINES_API: 'http://apollo.local:6789/chat',
  LOG_LEVEL: 'info',
};

const config = {};
Object.keys(defaults).forEach((key) => {
  config[key] = process.env[key] || defaults[key];
});

const numericKeys = ['APOLLO_PORT', 'SSH_TIMEOUT_MS', 'RAG_TOP_K', 'RAG_EMBEDDING_DIMS', 'OLLAMA_TIMEOUT_MS', 'THINKING_BUDGET', 'THINKING_MEMORY_DEPTH', 'THINKING_BLOCKS_PER_QUERY', 'THINKING_MIN_DEPTH_TO_REALIZE', 'MISTRAL_TIMEOUT_MS', 'MEMORY_DECAY_HALF_LIFE_DAYS'];
numericKeys.forEach((key) => {
  config[key] = parseInt(config[key], 10);
});

const booleanKeys = ['RAG_ENABLED', 'THINKING_ENABLED', 'THINKING_RAG_CONTEXT', 'THINKING_AUTO_TRUNCATE', 'THINKING_STRICT_TAGS', 'THINKING_MEMORY_ENABLED', 'EMBEDDING_VIA_SSH', 'NO_PROPOSALS', 'OUTLINES_ENABLED'];
booleanKeys.forEach((key) => {
  config[key] = config[key] === 'true';
});

Object.keys(config).forEach((key) => {
  if (typeof config[key] === 'string' && config[key].startsWith('~/')) {
    config[key] = config[key].replace('~', process.env.HOME);
  }
});

export default config;
