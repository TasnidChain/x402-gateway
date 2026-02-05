/**
 * @x402/cli
 * CLI tool for x402 paywall setup
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './init.js';
import { generateCommand } from './generate.js';

const program = new Command();

program
  .name('x402')
  .description('CLI tool for x402 paywall setup')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize x402 in your Next.js project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(initCommand);

program
  .command('generate <type>')
  .description('Generate secrets or configs (types: secret, config)')
  .action(generateCommand);

program
  .command('doctor')
  .description('Check x402 configuration')
  .action(async () => {
    console.log(chalk.blue('\n🔍 Checking x402 configuration...\n'));

    const { access, readFile } = await import('fs/promises');
    const { join } = await import('path');
    const cwd = process.cwd();

    let issues = 0;

    // Check package.json for dependencies
    try {
      const packageJson = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (!deps['@x402/react']) {
        console.log(chalk.yellow('⚠️  @x402/react not found in dependencies'));
        issues++;
      } else {
        console.log(chalk.green('✓ @x402/react installed'));
      }

      if (!deps['@x402/nextjs']) {
        console.log(chalk.yellow('⚠️  @x402/nextjs not found in dependencies'));
        issues++;
      } else {
        console.log(chalk.green('✓ @x402/nextjs installed'));
      }
    } catch {
      console.log(chalk.red('✗ Could not read package.json'));
      issues++;
    }

    // Check .env.local
    try {
      const envContent = await readFile(join(cwd, '.env.local'), 'utf-8');

      if (!envContent.includes('X402_PAY_TO')) {
        console.log(chalk.yellow('⚠️  X402_PAY_TO not found in .env.local'));
        issues++;
      } else {
        console.log(chalk.green('✓ X402_PAY_TO configured'));
      }

      if (!envContent.includes('JWT_SECRET')) {
        console.log(chalk.yellow('⚠️  JWT_SECRET not found in .env.local'));
        issues++;
      } else {
        console.log(chalk.green('✓ JWT_SECRET configured'));
      }
    } catch {
      console.log(chalk.yellow('⚠️  .env.local not found'));
      issues++;
    }

    // Check middleware.ts
    try {
      await access(join(cwd, 'middleware.ts'));
      console.log(chalk.green('✓ middleware.ts exists'));
    } catch {
      console.log(chalk.yellow('⚠️  middleware.ts not found'));
      issues++;
    }

    console.log('');
    if (issues === 0) {
      console.log(chalk.green('✅ All checks passed!\n'));
    } else {
      console.log(chalk.yellow(`⚠️  ${issues} issue(s) found. Run 'npx @x402/cli init' to fix.\n`));
    }
  });

program.parse();
