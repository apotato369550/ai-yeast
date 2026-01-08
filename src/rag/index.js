import { readdirSync, statSync, watch } from 'fs';
import { join, basename } from 'path';
import { loadJSON, saveJSON, getMemoryPaths } from '../store.js';
import { extractText, createDocumentMetadata } from './ingestion.js';
import { generateEmbedding } from './embeddings.js';
import { randomUUID } from 'crypto';
import config from '../config.js';

class RAGIndex {
  constructor() {
    this.watchers = [];
    this.indexing = false;
  }

  async indexFolder(folderPath) {
    if (this.indexing) {
      console.log('Indexing already in progress');
      return false;
    }

    this.indexing = true;
    console.log(`Indexing documents from ${folderPath}...`);

    try {
      const documents = [];
      const embeddingsList = [];
      const files = this.findSupportedFiles(folderPath);

      for (const filePath of files) {
        try {
          const text = await extractText(filePath);
          if (!text || text.length === 0) {
            console.warn(`Skipped ${basename(filePath)}: no text extracted`);
            continue;
          }

          const embedding = await generateEmbedding(text);
          if (!embedding) {
            console.warn(`Skipped ${basename(filePath)}: embedding generation failed`);
            continue;
          }

          const docId = randomUUID().slice(0, 8);
          const metadata = createDocumentMetadata(filePath, text);

          documents.push({
            id: docId,
            filename: basename(filePath),
            filepath: filePath,
            source: filePath,
            timestamp: new Date().toISOString(),
            metadata,
          });

          embeddingsList.push({
            id: docId,
            filename: basename(filePath),
            source: filePath,
            timestamp: new Date().toISOString(),
            embedding,
            metadata,
          });

          console.log(`✓ Indexed ${basename(filePath)}`);
        } catch (error) {
          console.error(`✗ Failed to index ${basename(filePath)}: ${error.message}`);
        }
      }

      const paths = getMemoryPaths();
      await saveJSON(paths.ragDocuments, {
        documents,
        indexed_at: new Date().toISOString(),
        version: '0.4.0',
      });

      await saveJSON(paths.ragEmbeddings, {
        documents: embeddingsList,
        indexed_at: new Date().toISOString(),
        version: '0.4.0',
      });

      console.log(`✓ Indexed ${documents.length} documents`);
      return true;
    } catch (error) {
      console.error('Indexing error:', error.message);
      return false;
    } finally {
      this.indexing = false;
    }
  }

  findSupportedFiles(folderPath) {
    const files = [];
    const supportedExts = ['.pdf', '.md', '.markdown', '.txt'];

    try {
      const entries = readdirSync(folderPath);
      for (const entry of entries) {
        const filePath = join(folderPath, entry);
        const stat = statSync(filePath);

        if (stat.isFile()) {
          const ext = entry.substring(entry.lastIndexOf('.')).toLowerCase();
          if (supportedExts.includes(ext)) {
            files.push(filePath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading folder ${folderPath}:`, error.message);
    }

    return files;
  }

  startWatcher(folderPath) {
    try {
      const watcher = watch(folderPath, async (eventType, filename) => {
        if (eventType === 'change' || eventType === 'rename') {
          console.log(`Detected file change: ${filename}`);
          await this.indexFolder(folderPath);
        }
      });

      this.watchers.push(watcher);
      console.log(`Started watching ${folderPath}`);
    } catch (error) {
      console.error(`Failed to start watcher: ${error.message}`);
    }
  }

  stopWatchers() {
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        console.error('Error closing watcher:', error);
      }
    }
    this.watchers = [];
  }
}

export default new RAGIndex();
