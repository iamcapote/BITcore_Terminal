/**
 * Why: Provide a slim facade for the `/chat` command while keeping the main entrypoint under the AGENTS size guidance.
 * What: Re-export modular helpers covering session bootstrap, persona management, CLI prompts, memory finalisation, and research hand-offs.
 * How: Compose functionality from `./chat/*` modules and expose aliases expected by the CLI registry and test suites.
 */

import {
  executeChat as executeChatSession,
  initializeChatConversationForSession,
  persistSessionChatMessage,
  finalizeSessionConversation,
} from './chat/session.mjs';
import { handlePersonaCommand, getPersonaHelpText } from './chat/persona.mjs';
import { promptHiddenFixed, startInteractiveChat } from './chat/interactive-cli.mjs';
import { exitMemory as exitMemoryCommand } from './chat/memory.mjs';
import {
  generateResearchQueries as generateResearchQueriesFromChat,
  startResearchFromChat as startResearchFromChatSession,
  executeExitResearch as executeExitResearchCommand,
} from './chat/research.mjs';

export const executeChat = executeChatSession;
export const exitMemory = exitMemoryCommand;
export const executeExitMemory = exitMemoryCommand;
export const generateResearchQueries = generateResearchQueriesFromChat;
export const startResearchFromChat = startResearchFromChatSession;
export const executeExitResearch = executeExitResearchCommand;

export {
  initializeChatConversationForSession,
  persistSessionChatMessage,
  finalizeSessionConversation,
  promptHiddenFixed,
  startInteractiveChat,
  handlePersonaCommand,
  getPersonaHelpText,
};

export function getChatHelpText() {
  return `/chat [--memory=true] [--depth=short|medium|long] [--character=<slug>] - Start an interactive chat session. Requires login.
    --memory=true: Enable memory persistence for the session.
    --depth=<level>: Set memory depth (short, medium, long). Requires --memory=true.
    --character=<slug>: Temporarily override the default persona for this session.
    Persona management: /chat persona list|get|set|reset [options]
    In-chat commands: /exit, /exitmemory, /memory stats, /research <query>, /exitresearch, /help`;
}