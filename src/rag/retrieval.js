import { loadJSON, saveJSON, getMemoryPaths } from '../store.js';
import { generateEmbedding, findTopK } from './embeddings.js';
import config from '../config.js';

export async function retrieveDocuments(query, topK = config.RAG_TOP_K) {
  if (!config.RAG_ENABLED) return [];

  try {
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) return [];

    const paths = getMemoryPaths();
    const embeddingData = loadJSON(paths.ragEmbeddings);
    if (!embeddingData || !Array.isArray(embeddingData.documents)) return [];

    const topDocs = findTopK(queryEmbedding, embeddingData.documents, topK, 0.5);
    await logQuery(query, topDocs);
    return topDocs;
  } catch (error) {
    console.error('RAG retrieval error:', error.message);
    return [];
  }
}

export async function logQuery(query, results) {
  try {
    const paths = getMemoryPaths();
    const queryLog = loadJSON(paths.ragQueries) || { queries: [] };

    queryLog.queries.push({
      timestamp: new Date().toISOString(),
      query,
      results_count: results.length,
      results: results.map((r) => ({ id: r.id, filename: r.filename, similarity: r.similarity })),
    });

    if (queryLog.queries.length > 100) queryLog.queries.shift();
    await saveJSON(paths.ragQueries, queryLog);
  } catch (error) {
    console.error('Error logging RAG query:', error);
  }
}

export async function getRAGStatus() {
  try {
    const paths = getMemoryPaths();
    const embeddingData = loadJSON(paths.ragEmbeddings);
    const docCount = embeddingData?.documents?.length || 0;

    return {
      enabled: config.RAG_ENABLED,
      documents_indexed: docCount,
      embedding_model: config.RAG_EMBEDDINGS_MODEL,
      embedding_dims: config.RAG_EMBEDDING_DIMS,
      top_k: config.RAG_TOP_K,
    };
  } catch (error) {
    return { enabled: false, error: error.message };
  }
}

export default { retrieveDocuments, logQuery, getRAGStatus };
