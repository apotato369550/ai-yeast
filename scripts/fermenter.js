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

                writeFileSync(outputPath, JSON.stringify({
                    prompt,
                    timestamp: new Date().toISOString(),
                    output: result
                }, null, 2));

                console.log(chalk.green(`    ✓ Saved to ${outputFilename}`));
            } catch (error) {
                console.error(chalk.red(`    ✗ Failed: ${error.message}`));
            }
        }
    }

    console.log(chalk.cyan('\n✨ Fermentation complete!'));
}

main();
