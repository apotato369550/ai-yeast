import readline from 'readline';
import chalk from 'chalk';
import apolloClient from '../ssh/apolloClient.js';
import { addEpisodic, getEpisodicSummary, loadEpisodicWithDecay } from '../memory/episodic.js';
import { getSemanticSummary } from '../memory/semantic.js';
import { loadSelfModel } from '../memory/selfModel.js';
import { getRAGStatus, retrieveDocuments } from '../rag/retrieval.js';
import ragIndex from '../rag/index.js';
import config from '../config.js';
import { formatThinkingForDisplay, truncateThinkingToBudget } from '../thinking/budgetManager.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const commands = {
  '/help': 'Show all commands',
  '/inspect': 'View memory stats',
  '/consolidate': 'Manual consolidation',
  '/audit': 'Check identity drift',
  '/thinking [on|off]': 'Toggle thinking mode',
  '/rag [on|off]': 'Toggle RAG retrieval',
  '/documents list': 'Show indexed documents',
  '/documents reload': 'Force re-index',
  '/exit': 'Exit REPL',
};

let thinkingEnabled = config.THINKING_ENABLED;
let ragEnabled = config.RAG_ENABLED;

async function handleCommand(input) {
  const parts = input.split(/\s+/);
  const cmd = parts[0];

  switch (cmd) {
    case '/help':
      console.log(chalk.cyan('\nAvailable commands:'));
      Object.entries(commands).forEach(([command, description]) => {
        console.log(`  ${chalk.cyan(command.padEnd(25))} - ${description}`);
      });
      console.log();
      break;

    case '/inspect': {
      const episodic = await getEpisodicSummary();
      const semantic = await getSemanticSummary();
      const selfModel = await loadSelfModel();
      const ragStatus = await getRAGStatus();

      console.log(chalk.cyan('\n╔═══════════════════════════════╗'));
      console.log(chalk.cyan('║      MEMORY STATUS            ║'));
      console.log(chalk.cyan('╚═══════════════════════════════╝'));
      console.log(`${chalk.yellow('Episodic')}: ${episodic.count} items (avg decay ${(episodic.avgDecay * 100).toFixed(0)}%)`);
      console.log(`${chalk.yellow('Semantic')}: ${semantic.count} facts (avg confidence ${(semantic.avgConfidence * 100).toFixed(0)}%)`);
      console.log(`\n${chalk.yellow('Self Model')}:`);
      console.log(`  Identity: ${selfModel.identity}`);
      console.log(`  Drives: ${selfModel.active_drives.length || 'none'}`);
      console.log(`  Constraints: ${selfModel.constraints.length || 'none'}`);
      console.log(`\n${chalk.yellow('RAG Status')}:`);
      console.log(`  Enabled: ${ragStatus.enabled ? chalk.green('yes') : chalk.red('no')}`);
      console.log(`  Documents indexed: ${ragStatus.documents_indexed}`);
      console.log();
      break;
    }

    case '/thinking': {
      const action = parts[1]?.toLowerCase();
      if (action === 'on') {
        thinkingEnabled = true;
        console.log(chalk.green('✓ Thinking enabled'));
      } else if (action === 'off') {
        thinkingEnabled = false;
        console.log(chalk.green('✓ Thinking disabled'));
      } else {
        console.log(`Thinking is currently ${chalk.yellow(thinkingEnabled ? 'ON' : 'OFF')}`);
      }
      break;
    }

    case '/rag': {
      const action = parts[1]?.toLowerCase();
      if (action === 'on') {
        ragEnabled = true;
        console.log(chalk.green('✓ RAG enabled'));
      } else if (action === 'off') {
        ragEnabled = false;
        console.log(chalk.green('✓ RAG disabled'));
      } else {
        console.log(`RAG is currently ${chalk.yellow(ragEnabled ? 'ON' : 'OFF')}`);
      }
      break;
    }

    case '/documents': {
      const action = parts[1]?.toLowerCase();
      if (action === 'reload') {
        console.log(chalk.blue('Reindexing documents...'));
        await ragIndex.indexFolder(config.RAG_DOCUMENTS_PATH);
      } else if (action === 'list') {
        const ragStatus = await getRAGStatus();
        console.log(`RAG Documents: ${chalk.yellow(ragStatus.documents_indexed)} indexed`);
      }
      break;
    }

    case '/exit':
      console.log(chalk.cyan('Goodbye!'));
      rl.close();
      process.exit(0);

    default:
      console.log(chalk.red(`✗ Unknown command: ${cmd}. Type /help for available commands.`));
  }
}

