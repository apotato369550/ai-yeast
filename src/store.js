import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { createHash } from 'crypto';
import config from './config.js';

const writeQueues = {};

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getQueue(key) {
  if (!writeQueues[key]) {
    writeQueues[key] = { queue: [], writing: false };
  }
  return writeQueues[key];
}

async function processQueue(key) {
  const queue = getQueue(key);
  if (queue.writing || queue.queue.length === 0) return;

  queue.writing = true;
  const { filePath, data, resolve: resolvePromise } = queue.queue.shift();

  try {
    ensureDir(filePath);
    const tempPath = filePath + '.tmp';
    const jsonStr = JSON.stringify(data, null, 2);
    writeFileSync(tempPath, jsonStr, 'utf8');
    renameSync(tempPath, filePath);
    resolvePromise(true);
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    resolvePromise(false);
  } finally {
    queue.writing = false;
    processQueue(key);
  }
}

export function loadJSON(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

export async function saveJSON(filePath, data) {
  const key = filePath;
  const queue = getQueue(key);

  return new Promise((resolve) => {
    queue.queue.push({ filePath, data, resolve });
    processQueue(key);
  });
}

export function getChecksum(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

export function initializeMemoryDirs() {
  const baseDir = config.MEMORY_DIR;
  const dirs = [baseDir, baseDir + '/episodic', baseDir + '/semantic', baseDir + '/self_model', baseDir + '/reflection', baseDir + '/rag'];
  dirs.forEach((dir) => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });
  return baseDir;
}

export function getMemoryPaths() {
  const base = config.MEMORY_DIR;
  return {
    episodicRaw: base + '/episodic/raw.json',
    episodicDecayed: base + '/episodic/decayed.json',
    semanticDistilled: base + '/semantic/distilled.json',
    selfModelCurrent: base + '/self_model/current.json',
    selfModelHistory: base + '/self_model/history.json',
    reflectionAudits: base + '/reflection/audits.json',
    forgettingLog: base + '/reflection/forgetting.json',
    proposalsFile: base + '/reflection/proposals.json',
    ragQueries: base + '/reflection/rag_queries.json',
    ragDocuments: base + '/rag/documents.json',
    ragEmbeddings: base + '/rag/embeddings.json',
    dialogueLog: base + '/dialogue.json',
  };
}

export async function initializeMemoryStores() {
  initializeMemoryDirs();
  const paths = getMemoryPaths();

  const defaults = {
    [paths.episodicRaw]: { memories: [], version: '0.4.0', created_at: new Date().toISOString() },
    [paths.episodicDecayed]: { memories: [], version: '0.4.0', last_decayed: new Date().toISOString() },
    [paths.semanticDistilled]: { facts: [], version: '0.4.0' },
    [paths.selfModelCurrent]: {
      identity: 'yeast (AI proto-consciousness experiment)',
      active_drives: [],
      constraints: ['Maintain coherence', 'Respect user autonomy', 'Log all decisions'],
      internal_state: { coherence: 0.8, consistency: 0.85, novelty_tolerance: 0.6, compression_pressure: 0.4 },
      version: '0.4.0',
      created_at: new Date().toISOString(),
    },
    [paths.selfModelHistory]: { snapshots: [], version: '0.4.0' },
    [paths.reflectionAudits]: { audits: [], version: '0.4.0' },
    [paths.forgettingLog]: { events: [], version: '0.4.0' },
    [paths.proposalsFile]: { pending_proposals: [], version: '0.4.0' },
    [paths.ragQueries]: { queries: [], version: '0.4.0' },
    [paths.ragDocuments]: { documents: [], indexed_at: null, version: '0.4.0' },
    [paths.ragEmbeddings]: { documents: [], indexed_at: null, version: '0.4.0' },
    [paths.dialogueLog]: { interactions: [], version: '0.4.0' },
  };

  for (const [path, data] of Object.entries(defaults)) {
    if (!existsSync(path)) {
      await saveJSON(path, data);
    }
  }
}

export default { loadJSON, saveJSON, getChecksum, initializeMemoryDirs, getMemoryPaths, initializeMemoryStores };
