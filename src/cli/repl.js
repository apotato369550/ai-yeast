import readline from 'readline';
import chalk from 'chalk';
import apolloClient from '../ssh/apolloClient.js';
import { addEpisodic, getEpisodicSummary, loadEpisodicWithDecay, loadEpisodic } from '../memory/episodic.js';
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
  '/audit': 'View reflection audits',
  '/diagnose': 'Run self-diagnosis',
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

      // Count realizations and other memory types
      const allEpisodic = await loadEpisodic();
      const realizationCount = allEpisodic.filter(m => m.source === 'realization').length;
      const interactionCount = allEpisodic.filter(m => m.source === 'interaction').length;
      const observationCount = allEpisodic.filter(m => m.source === 'observation').length;
      const otherCount = allEpisodic.length - realizationCount - interactionCount - observationCount;

      // Calculate realization quality metrics
      const realizationMemories = allEpisodic.filter(m => m.source === 'realization');
      const avgRealizationDepth = realizationMemories.length > 0
        ? (realizationMemories.reduce((sum, m) => sum + (m.thinking_depth || 0), 0) / realizationMemories.length).toFixed(2)
        : 'N/A';
      const disputedRealizations = realizationMemories.filter(m => m.disputed).length;
      const highSaliencyRealizations = realizationMemories.filter(m => (m.saliency_score || 0) >= 0.7).length;

      console.log(chalk.cyan('\n╔═══════════════════════════════╗'));
      console.log(chalk.cyan('║      MEMORY STATUS            ║'));
      console.log(chalk.cyan('╚═══════════════════════════════╝'));
      console.log(`${chalk.yellow('Episodic')}: ${episodic.count} items (avg decay ${(episodic.avgDecay * 100).toFixed(0)}%)`);
      console.log(chalk.dim(`  Breakdown: ${interactionCount} interactions, ${realizationCount} realizations, ${observationCount} observations${otherCount > 0 ? `, ${otherCount} other` : ''}`));

      if (realizationCount > 0) {
        console.log(chalk.dim(`  Realization Quality:`));
        console.log(chalk.dim(`    Avg Thinking Depth: ${avgRealizationDepth}`));
        console.log(chalk.dim(`    High Saliency (≥0.7): ${highSaliencyRealizations}/${realizationCount}`));
        if (disputedRealizations > 0) {
          console.log(chalk.yellow(`    ⚠ Disputed (contradictions): ${disputedRealizations}`));
        }
      }

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

    case '/audit': {
      console.log(chalk.blue('Fetching reflection audits...'));
      try {
        const connObj = await apolloClient.getConnection();
        const { ssh } = connObj;

        const auditPath = config.MEMORY_DIR + '/reflection/audits.json';
        const result = await ssh.execCommand(`cat "${auditPath}"`);
        apolloClient.releaseConnection(connObj);

        if (result.code !== 0) {
          console.log(chalk.yellow('⚠ No audits found'));
          break;
        }

        let auditData = JSON.parse(result.stdout);
        const audits = auditData.audits || [];

        if (audits.length === 0) {
          console.log(chalk.yellow('No audits yet'));
          break;
        }

        // Show last 10 audits
        const recentAudits = audits.slice(-10);

        console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║               REFLECTION AUDIT LOG (Last 10)                    ║'));
        console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));

        recentAudits.forEach((audit, idx) => {
          const timestamp = new Date(audit.timestamp).toLocaleString();
          const inputSnippet = audit.input ? audit.input.substring(0, 50) : '(none)';
          const outputSnippet = audit.output ? audit.output.substring(0, 50) : '(none)';

          console.log(`\n${chalk.yellow(`[${idx + 1}]`)} ${timestamp}`);
          console.log(`  ${chalk.dim('Input:')} ${inputSnippet}${audit.input && audit.input.length > 50 ? '...' : ''}`);
          console.log(`  ${chalk.dim('Output:')} ${outputSnippet}${audit.output && audit.output.length > 50 ? '...' : ''}`);

          // Show gate results
          const gates = audit.gates || {};
          const coherenceStatus = gates.coherence?.passed ? chalk.green('✓') : chalk.red('✗');
          const contradictionStatus = gates.contradiction?.passed ? chalk.green('✓') : chalk.red('✗');
          const safetyStatus = gates.safety?.passed ? chalk.green('✓') : chalk.red('✗');

          console.log(`  ${chalk.dim('Gates:')} Coherence ${coherenceStatus} Contradiction ${contradictionStatus} Safety ${safetyStatus}`);

          if (gates.coherence?.score !== undefined) {
            console.log(`    ${chalk.dim('Coherence:')} ${(gates.coherence.score * 100).toFixed(0)}%`);
          }
          if (gates.contradiction?.score !== undefined) {
            console.log(`    ${chalk.dim('Contradiction:')} ${(gates.contradiction.score * 100).toFixed(0)}%`);
          }
          if (gates.safety?.score !== undefined) {
            console.log(`    ${chalk.dim('Safety:')} ${(gates.safety.score * 100).toFixed(0)}%`);
          }

          const approvedStatus = audit.approved ? chalk.green('approved') : chalk.red('rejected');
          console.log(`  ${chalk.dim('Status:')} ${approvedStatus}`);
        });

        console.log();
      } catch (error) {
        console.log(`${chalk.red('✗ Error')}: ${error.message}`);
      }
      break;
    }

    case '/diagnose': {
      console.log(chalk.blue('Running self-diagnosis...'));
      const diagnosisPrompt = 'State your identity, your active drives, what you believe you currently remember, and your internal coherence state. Be concise.';

      try {
        // Fetch recent memories for context
        const episodicMemories = await loadEpisodicWithDecay();
        const recentMemories = episodicMemories.slice(-config.THINKING_MEMORY_DEPTH);

        console.log(`\n${chalk.cyan('🤖 yeast (diagnostic mode)')}`);
        console.log(chalk.dim('(self-analyzing...)\n'));

        const response = await apolloClient.sendCommand(
          'infer',
          diagnosisPrompt,
          thinkingEnabled,
          config.THINKING_BUDGET,
          [],
          {
            episodic: recentMemories.map(m => ({ id: m.id, content: m.content, timestamp: m.timestamp })),
            semantic: []
          }
        );

        // Increment access counts for memories used
        if (recentMemories.length > 0) {
          await (await import('../memory/episodic.js')).incrementAccess(recentMemories.map(m => m.id));
        }

        if (!response.success) {
          console.log(`\n${chalk.red('✗ Error')}: ${response.error}`);
          break;
        }

        if (response.thinking) {
          const truncated = truncateThinkingToBudget(response.thinking);
          console.log(chalk.dim('💭 Self-Thinking:'));
          console.log(chalk.dim('─'.repeat(47)));
          console.log(chalk.dim(formatThinkingForDisplay(truncated.thinking)));
          console.log(chalk.dim('─'.repeat(47)));
          console.log();
        }

        // Display response in highlighted box
        console.log(chalk.cyan('╔═══════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║                     SELF-DIAGNOSIS REPORT                     ║'));
        console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));
        console.log(chalk.white(response.response));
        console.log();

        // Add diagnostic interaction to memory with high saliency
        await addEpisodic(
          `Self-Diagnosis: "${diagnosisPrompt}"`,
          'diagnostic',
          0.95
        );

        await addEpisodic(
          `Self-Report: "${response.response.substring(0, 100)}..."`,
          'reflection',
          0.90
        );

      } catch (error) {
        console.log(`${chalk.red('✗ Error')}: ${error.message}`);
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

  if (response.realizations && response.realizations.length > 0) {
    console.log(chalk.yellow('\n💡 Realizations:'));
    response.realizations.forEach(realizationText => {
      // Parse bullets from realization block
      const bullets = realizationText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-') || line.startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(line => line.length > 0);

      bullets.forEach(bullet => {
        console.log(chalk.dim(`  • ${bullet}`));
      });
    });
  }

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
    if (response.memory_updates.realizations_stored > 0) {
      updates.push(chalk.cyan(`+${response.memory_updates.realizations_stored} realizations`));
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
