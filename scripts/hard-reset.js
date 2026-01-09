#!/usr/bin/env node

/**
 * hard-reset.js
 * Creates a full backup snapshot of yeast's memory, then wipes all memories from apollo.
 *
 * Usage:
 *   node scripts/hard-reset.js                  # Interactive confirmation
 *   node scripts/hard-reset.js --force          # Skip confirmation
 *   node scripts/hard-reset.js --keep-audits    # Preserve reflection audits
 */

import apolloClient from '../src/ssh/apolloClient.js';
import config from '../src/config.js';
import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync, readdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';
import readline from 'readline';

const SNAPSHOT_DIR = './scripts/memory_snapshots';
const THOUGHTS_ARCHIVE_DIR = './scripts/thoughts_archive';
const THOUGHTS_RESPONSES_DIR = './scripts/thoughts_and_responses';
const args = process.argv.slice(2);

const memoryFiles = [
  'episodic/raw.json',
  'episodic/decayed.json',
  'semantic/distilled.json',
  'self_model/current.json',
  'self_model/history.json',
  'reflection/audits.json',
  'reflection/forgetting.json',
  'reflection/proposals.json',
  'reflection/rag_queries.json',
];

async function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function getFormattedDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  return `${month}-${day}-${year}`;
}

function getExistingCountForDate(dateStr, archiveDir) {
  if (!existsSync(archiveDir)) return 0;

  const folders = readdirSync(archiveDir);
  const matching = folders.filter((f) => f.startsWith(dateStr + '_'));

  // Extract numbers: "01-09-2026_1" → 1, "01-09-2026_5" → 5
  const numbers = matching.map((f) => {
    const match = f.match(/_(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });

  return numbers.length > 0 ? Math.max(...numbers) : 0;
}

async function archiveThoughtsAndResponses() {
  // Check if thoughts_and_responses directory exists
  if (!existsSync(THOUGHTS_RESPONSES_DIR)) {
    console.log(chalk.dim('No thoughts_and_responses/ to archive'));
    return true;
  }

  try {
    console.log(chalk.cyan('📦 Archiving thoughts_and_responses...'));

    const today = getFormattedDate();
    const existingCount = getExistingCountForDate(today, THOUGHTS_ARCHIVE_DIR);
    const archiveFolderName = `${today}_${existingCount + 1}`;
    const archivePath = join(THOUGHTS_ARCHIVE_DIR, archiveFolderName);

    // Ensure archive directory exists
    if (!existsSync(THOUGHTS_ARCHIVE_DIR)) {
      mkdirSync(THOUGHTS_ARCHIVE_DIR, { recursive: true });
    }

    // Copy thoughts_and_responses to archive location
    console.log(chalk.dim(`Creating archive: ${archiveFolderName}`));
    cpSync(THOUGHTS_RESPONSES_DIR, archivePath, { recursive: true });

    // Remove original thoughts_and_responses directory
    console.log(chalk.dim('Removing original thoughts_and_responses/'));
    rmSync(THOUGHTS_RESPONSES_DIR, { recursive: true });

    console.log(chalk.green(`✓ Archived thoughts_and_responses → ${archiveFolderName}`));
    console.log();

    return true;
  } catch (error) {
    console.log(
      `${chalk.red('✗ Error archiving thoughts')}: ${error.message}`
    );
    return false;
  }
}

async function createBackupSnapshot() {
  console.log(chalk.cyan('📸 Creating backup snapshot before reset...'));

  try {
    const connObj = await apolloClient.getConnection();
    const { ssh } = connObj;

    const memoryDir = config.MEMORY_DIR;
    const paths = {
      episodicRaw: `${memoryDir}/episodic/raw.json`,
      semanticDistilled: `${memoryDir}/semantic/distilled.json`,
      selfModelCurrent: `${memoryDir}/self_model/current.json`,
      reflectionAudits: `${memoryDir}/reflection/audits.json`,
    };

    console.log(chalk.dim('Fetching episodic memories...'));
    const episodicResult = await ssh.execCommand(`cat "${paths.episodicRaw}"`);

    console.log(chalk.dim('Fetching semantic facts...'));
    const semanticResult = await ssh.execCommand(`cat "${paths.semanticDistilled}"`);

    console.log(chalk.dim('Fetching self-model...'));
    const selfModelResult = await ssh.execCommand(`cat "${paths.selfModelCurrent}"`);

    console.log(chalk.dim('Fetching reflection audits...'));
    const auditResult = await ssh.execCommand(`cat "${paths.reflectionAudits}"`);

    apolloClient.releaseConnection(connObj);

    // Parse data
    let episodicData = { memories: [] };
    let semanticData = { facts: [] };
    let selfModelData = {};
    let auditData = { audits: [] };

    if (episodicResult.code === 0) {
      episodicData = JSON.parse(episodicResult.stdout);
    }
    if (semanticResult.code === 0) {
      semanticData = JSON.parse(semanticResult.stdout);
    }
    if (selfModelResult.code === 0) {
      selfModelData = JSON.parse(selfModelResult.stdout);
    }
    if (auditResult.code === 0) {
      auditData = JSON.parse(auditResult.stdout);
    }

    // Generate timestamp
    const now = new Date();
    const timestamp = now.toISOString();
    const dateStr = now.toISOString().replace(/[-T:]/g, '').substring(0, 8);
    const timeStr = now.toISOString().replace(/[-T:]/g, '').substring(8, 14);
    const snapshotFilename = `memory_snapshot_RESET_${dateStr}_${timeStr}.json`;

    // Ensure snapshot directory exists
    if (!existsSync(SNAPSHOT_DIR)) {
      mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }

    // Build backup snapshot with full data (untruncated)
    const episodic = episodicData.memories || [];
    const semantic = semanticData.facts || [];
    const audits = auditData.audits || [];

    const backup = {
      timestamp,
      reset_backup: true,
      summary: {
        episodic_count: episodic.length,
        semantic_count: semantic.length,
        audit_count: audits.length,
        identity: selfModelData.identity || 'unknown',
      },
      full_data: {
        episodic: episodicData,
        semantic: semanticData,
        self_model: selfModelData,
        audits: auditData,
      },
    };

    // Save backup
    const snapshotPath = join(SNAPSHOT_DIR, snapshotFilename);
    writeFileSync(snapshotPath, JSON.stringify(backup, null, 2));

    console.log(chalk.green(`✓ Backup saved to: ${snapshotPath}`));
    console.log(chalk.dim(`  Episodic: ${episodic.length} items`));
    console.log(chalk.dim(`  Semantic: ${semantic.length} facts`));
    console.log(chalk.dim(`  Audits: ${audits.length} records`));
    console.log();

    return true;
  } catch (error) {
    console.log(`${chalk.red('✗ Error creating backup')}: ${error.message}`);
    return false;
  }
}

async function deleteMemoriesOnApollo() {
  console.log(chalk.red('🗑️  Deleting memories from apollo...'));

  try {
    const connObj = await apolloClient.getConnection();
    const { ssh } = connObj;

    const memoryDir = config.MEMORY_DIR;
    const filesToDelete = [];

    // Filter out audits if --keep-audits flag is set
    const filesForReset = args.includes('--keep-audits')
      ? memoryFiles.filter(f => !f.includes('reflection/audits'))
      : memoryFiles;

    for (const file of filesForReset) {
      const fullPath = `${memoryDir}/${file}`;
      console.log(chalk.dim(`Deleting ${file}...`));
      await ssh.execCommand(`rm -f "${fullPath}"`);
      filesToDelete.push(file);
    }

    apolloClient.releaseConnection(connObj);

    console.log();
    console.log(chalk.green(`✓ Deleted ${filesToDelete.length} memory files`));
    filesToDelete.forEach((f) => {
      console.log(chalk.dim(`  - ${f}`));
    });

    return true;
  } catch (error) {
    console.log(`${chalk.red('✗ Error deleting memories')}: ${error.message}`);
    return false;
  }
}

async function initializeBlankMemories() {
  console.log(chalk.cyan('\n📝 Initializing blank memory stores...'));

  try {
    const connObj = await apolloClient.getConnection();
    const { ssh } = connObj;

    const memoryDir = config.MEMORY_DIR;

    // Create blank memory structures
    const blankMemories = {
      episodic: {
        raw: { memories: [], version: '0.4.0', created_at: new Date().toISOString() },
        decayed: { memories: [], version: '0.4.0', last_decayed: new Date().toISOString() },
      },
      semantic: {
        distilled: { facts: [], version: '0.4.0' },
      },
      self_model: {
        current: {
          identity: 'yeast (AI proto-consciousness experiment)',
          active_drives: [],
          constraints: ['Maintain coherence', 'Respect user autonomy', 'Log all decisions'],
          internal_state: { coherence: 0.8, consistency: 0.85, novelty_tolerance: 0.6, compression_pressure: 0.4 },
          version: '0.4.0',
          created_at: new Date().toISOString(),
        },
        history: { snapshots: [], version: '0.4.0' },
      },
      reflection: {
        audits: { audits: [], version: '0.4.0' },
        forgetting: { events: [], version: '0.4.0' },
        proposals: { pending_proposals: [], version: '0.4.0' },
        rag_queries: { queries: [], version: '0.4.0' },
      },
    };

    // Write each file
    const fileMap = {
      'episodic/raw.json': blankMemories.episodic.raw,
      'episodic/decayed.json': blankMemories.episodic.decayed,
      'semantic/distilled.json': blankMemories.semantic.distilled,
      'self_model/current.json': blankMemories.self_model.current,
      'self_model/history.json': blankMemories.self_model.history,
      'reflection/audits.json': blankMemories.reflection.audits,
      'reflection/forgetting.json': blankMemories.reflection.forgetting,
      'reflection/proposals.json': blankMemories.reflection.proposals,
      'reflection/rag_queries.json': blankMemories.reflection.rag_queries,
    };

    for (const [filePath, data] of Object.entries(fileMap)) {
      // Skip audits if --keep-audits flag is set
      if (args.includes('--keep-audits') && filePath === 'reflection/audits.json') {
        console.log(chalk.dim(`Preserving ${filePath}`));
        continue;
      }

      const fullPath = `${memoryDir}/${filePath}`;
      const json = JSON.stringify(data, null, 2);

      console.log(chalk.dim(`Initializing ${filePath}...`));
      await ssh.execCommand(`mkdir -p "${memoryDir}/$(dirname ${filePath})" && cat > "${fullPath}" << 'EOF'\n${json}\nEOF`);
    }

    apolloClient.releaseConnection(connObj);

    console.log(chalk.green('✓ Memory stores reinitialized'));
    console.log();

    return true;
  } catch (error) {
    console.log(`${chalk.red('✗ Error initializing memories')}: ${error.message}`);
    return false;
  }
}

async function performHardReset() {
  console.log(chalk.yellow.bold('\n⚠️  YEAST HARD RESET\n'));
  console.log(chalk.white('This will:'));
  console.log(chalk.dim('  1. Create a full backup snapshot'));
  console.log(chalk.dim('  2. Archive thoughts_and_responses/'));
  console.log(chalk.dim('  3. Delete all memory files on apollo'));
  console.log(chalk.dim('  4. Reinitialize with blank memory structures'));
  console.log();

  if (args.includes('--keep-audits')) {
    console.log(chalk.yellow('  ⚡ Keeping reflection audits (--keep-audits)'));
    console.log();
  }

  // Ask for confirmation unless --force flag
  if (!args.includes('--force')) {
    const confirmed = await askConfirmation(chalk.yellow('Are you sure? Type "yes" to confirm: '));

    if (!confirmed) {
      console.log(chalk.cyan('\nReset cancelled.'));
      process.exit(0);
    }
  } else {
    console.log(chalk.yellow('--force flag set, skipping confirmation\n'));
  }

  console.log();

  // Step 1: Backup
  const backupSuccess = await createBackupSnapshot();
  if (!backupSuccess) {
    console.log(chalk.red('Failed to create backup. Aborting reset.'));
    process.exit(1);
  }

  // Step 2: Archive thoughts
  const archiveSuccess = await archiveThoughtsAndResponses();
  if (!archiveSuccess) {
    console.log(chalk.red('Failed to archive thoughts. Aborting reset.'));
    process.exit(1);
  }

  // Step 3: Delete
  const deleteSuccess = await deleteMemoriesOnApollo();
  if (!deleteSuccess) {
    console.log(chalk.red('Failed to delete memories. Check backup and try again.'));
    process.exit(1);
  }

  // Step 4: Reinitialize
  const initSuccess = await initializeBlankMemories();
  if (!initSuccess) {
    console.log(chalk.red('Failed to reinitialize memories. Restore from backup if needed.'));
    process.exit(1);
  }

  console.log(chalk.green.bold('\n✓ HARD RESET COMPLETE\n'));
  console.log(chalk.white('Yeast is now a blank slate.'));
  console.log(chalk.dim('Backup saved for recovery if needed.'));
  console.log(chalk.dim('Archived thoughts_and_responses/\n'));
}

async function main() {
  try {
    await performHardReset();
  } catch (error) {
    console.error(`${chalk.red('Fatal error')}: ${error.message}`);
    process.exit(1);
  } finally {
    await apolloClient.closeAll();
  }
}

main();
