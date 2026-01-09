#!/usr/bin/env node

/**
 * fermenter.js
 * Batch processing script for AI Yeast.
 * Feeds prompts from scripts/prompts/ to the agent and saves outputs.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

const PROMPTS_DIR = './scripts/prompts';
const OUTPUT_DIR = './scripts/thoughts_and_responses';

/**
 * Parse output from yeast to extract complexity, saliency, and realizations
 */
function parseOutput(rawOutput) {
  const complexityMatch = rawOutput.match(/\[COMPLEXITY:\s*([\d.]+)\]/);
  const saliencyMatch = rawOutput.match(/\[SALIENCY:\s*([\d.]+)\]/);

  // Extract realization blocks
  const realizationRegex = /<realizations>([\s\S]*?)<\/realizations>/g;
  const realizationMatches = [...rawOutput.matchAll(realizationRegex)];

  const realizations = [];
  for (const match of realizationMatches) {
    const bullets = match[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-') || line.startsWith('•'))
      .map(line => line.replace(/^[-•]\s*/, '').trim())
      .filter(line => line.length > 0);
    realizations.push(...bullets);
  }

  return {
    complexity_score: complexityMatch ? parseFloat(complexityMatch[1]) : null,
    saliency_score: saliencyMatch ? parseFloat(saliencyMatch[1]) : null,
    realizations_count: realizations.length,
    realizations: realizations,
    raw_output: rawOutput
  };
}

async function main() {
    const args = process.argv.slice(2);
    const targetFile = args[0];

    console.log(chalk.cyan('🍞 Yeast Fermenter - Batch Processing Starting...'));

    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    let promptFiles = [];
    if (targetFile) {
        if (existsSync(targetFile)) {
            promptFiles = [targetFile];
        } else if (existsSync(join(PROMPTS_DIR, targetFile))) {
            promptFiles = [join(PROMPTS_DIR, targetFile)];
        } else {
            console.log(chalk.red(`✗ Error: Target starch file not found: ${targetFile}`));
            process.exit(1);
        }
    } else {
        if (!existsSync(PROMPTS_DIR)) {
            mkdirSync(PROMPTS_DIR, { recursive: true });
        }
        promptFiles = readdirSync(PROMPTS_DIR)
            .filter(f => f.endsWith('.txt') || f.endsWith('.md'))
            .map(f => join(PROMPTS_DIR, f));
    }

    if (promptFiles.length === 0) {
        console.log(chalk.yellow('⚠ No starch files found. Add some to ' + PROMPTS_DIR));
        return;
    }

    for (const filePath of promptFiles) {
        const fileBase = basename(filePath);
        const fileKey = fileBase.replace(/\.[^/.]+$/, "");
        const content = readFileSync(filePath, 'utf8');
        const prompts = content.split('\n').filter(p => p.trim().length > 0 && !p.trim().startsWith('#'));

        console.log(chalk.blue(`\n📄 Processing starch: ${fileBase} (${prompts.length} prompts)`));

        // Create subfolder for this starch
        const starchOutputDir = join(OUTPUT_DIR, fileKey);
        if (!existsSync(starchOutputDir)) {
            mkdirSync(starchOutputDir, { recursive: true });
        }

        // Track statistics across this starch file
        let totalRealizations = 0;
        let complexityScores = [];
        let saliencyScores = [];

        for (let i = 0; i < prompts.length; i++) {
            const prompt = prompts[i];
            const outputFilename = `${fileKey}_${i + 1}.json`;
            const outputPath = join(starchOutputDir, outputFilename);

            console.log(chalk.dim(`  [${i + 1}/${prompts.length}] Fermenting: "${prompt.substring(0, 30)}..."`));

            try {
                // Call yeast in headless mode with --no-proposals
                const result = execSync(`NO_PROPOSALS=true node src/cli/yeast.js -p "${prompt.replace(/"/g, '\\"')}"`, {
                    encoding: 'utf8',
                    env: { ...process.env, NO_PROPOSALS: 'true' }
                });

                // Parse output to extract structured metrics
                const parsed = parseOutput(result);

                writeFileSync(outputPath, JSON.stringify({
                    prompt,
                    timestamp: new Date().toISOString(),
                    complexity_score: parsed.complexity_score,
                    saliency_score: parsed.saliency_score,
                    realizations_count: parsed.realizations_count,
                    realizations: parsed.realizations,
                    raw_output: parsed.raw_output
                }, null, 2));

                // Collect statistics
                totalRealizations += parsed.realizations_count;
                if (parsed.complexity_score !== null) complexityScores.push(parsed.complexity_score);
                if (parsed.saliency_score !== null) saliencyScores.push(parsed.saliency_score);

                console.log(chalk.green(`    ✓ Saved: complexity=${parsed.complexity_score?.toFixed(2) || 'N/A'}, realizations=${parsed.realizations_count}, saliency=${parsed.saliency_score?.toFixed(2) || 'N/A'}`));
            } catch (error) {
                console.error(chalk.red(`    ✗ Failed: ${error.message}`));
            }
        }

        // Print starch summary
        const avgComplexity = complexityScores.length > 0
            ? (complexityScores.reduce((a, b) => a + b) / complexityScores.length).toFixed(2)
            : 'N/A';
        const avgSaliency = saliencyScores.length > 0
            ? (saliencyScores.reduce((a, b) => a + b) / saliencyScores.length).toFixed(2)
            : 'N/A';

        console.log(chalk.cyan(`\n  📊 Starch Summary (${fileKey}):`));
        console.log(`    Total Realizations: ${totalRealizations}`);
        console.log(`    Avg Complexity: ${avgComplexity}`);
        console.log(`    Avg Saliency: ${avgSaliency}`);
        console.log(`    Processed: ${prompts.length} prompts`);
    }

    console.log(chalk.cyan('\n✨ Fermentation complete!'));
}

main();
