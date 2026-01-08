import { readFileSync } from 'fs';
import { extname } from 'path';
import pdfParse from 'pdf-parse';
import matter from 'gray-matter';
import { createHash } from 'crypto';

export async function extractFromPDF(filePath) {
  try {
    const buffer = readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error(`Error parsing PDF ${filePath}:`, error.message);
    return null;
  }
}

export function extractFromMarkdown(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const { data, content: text } = matter(content);
    return text;
  } catch (error) {
    console.error(`Error parsing Markdown ${filePath}:`, error.message);
    return null;
  }
}

export function extractFromText(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading text file ${filePath}:`, error.message);
    return null;
  }
}

export async function extractText(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.pdf') return extractFromPDF(filePath);
  if (ext === '.md' || ext === '.markdown') return extractFromMarkdown(filePath);
  if (ext === '.txt') return extractFromText(filePath);
  console.warn(`Unsupported file type: ${ext}`);
  return null;
}

export function hashFileContent(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function createDocumentMetadata(filePath, text) {
  return {
    hash: hashFileContent(text),
    size_bytes: Buffer.byteLength(text, 'utf8'),
    chunk_count: 1,
    last_indexed: new Date().toISOString(),
  };
}

export default { extractText, extractFromPDF, extractFromMarkdown, extractFromText, hashFileContent, createDocumentMetadata };
