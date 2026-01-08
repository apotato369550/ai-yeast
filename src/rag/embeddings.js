import axios from 'axios';
import config from '../config.js';

const OLLAMA_BASE_URL = `http://${config.APOLLO_HOST}:11434`;

export async function generateEmbedding(text) {
  if (!text) return null;

  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/embed`, {
      model: config.RAG_EMBEDDINGS_MODEL,
      input: text,
    }, { timeout: config.OLLAMA_TIMEOUT_MS });

    if (response.data && response.data.embedding) {
      return response.data.embedding;
    }
    throw new Error('No embedding in response');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to Ollama at ${OLLAMA_BASE_URL}`);
    }
    throw error;
  }
}

export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) throw new Error('Vectors must have same length');

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

export function findTopK(queryEmbedding, documents, k = 3, threshold = 0.5) {
  const scored = documents.map((doc) => ({
    ...doc,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  const filtered = scored.filter((doc) => doc.similarity > threshold);
  const sorted = filtered.sort((a, b) => b.similarity - a.similarity);
  return sorted.slice(0, k).map(({ embedding, ...doc }) => doc);
}

export default { generateEmbedding, cosineSimilarity, findTopK };
