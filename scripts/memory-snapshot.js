#!/usr/bin/env node

/**
 * memory-snapshot.js
 * Pulls memory snapshots from apollo and saves them locally with analysis.
 * Usage:
 *   node scripts/memory-snapshot.js                 # Full snapshot
 *   node scripts/memory-snapshot.js --last-audit    # Show last audit only
 *   node scripts/memory-snapshot.js --compare       # Diff from previous snapshot
 */

import apolloClient from '../src/ssh/apolloClient.js';
import config from '../src/config.js';
import chalk from 'chalk';
import { writeFileSync, existsSync, readdirSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SNAPSHOT_DIR = './scripts/memory_snapshots';
const args = process.argv.slice(2);

async function createSnapshot() {
  console.log(chalk.cyan('📸 Creating Memory Snapshot...'));

  try {
    const connObj = await apolloClient.getConnection();
    const { ssh } = connObj;

    // Prepare paths
    const memoryDir = config.MEMORY_DIR;
    const paths = {
      episodicRaw: `${memoryDir}/episodic/raw.json`,
      semanticDistilled: `${memoryDir}/semantic/distilled.json`,
      selfModelCurrent: `${memoryDir}/self_model/current.json`,
      reflectionAudits: `${memoryDir}/reflection/audits.json`,
    };

    // Fetch all files
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
    let episodicData = {};
    let semanticData = {};
    let selfModelData = {};
    let auditData = {};

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
    const snapshotFilename = `memory_snapshot_${dateStr}_${timeStr}.json`;

    // Ensure snapshot directory exists
    if (!existsSync(SNAPSHOT_DIR)) {
      mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }

    // Build snapshot object
    const episodic = episodicData.memories || [];
    const semantic = semanticData.facts || [];
    const audits = auditData.audits || [];

    // Calculate statistics
    const avgAccessCount = episodic.length > 0
      ? (episodic.reduce((sum, m) => sum + (m.access_count || 0), 0) / episodic.length).toFixed(2)
      : 0;

    const avgDecay = episodic.length > 0
      ? (episodic.reduce((sum, m) => sum + (m.decay || 0), 0) / episodic.length).toFixed(3)
      : 0;

    const snapshot = {
      timestamp,
      summary: {
        episodic_count: episodic.length,
        semantic_count: semantic.length,
        audit_count: audits.length,
        avg_access_count: parseFloat(avgAccessCount),
        avg_decay: parseFloat(avgDecay),
        identity: selfModelData.identity || 'unknown',
        active_drives: (selfModelData.active_drives || []).length,
        constraints: (selfModelData.constraints || []).length,
        internal_state: selfModelData.internal_state || {},
      },
      episodic: {
        count: episodic.length,
        memories: episodic.map(m => ({
          id: m.id,
          timestamp: m.timestamp,
          content: m.content.substring(0, 100),
          source: m.source,
          access_count: m.access_count || 0,
          decay: m.decay || 0,
        })),
      },
      semantic: {
        count: semantic.length,
        facts: semantic.map(f => ({
          id: f.id,
          content: f.content.substring(0, 100),
          confidence: f.confidence || 0,
          access_count: f.access_count || 0,
        })),
      },
      self_model: {
        identity: selfModelData.identity || 'unknown',
        active_drives: selfModelData.active_drives || [],
        constraints: selfModelData.constraints || [],
        internal_state: selfModelData.internal_state || {},
      },
      recent_audits: audits.slice(-5).map(a => ({
        timestamp: a.timestamp,
        input: a.input ? a.input.substring(0, 80) : '',
        output: a.output ? a.output.substring(0, 80) : '',
        approved: a.approved,
        gates: a.gates || {},
      })),
    };

    // Save snapshot
    const snapshotPath = join(SNAPSHOT_DIR, snapshotFilename);
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

    // Display summary
    console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║                    MEMORY SNAPSHOT SUMMARY                     ║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));
    console.log(`${chalk.yellow('Timestamp:')} ${timestamp}`);
    console.log(`${chalk.yellow('Saved to:')} ${snapshotPath}`);
    console.log();

    console.log(chalk.yellow('📚 Episodic Memory:'));
    console.log(`   Total: ${snapshot.summary.episodic_count} items`);
    console.log(`   Avg Access Count: ${snapshot.summary.avg_access_count}`);
    console.log(`   Avg Decay: ${snapshot.summary.avg_decay}`);

    console.log();
    console.log(chalk.yellow('💡 Semantic Memory:'));
    console.log(`   Total: ${snapshot.summary.semantic_count} facts`);

    console.log();
    console.log(chalk.yellow('👤 Self-Model:'));
    console.log(`   Identity: ${snapshot.self_model.identity}`);
    console.log(`   Active Drives: ${snapshot.self_model.active_drives.length}`);
    if (snapshot.self_model.active_drives.length > 0) {
      snapshot.self_model.active_drives.forEach((drive, i) => {
        console.log(`     [${i + 1}] ${drive}`);
      });
    }
    console.log(`   Constraints: ${snapshot.self_model.constraints.length}`);
    if (snapshot.self_model.constraints.length > 0) {
      snapshot.self_model.constraints.forEach((constraint, i) => {
        console.log(`     [${i + 1}] ${constraint}`);
      });
    }

    console.log();
    console.log(chalk.yellow('🧠 Internal State:'));
    Object.entries(snapshot.self_model.internal_state).forEach(([key, value]) => {
      const percentage = (value * 100).toFixed(0);
      console.log(`   ${key}: ${percentage}%`);
    });

    console.log();
    console.log(chalk.yellow('🔍 Recent Audits:'));
    if (snapshot.recent_audits.length === 0) {
      console.log('   (none yet)');
    } else {
      snapshot.recent_audits.forEach((audit, idx) => {
        const status = audit.approved ? chalk.green('✓') : chalk.red('✗');
        console.log(`   [${idx + 1}] ${status} ${audit.timestamp.substring(0, 19)}`);
      });
    }

    console.log();

    // Handle --last-audit flag
    if (args.includes('--last-audit') && audits.length > 0) {
      const lastAudit = audits[audits.length - 1];
      console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan('║                        LAST AUDIT                             ║'));
      console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));
      console.log(`${chalk.yellow('Timestamp:')} ${lastAudit.timestamp}`);
      console.log(`${chalk.yellow('Input:')} ${lastAudit.input || '(none)'}`);
      console.log(`${chalk.yellow('Output:')} ${lastAudit.output || '(none)'}`);

      if (lastAudit.gates) {
        console.log(`${chalk.yellow('Gates:')}`);
        Object.entries(lastAudit.gates).forEach(([gate, result]) => {
          const status = result.passed ? chalk.green('✓') : chalk.red('✗');
          const score = result.score !== undefined ? ` (${(result.score * 100).toFixed(0)}%)` : '';
          console.log(`   ${gate}: ${status}${score}`);
        });
      }

      console.log(`${chalk.yellow('Approved:')} ${lastAudit.approved ? chalk.green('yes') : chalk.red('no')}`);
      console.log();
    }

    // Handle --compare flag
    if (args.includes('--compare')) {
      console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan('║                    COMPARING WITH PREVIOUS                    ║'));
      console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));

      // Find previous snapshot
      const allSnapshots = readdirSync(SNAPSHOT_DIR)
        .filter(f => f.startsWith('memory_snapshot_') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (allSnapshots.length < 2) {
        console.log(chalk.yellow('No previous snapshot found'));
      } else {
        const prevFile = allSnapshots[1];
        const prevPath = join(SNAPSHOT_DIR, prevFile);
        const prevData = JSON.parse(readFileSync(prevPath, 'utf8'));

        const episodicDiff = snapshot.summary.episodic_count - prevData.summary.episodic_count;
        const semanticDiff = snapshot.summary.semantic_count - prevData.summary.semantic_count;
        const auditDiff = snapshot.summary.audit_count - prevData.summary.audit_count;

        const episodicSign = episodicDiff >= 0 ? '+' : '';
        const semanticSign = semanticDiff >= 0 ? '+' : '';
        const auditSign = auditDiff >= 0 ? '+' : '';

        console.log(`${chalk.yellow('Previous:')} ${prevFile}`);
        console.log();

        console.log(chalk.yellow('Changes:'));
        console.log(`   Episodic: ${prevData.summary.episodic_count} → ${snapshot.summary.episodic_count} (${episodicSign}${episodicDiff})`);
        console.log(`   Semantic: ${prevData.summary.semantic_count} → ${snapshot.summary.semantic_count} (${semanticSign}${semanticDiff})`);
        console.log(`   Audits: ${prevData.summary.audit_count} → ${snapshot.summary.audit_count} (${auditSign}${auditDiff})`);
        console.log();

        // Compare decay
        const decayDiff = (snapshot.summary.avg_decay - prevData.summary.avg_decay).toFixed(3);
        const decaySign = decayDiff >= 0 ? '+' : '';
        console.log(`   Avg Decay: ${prevData.summary.avg_decay} → ${snapshot.summary.avg_decay} (${decaySign}${decayDiff})`);
        console.log();
      }
    }

  } catch (error) {
    console.log(`${chalk.red('✗ Error')}: ${error.message}`);
    process.exit(1);
  } finally {
    await apolloClient.closeAll();
  }
}

createSnapshot();
