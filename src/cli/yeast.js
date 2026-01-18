#!/usr/bin/env node

import { Command } from 'commander';
import { initializeMemoryStores } from '../store.js';
import config from '../config.js';
import startREPL from './repl.js';

const program = new Command();

program
  .version('0.5.0')
  .description('yeast - AI proto-consciousness with adaptive memory and fermentation')
  .usage('[options] [command]')
  .option('-p, --prompt <text>', 'Ask a question (headless mode)')
  .option('-i, --interactive', 'Force interactive mode')
  .option('--no-proposals', 'Disable memory/drive update suggestions');

// Default action: start interactive REPL mode when no subcommand is given
program.action(async (options) => {
  if (options.noProposals) {
    config.NO_PROPOSALS = true;
  }

  if (options.prompt) {
    const apolloClient = (await import('../ssh/apolloClient.js')).default;
    const { addEpisodic, loadEpisodicWithDecay, incrementAccess } = await import('../memory/episodic.js');
    await initializeMemoryStores();

    // Fetch recent memories for context
    const episodicMemories = await loadEpisodicWithDecay();
    const recentMemories = episodicMemories.slice(-config.THINKING_MEMORY_DEPTH);

    const response = await apolloClient.sendCommand(
      'infer',
      options.prompt,
      config.THINKING_ENABLED,
      config.THINKING_BUDGET,
      [],
      {
        episodic: recentMemories.map(m => ({ id: m.id, content: m.content, timestamp: m.timestamp })),
        semantic: []
      }
    );

    if (response.success) {
      if (response.thinking) {
        process.stdout.write(`\n[Thinking: ${response.thinking.split(/\s+/).length} tokens]\n`);
      }
      console.log(response.response);
      if (response.complexity_score !== undefined) {
        process.stdout.write(`[Complexity: ${response.complexity_score.toFixed(2)}]\n`);
      }

      // Reading as Memory (headless)
      await addEpisodic(`User (headless): "${options.prompt}"`, 'observation', response.saliency || 0.5);
      await addEpisodic(`Conversation (headless): I replied to "${options.prompt.substring(0, 30)}..."`, 'interaction', 0.85);

      // Increment access counts for memories used
      if (recentMemories.length > 0) {
        await incrementAccess(recentMemories.map(m => m.id));
      }
    } else {
      console.error(`Error: ${response.error}`);
      process.exit(1);
    }

    process.exit(0);
  } else if (options.interactive || process.argv.length === 2 || (process.argv.length === 3 && options.noProposals)) {
    // Interactive mode: triggered by --interactive flag or no arguments
    console.log('yeast v0.5.0 - Starting...\n');
    console.log('Initializing memory stores...');
    await initializeMemoryStores();
    console.log('Starting REPL...\n');
    await startREPL();
  }
});

program.parse(process.argv);
