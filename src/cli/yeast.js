#!/usr/bin/env node

import { Command } from 'commander';
import { initializeMemoryStores } from '../store.js';
import config from '../config.js';
import startREPL from './repl.js';

const program = new Command();

program
  .version('0.4.0')
  .description('yeast - AI proto-consciousness with RAG, thinking, and memory')
  .usage('[options] [command]')
  .option('-p, --prompt <text>', 'Ask a question (headless mode)')
  .option('-i, --interactive', 'Force interactive mode');

// Default action: start interactive REPL mode when no subcommand is given
program.action(async (options) => {
  if (options.prompt) {
    const apolloClient = (await import('../ssh/apolloClient.js')).default;
    await initializeMemoryStores();

    console.log(`> ${options.prompt}\n`);

    const response = await apolloClient.sendCommand('infer', options.prompt);

    if (response.success) {
      console.log(response.response);
      if (response.thinking) {
        console.log(`\n[Thinking: ${response.thinking.substring(0, 100)}...]`);
      }
    } else {
      console.error(`Error: ${response.error}`);
      process.exit(1);
    }

    process.exit(0);
  } else if (options.interactive || process.argv.length === 2) {
    // Interactive mode: triggered by --interactive flag or no arguments
    console.log('yeast v0.4.0 - Starting...\n');
    console.log('Initializing memory stores...');
    await initializeMemoryStores();
    console.log('Starting REPL...\n');
    await startREPL();
  }
});

program.parse(process.argv);