async function sendMessage(userInput) {
  // Display user message
  console.log(`\n${chalk.blue('👤 You:')}`);
  console.log(chalk.white(userInput));

  let ragDocs = [];
  if (ragEnabled) {
    try {
      ragDocs = await retrieveDocuments(userInput);
    } catch (error) {
      console.log(`${chalk.yellow('⚠')} RAG retrieval failed: ${error.message}`);
    }
  }

  console.log(`\n${chalk.cyan('🤖 yeast')}`);
  console.log(chalk.dim('(thinking...)\n'));

  // Fetch recent memories for context
  const episodicMemories = await loadEpisodicWithDecay();
  const recentMemories = episodicMemories.slice(-config.THINKING_MEMORY_DEPTH);

  const response = await apolloClient.sendCommand(
    'infer',
    userInput,
    thinkingEnabled,
    config.THINKING_BUDGET,
    ragDocs.map((d) => ({ id: d.id, content: d.filename, source: d.source })),
    {
      episodic: recentMemories.map(m => ({ id: m.id, content: m.content, timestamp: m.timestamp })),
      semantic: [] // TODO: Add semantic retrieval
    }
  );

  // Increment access counts for memories used
  if (recentMemories.length > 0) {
    await (await import('../memory/episodic.js')).incrementAccess(recentMemories.map(m => m.id));
  }

  if (!response.success) {
    console.log(`\n${chalk.red('✗ Error')}: ${response.error}`);
    if (response.recovery) {
      console.log(`  ${response.recovery}`);
    }
    return;
  }

  if (response.thinking) {
    const truncated = truncateThinkingToBudget(response.thinking);
    const tokenCount = response.thinking.split(/\s+/).length;

    console.log(chalk.dim('💭 Thinking (' + tokenCount + ' tokens):'));
    console.log(chalk.dim('─'.repeat(47)));
    console.log(chalk.dim(formatThinkingForDisplay(truncated.thinking)));
    console.log(chalk.dim('─'.repeat(47)));

    if (truncated.truncated) {
      console.log(chalk.dim('(thinking truncated at budget)\n'));
    } else {
      console.log();
    }
  }

  console.log(chalk.white(response.response));
  console.log();

  // Reading as Memory: Add user input with saliency
  await addEpisodic(`User: "${userInput}"`, 'observation', response.saliency || 0.5);

  // Also add the interaction itself
  await addEpisodic(`Conversation: User said "${userInput.substring(0, 50)}...", I replied "${response.response.substring(0, 50)}..."`, 'interaction', 0.85);

  if (response.memory_updates && !config.NO_PROPOSALS) {
    const updates = [];
    if (response.memory_updates.episodic_added > 0) {
      updates.push(chalk.green(`+${response.memory_updates.episodic_added} episodic`));
    }
    if (response.memory_updates.semantic_added > 0) {
      updates.push(chalk.green(`+${response.memory_updates.semantic_added} semantic`));
    }
    if (updates.length > 0) {
      console.log(`${chalk.cyan('📝 Memory:')}: ${updates.join(', ')}`);
      console.log();
    }
  }
}

export default async function startREPL() {
  // Bubbling artisanal yeast banner
  const banner = `
   ${chalk.yellow('╭──────────────────────────────────────────╮')}
   ${chalk.yellow('│')}  ${chalk.white.bold('🍞 AI YEAST')} ${chalk.dim('- Phase 5 Consolidation')}  ${chalk.yellow('│')}
   ${chalk.yellow('│')}    ${chalk.dim('the starter is bubbling...')}       ${chalk.yellow('│')}
   ${chalk.yellow('╰───┬──────────────────────────────────┬───╯')}
       ${chalk.yellow('│')}    ${chalk.white('○')}  ${chalk.white('°')}  ${chalk.white('◌')}  ${chalk.white('○')}  ${chalk.white('°')}  ${chalk.white('◌')}    ${chalk.yellow('│')}
       ${chalk.yellow('╰──────────────────────────────────────╯')}
  `;
  console.log(chalk.cyan(banner));

  console.log(chalk.cyan('yeast!') + ' v0.5.0 - Type ' + chalk.yellow('/help') + ' for commands');
  console.log(chalk.dim(`> [Thinking:${thinkingEnabled ? 'ON' : 'OFF'} RAG:${ragEnabled ? 'ON' : 'OFF'}]\n`));

  const askQuestion = () => {
    const prompt = chalk.cyan('> ');
    rl.question(prompt, async (input) => {
      if (!input.trim()) {
        askQuestion();
        return;
      }

      if (input.startsWith('/')) {
        await handleCommand(input);
        askQuestion();
        return;
      }

      try {
        await sendMessage(input);
      } catch (error) {
        console.error(`${chalk.red('Error')}: ${error.message}`);
      }

      askQuestion();
    });
  };

  askQuestion();
}
