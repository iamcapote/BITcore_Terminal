/**
 * Why: Provide a curated list of CLI-equivalent commands so the command palette can surface searchable metadata without wiring into the legacy runtime yet.
 * What: Defines lightweight descriptors for high-value commands spanning research, chat, memory, and tooling categories.
 * How: Exports static metadata and helper accessors that future integrations can replace with live generation.
 */

export interface CommandMetadata {
  id: string;
  name: string;
  category: 'research' | 'chat' | 'memory' | 'missions' | 'system' | 'tools';
  description: string;
  usage: string;
  aliases?: string[];
  shortcut?: string;
}

const COMMANDS: CommandMetadata[] = [
  {
    id: 'research.query',
    name: '/research <query>',
    category: 'research',
    description: 'Run the adaptive research pipeline with Venice, GitHub, and memory enrichment.',
    usage: '/research "Find the latest agentframework update"',
    aliases: ['/r'],
    shortcut: '⌘R'
  },
  {
    id: 'research.status',
    name: '/research status',
    category: 'research',
    description: 'Show progress, stage, and token usage for the current research session.',
    usage: '/research status',
    shortcut: '⌘I'
  },
  {
    id: 'chat.new',
    name: '/chat --memory',
    category: 'chat',
    description: 'Start a new chat session with memory context enabled for knowledge carry-over.',
    usage: '/chat --memory',
    shortcut: '⌘N'
  },
  {
    id: 'chat.history',
    name: '/chat-history list',
    category: 'chat',
    description: 'List prior conversations with timestamps and summary snippets.',
    usage: '/chat-history list'
  },
  {
    id: 'memory.stats',
    name: '/memory stats',
    category: 'memory',
    description: 'Display consolidated memory commits, repo sync state, and pending consolidations.',
    usage: '/memory stats',
    shortcut: '⌘M'
  },
  {
    id: 'missions.schedule',
    name: '/missions schedule',
    category: 'missions',
    description: 'Open the mission scheduler to queue background research or automation tasks.',
    usage: '/missions schedule'
  },
  {
    id: 'keys.set',
    name: '/keys set <provider>',
    category: 'system',
    description: 'Store or rotate API keys for Venice, OpenAI, Anthropic, or other providers.',
    usage: '/keys set venice',
    shortcut: '⌘,'
  },
  {
    id: 'logs.tail',
    name: '/logs --tail',
    category: 'system',
    description: 'Stream the latest operational logs with optional severity filters.',
    usage: '/logs --tail --level warn'
  },
  {
    id: 'export.cli',
    name: '/export report',
    category: 'tools',
    description: 'Generate a structured report from the current research session.',
    usage: '/export report --format markdown'
  },
  {
    id: 'help.shortcuts',
    name: '/help shortcuts',
    category: 'system',
    description: 'Show the keyboard shortcut legend for web and CLI surfaces.',
    usage: '/help shortcuts',
    shortcut: '⌘/'
  },
  {
    id: 'config.set.ui.theme',
    name: '/config set ui.theme',
    category: 'system',
    description: 'Update the active UI theme across web and CLI surfaces.',
    usage: '/config set ui.theme <hacker|modern|retro>'
  }
];

export function getCommandMetadata(): CommandMetadata[] {
  return COMMANDS;
}

export function findCommandById(id: string): CommandMetadata | undefined {
  return COMMANDS.find((command) => command.id === id);
}
