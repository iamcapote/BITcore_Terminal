#!/usr/bin/env node

/**
 * CLI Metadata Extractor
 * 
 * Why: Generate CLI metadata from app/commands/*.cli.mjs so the GUI can auto-discover, display, and bind commands.
 * What: Scans command modules, extracts command names, help text, flags, and creates a JSON contract for command palette + parity validation.
 * How: Walk command files, invoke getHelpText() and parse output, extract flags from function signatures, emit app/config/cli-metadata.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMAND_OVERRIDES = {
  research: {
    category: 'research',
    description: 'Run adaptive deep research with Venice, GitHub, and memory enrichment.',
    signature: '/research <query>',
    example: '/research "latest agentframework update"',
    shortcut: '⌘R',
    aliases: ['/r'],
    requiresPassword: true
  },
  'research-github': {
    category: 'research',
    description: 'Augment research with GitHub repository context and code insights.',
    signature: '/research-github <owner>/<repo>',
    example: '/research-github iamcapote/bitcore --topic telemetry'
  },
  'research-scheduler': {
    category: 'missions',
    description: 'Create and manage scheduled research runs.',
    signature: '/research-scheduler list',
    example: '/research-scheduler create daily-news --cron "0 9 * * *"'
  },
  chat: {
    category: 'chat',
    description: 'Start an interactive chat session with memory-aware personas.',
    signature: '/chat --memory',
    example: '/chat --character architect',
    shortcut: '⌘N'
  },
  'chat-history': {
    category: 'chat',
    description: 'Inspect, export, or clear stored chat conversations.',
    signature: '/chat-history list',
    example: '/chat-history show session-id --json'
  },
  memory: {
    category: 'memory',
    description: 'Query, persist, and consolidate long-term memory artifacts.',
    signature: '/memory stats',
    example: '/memory recall "venice rate limits"'
  },
  keys: {
    category: 'system',
    description: 'Store, rotate, and test provider API keys.',
    signature: '/keys set <provider>',
    example: '/keys set venice sk-live-…',
    requiresPassword: true
  },
  missions: {
    category: 'missions',
    description: 'Queue, run, and archive mission automation pipelines.',
    signature: '/missions list',
    example: '/missions run mission-123'
  },
  logs: {
    category: 'system',
    description: 'Stream structured application logs with severity filters.',
    signature: '/logs --tail',
    example: '/logs --level=warn',
    shortcut: '⌘L'
  },
  diagnose: {
    category: 'system',
    description: 'Run diagnostics to verify connectivity, config, and credentials.',
    signature: '/diagnose',
    example: '/diagnose --full',
    requiresAuth: false
  },
  status: {
    category: 'system',
    description: 'Display system status, uptime, and provider readiness.',
    signature: '/status',
    example: '/status',
    requiresAuth: false
  },
  prompts: {
    category: 'system',
    description: 'List, edit, and reset system and custom prompts.',
    signature: '/prompts list',
    example: '/prompts set executive-summary --file=summary.md'
  },
  export: {
    category: 'tools',
    description: 'Export research reports, missions, or memory datasets.',
    signature: '/export report',
    example: '/export report --format markdown'
  },
  'github-sync': {
    category: 'tools',
    description: 'Mirror research artifacts to GitHub repositories.',
    signature: '/github-sync verify',
    example: '/github-sync push --files=notes.md'
  },
  storage: {
    category: 'system',
    description: 'Review storage usage and clean up archived artifacts.',
    signature: '/storage stats',
    example: '/storage cleanup --days-old=30'
  },
  security: {
    category: 'system',
    description: 'Run security audits and manage rotation policies.',
    signature: '/security audit',
    example: '/security rotate-keys',
    requiresPassword: true
  },
  login: {
    category: 'system',
    description: 'Authenticate a user account via password.',
    signature: '/login <username>',
    example: '/login admin',
    requiresAuth: false,
    requiresPassword: true
  },
  logout: {
    category: 'system',
    description: 'Terminate the active authenticated session.',
    signature: '/logout',
    example: '/logout',
    requiresPassword: false
  },
  'password-change': {
    category: 'system',
    description: 'Change an account password or rotate credentials.',
    signature: '/password-change --user <username>',
    example: '/password-change --user admin'
  },
  users: {
    category: 'system',
    description: 'Administer user accounts, roles, and invitations.',
    signature: '/users list',
    example: '/users invite ops@example.com'
  },
  terminal: {
    category: 'system',
    description: 'Launch the remote terminal environment.',
    signature: '/terminal open',
    example: '/terminal open research-environment'
  }
};

const CATEGORY_FALLBACK = {
  research: 'research',
  'research-github': 'research',
  'research-scheduler': 'missions',
  chat: 'chat',
  'chat-history': 'chat',
  memory: 'memory',
  keys: 'system',
  missions: 'missions',
  logs: 'system',
  diagnose: 'system',
  status: 'system',
  prompts: 'system',
  export: 'tools',
  'github-sync': 'tools',
  storage: 'system',
  security: 'system',
  login: 'system',
  logout: 'system',
  'password-change': 'system',
  users: 'system',
  terminal: 'system'
};

const PUBLIC_COMMANDS = new Set(['login', 'status', 'help', 'diagnose']);
const PASSWORD_PROMPT_COMMANDS = new Set(['research', 'chat', 'missions', 'export', 'keys', 'security']);

function parseHelpText(helpText) {
  if (!helpText || typeof helpText !== 'string') {
    return {
      description: '',
      flags: [],
      subcommands: [],
      usageLines: []
    };
  }

  const rawLines = helpText.split('\n');
  const usageLines = [];
  let collectingUsage = false;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) {
      if (collectingUsage) {
        collectingUsage = false;
      }
      continue;
    }

    if (/^usage[:]?/i.test(line)) {
      collectingUsage = true;
      continue;
    }

    if (line.startsWith('/')) {
      usageLines.push(line);
      continue;
    }

    if (collectingUsage) {
      // Stay in usage block until blank line; ignore descriptive rows.
      continue;
    }
  }

  const flags = [];
  const flagRegex = /--([a-z0-9-]+)(?:=([a-z0-9<>|\[\]]+))?/gi;
  let flagMatch;

  while ((flagMatch = flagRegex.exec(helpText)) !== null) {
    const flagName = flagMatch[1];
    if (flags.some((flag) => flag.name === flagName)) {
      continue;
    }
    flags.push({
      name: flagName,
      type: flagMatch[2] ? 'string' : 'boolean',
      required: false
    });
  }

  const subcommands = [];
  const subcommandRegex = /^(list|get|set|reset|add|remove|delete|create|update|show|view|enable|disable|export|pull|push|upload|fetch|audit|run|archive|persona)/i;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed.startsWith('/')) {
      continue;
    }
    const [commandPart, descriptionPart] = trimmed.split(/\s+-\s+/, 2);
    if (commandPart) {
      const subMatch = commandPart.slice(1).split(/\s+/)[1];
      if (subMatch && subcommandRegex.test(subMatch)) {
        subcommands.push({
          name: subMatch.toLowerCase(),
          description: descriptionPart || ''
        });
      }
    }
  }

  return {
    description: '',
    flags,
    subcommands,
    usageLines
  };
}

function deriveCommandId(helpText, fallbackName) {
  if (typeof helpText === 'string') {
    const match = helpText.match(/\/(\w[\w-]*)/);
    if (match) {
      return match[1];
    }
  }
  return fallbackName;
}

function mergeMetadata(commandName, parsed, helpText) {
  const override = COMMAND_OVERRIDES[commandName] ?? {};
  const category = override.category ?? CATEGORY_FALLBACK[commandName] ?? 'system';
  const usageLines = parsed.usageLines.length ? parsed.usageLines : [override.signature ?? `/${commandName}`];

  return {
    id: commandName,
    signature: override.signature ?? usageLines[0] ?? `/${commandName}`,
    example: override.example ?? usageLines[1] ?? usageLines[0] ?? `/${commandName}`,
    category,
  description: override.description ?? (parsed.description || `Execute the ${commandName} command`),
    helpText: typeof helpText === 'string' ? helpText.trim() : '',
    usageExamples: usageLines,
    flags: parsed.flags,
    subcommands: parsed.subcommands,
    requiresAuth: override.requiresAuth ?? !PUBLIC_COMMANDS.has(commandName),
    requiresPassword: override.requiresPassword ?? PASSWORD_PROMPT_COMMANDS.has(commandName),
    shortcut: override.shortcut ?? null,
    aliases: override.aliases ?? []
  };
}

export async function extractCliMetadata(commandsDir) {
  const metadata = {
    version: '1.1.0',
    generated: new Date().toISOString(),
    description: 'CLI command metadata for parity validation and GUI binding.',
    commands: {},
    categories: {}
  };

  try {
    const files = fs.readdirSync(commandsDir).filter((fileName) => fileName.endsWith('.cli.mjs'));

    for (const file of files) {
      const filePath = path.join(commandsDir, file);

      try {
        const module = await import(`file://${filePath}`);
        const fallbackName = file.replace('.cli.mjs', '').replace(/\./g, '-');
        const getHelpFn = Object.entries(module).find(([exportName, exportedValue]) =>
          /^get.*HelpText$/.test(exportName) && typeof exportedValue === 'function'
        )?.[1];

        if (typeof getHelpFn !== 'function') {
          console.warn(`⚠️  No help text exporter found for ${file}`);
          continue;
        }

        const helpText = await getHelpFn();
        const commandName = deriveCommandId(helpText, fallbackName);
        const parsed = parseHelpText(helpText);
        const commandMetadata = mergeMetadata(commandName, parsed, helpText);

        metadata.commands[commandName] = commandMetadata;

        if (!metadata.categories[commandMetadata.category]) {
          metadata.categories[commandMetadata.category] = [];
        }
        if (!metadata.categories[commandMetadata.category].includes(commandName)) {
          metadata.categories[commandMetadata.category].push(commandName);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to extract metadata for ${file}:`, error.message);
      }
    }

    for (const commandList of Object.values(metadata.categories)) {
      commandList.sort();
    }

    return metadata;
  } catch (error) {
    console.error('❌ Failed to extract CLI metadata:', error);
    throw error;
  }
}

/**
 * Entry point: Extract and write metadata
 */
async function main() {
  const commandsDir = path.resolve(__dirname, '../commands');
  const outputFile = path.resolve(__dirname, '../config/cli-metadata.json');

  console.log(`📚 Extracting CLI metadata from: ${commandsDir}`);
  
  const metadata = await extractCliMetadata(commandsDir);

  // Create output directory if needed
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write metadata to file
  fs.writeFileSync(outputFile, JSON.stringify(metadata, null, 2));
  
  console.log(`✅ CLI metadata written to: ${outputFile}`);
  console.log(`📊 Found ${Object.keys(metadata.commands).length} commands in ${Object.keys(metadata.categories).length} categories`);
  
  // Print summary
  for (const [category, commands] of Object.entries(metadata.categories)) {
    console.log(`   ${category}: ${commands.join(', ')}`);
  }

  return metadata;
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

export default extractCliMetadata;
