#!/usr/bin/env node

/**
 * initialize.js
 * Feeds initialization prompts through the fermenter to warm up Yeast's memory.
 *
 * Usage:
 *   node scripts/initialize.js                    # Run standard initialization
 *   npm run initialize                            # (if added to package.json)
 */

import chalk from 'chalk';
import { execSync } from 'child_process';

function main() {
  console.log(chalk.cyan('\n🌱 Yeast Initialization Sequence'));
  console.log(chalk.dim('Running initialization starch through fermenter...\n'));

  try {
    // Run fermenter on initialization.md prompts
    execSync('node scripts/fermenter.js scripts/prompts/initialization.md', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log(chalk.cyan('\n✓ Initialization complete'));
    console.log(chalk.dim('Yeast has absorbed its foundational identity and constraints.'));
    console.log(chalk.dim('Check output: ls -la scripts/thoughts_and_responses/\n'));
  } catch (error) {
    console.error(chalk.red(`\n✗ Initialization failed: ${error.message}`));
    process.exit(1);
  }
}

main();
