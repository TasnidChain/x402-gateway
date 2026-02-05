/**
 * @x402/cli - Init Command
 * Interactive setup for x402 in Next.js projects
 */

import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import {
  ENV_TEMPLATE,
  MIDDLEWARE_TEMPLATE,
  APP_ROUTER_TEMPLATE,
  PAGE_TEMPLATE,
  LAYOUT_TEMPLATE,
} from './templates.js';

interface InitOptions {
  yes?: boolean;
}

interface InitAnswers {
  payTo: string;
  network: 'base-mainnet' | 'base-sepolia';
  createExamples: boolean;
  framework: 'app' | 'pages';
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function generateJwtSecret(): string {
  return `x402_${crypto.randomBytes(32).toString('hex')}`;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const spinner = ora();

  console.log(chalk.blue('\n🔐 x402 Paywall Setup\n'));

  // Check if this is a Next.js project
  const packageJsonPath = join(cwd, 'package.json');
  if (!(await fileExists(packageJsonPath))) {
    console.log(chalk.red('Error: No package.json found. Please run this in a Next.js project directory.'));
    process.exit(1);
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
  const isNextJs = packageJson.dependencies?.next || packageJson.devDependencies?.next;

  if (!isNextJs) {
    console.log(chalk.yellow('Warning: This doesn\'t appear to be a Next.js project.'));
    console.log('x402 SDK is designed for Next.js. Continue anyway?\n');
  }

  // Determine if using App Router or Pages Router
  const hasAppDir = await fileExists(join(cwd, 'app'));
  const hasPagesDir = await fileExists(join(cwd, 'pages'));

  let answers: InitAnswers;

  if (options.yes) {
    // Use defaults
    answers = {
      payTo: '0x0000000000000000000000000000000000000000',
      network: 'base-sepolia',
      createExamples: true,
      framework: hasAppDir ? 'app' : 'pages',
    };
    console.log(chalk.gray('Using default options (--yes flag)'));
  } else {
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'payTo',
        message: 'Your wallet address (receives payments):',
        default: '0x',
        validate: (input: string) => {
          if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
            return true;
          }
          return 'Please enter a valid Ethereum address (0x...)';
        },
      },
      {
        type: 'list',
        name: 'network',
        message: 'Select network:',
        choices: [
          { name: 'Base Sepolia (testnet) - recommended for development', value: 'base-sepolia' },
          { name: 'Base Mainnet (production)', value: 'base-mainnet' },
        ],
        default: 'base-sepolia',
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Next.js router type:',
        choices: [
          { name: 'App Router (app/)', value: 'app' },
          { name: 'Pages Router (pages/)', value: 'pages' },
        ],
        default: hasAppDir ? 'app' : 'pages',
      },
      {
        type: 'confirm',
        name: 'createExamples',
        message: 'Create example files?',
        default: true,
      },
    ]);
  }

  console.log('');

  // Generate JWT secret
  const jwtSecret = generateJwtSecret();

  // Create .env.local
  spinner.start('Creating .env.local...');
  const envPath = join(cwd, '.env.local');
  const envExists = await fileExists(envPath);

  const envContent = ENV_TEMPLATE({
    payTo: answers.payTo,
    network: answers.network,
    jwtSecret,
  });

  if (envExists) {
    const existingEnv = await readFile(envPath, 'utf-8');
    if (existingEnv.includes('X402_PAY_TO')) {
      spinner.info('.env.local already has x402 configuration');
    } else {
      await writeFile(envPath, existingEnv + '\n' + envContent);
      spinner.succeed('Updated .env.local');
    }
  } else {
    await writeFile(envPath, envContent);
    spinner.succeed('Created .env.local');
  }

  // Create example files if requested
  if (answers.createExamples) {
    if (answers.framework === 'app') {
      // App Router examples
      spinner.start('Creating example files for App Router...');

      // Create middleware.ts
      const middlewarePath = join(cwd, 'middleware.ts');
      if (!(await fileExists(middlewarePath))) {
        await writeFile(middlewarePath, MIDDLEWARE_TEMPLATE);
      }

      // Create app/api/premium/route.ts
      const apiDir = join(cwd, 'app', 'api', 'premium');
      await mkdir(apiDir, { recursive: true });
      await writeFile(join(apiDir, 'route.ts'), APP_ROUTER_TEMPLATE);

      // Create app/premium/page.tsx
      const premiumDir = join(cwd, 'app', 'premium');
      await mkdir(premiumDir, { recursive: true });
      await writeFile(join(premiumDir, 'page.tsx'), PAGE_TEMPLATE);

      // Update app/layout.tsx if it exists and doesn't have X402Provider
      const layoutPath = join(cwd, 'app', 'layout.tsx');
      if (await fileExists(layoutPath)) {
        const layoutContent = await readFile(layoutPath, 'utf-8');
        if (!layoutContent.includes('X402Provider')) {
          spinner.info('Note: Add X402Provider to your layout.tsx manually');
        }
      }

      spinner.succeed('Created example files');
    } else {
      // Pages Router examples
      spinner.start('Creating example files for Pages Router...');

      // Create middleware.ts
      const middlewarePath = join(cwd, 'middleware.ts');
      if (!(await fileExists(middlewarePath))) {
        await writeFile(middlewarePath, MIDDLEWARE_TEMPLATE);
      }

      // Create pages/api/premium.ts
      const apiDir = join(cwd, 'pages', 'api');
      await mkdir(apiDir, { recursive: true });

      const pagesApiTemplate = `import { withX402Pages } from '@x402/nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

export default withX402Pages(
  {
    price: '0.01',
    payTo: process.env.X402_PAY_TO as \`0x\${string}\`,
    network: process.env.X402_NETWORK as 'base-mainnet' | 'base-sepolia',
    jwtSecret: process.env.JWT_SECRET!,
    description: 'Premium content',
  },
  async (req: NextApiRequest, res: NextApiResponse, x402) => {
    res.json({
      content: '<h2>Premium Content</h2><p>You have unlocked this content!</p>',
      paidAt: new Date(x402.receipt.paidAt * 1000).toISOString(),
    });
  }
);
`;
      await writeFile(join(apiDir, 'premium.ts'), pagesApiTemplate);

      spinner.succeed('Created example files');
    }
  }

  // Print next steps
  console.log(chalk.green('\n✅ x402 setup complete!\n'));

  console.log(chalk.bold('Next steps:'));
  console.log('');
  console.log('  1. Install dependencies:');
  console.log(chalk.cyan('     npm install @x402/react @x402/nextjs'));
  console.log('');
  console.log('  2. Update your wallet address in .env.local:');
  console.log(chalk.gray(`     X402_PAY_TO=${answers.payTo}`));
  console.log('');
  console.log('  3. Add X402Provider to your layout:');
  console.log(chalk.cyan(`     import { X402Provider } from '@x402/react';`));
  console.log('');
  console.log('  4. Start your dev server:');
  console.log(chalk.cyan('     npm run dev'));
  console.log('');

  if (answers.createExamples) {
    console.log('  5. Visit the example page:');
    console.log(chalk.cyan(`     http://localhost:3000/premium`));
    console.log('');
  }

  console.log(chalk.gray('For documentation, visit: https://x402.org/docs\n'));
}
