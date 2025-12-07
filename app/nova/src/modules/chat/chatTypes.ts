/**
 * @license INTERNAL ONLY — Chat session types
 *
 * Why: Share consistent TypeScript shapes between the chat store, provider, and surface components.
 * What: Declares message, persona, memory context, and configuration types consumed across the chat module.
 * How: Centralise immutable interfaces and reusable discriminated unions so UI and state logic remain in sync.
 */

export type ChatMessageRole = "system" | "user" | "assistant";

export type ChatMessageStatus = "normal" | "failed";

export interface ChatMessage {
  readonly id: string;
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly createdAt: number;
  readonly status: ChatMessageStatus;
  readonly error?: string;
}

export interface ChatPersona {
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
}

export type ChatMemoryDepth = "short" | "medium" | "long";

export interface MemoryContextEntry {
  readonly id: string;
  readonly content: string;
  readonly similarity?: number;
  readonly role?: string;
  readonly timestamp?: string | number;
  readonly tags?: readonly string[];
  readonly matchReason?: string;
}

export interface ChatSessionConfig {
  readonly memoryEnabled: boolean;
  readonly memoryDepth: ChatMemoryDepth;
  readonly memoryGithubEnabled: boolean;
  readonly character?: string | null;
  readonly model?: string | null;
}

export interface ChatState {
  readonly active: boolean;
  readonly prompt: string;
  readonly model: string | null;
  readonly persona: ChatPersona | null;
  readonly history: readonly ChatMessage[];
  readonly memoryContext: readonly MemoryContextEntry[];
  readonly memoryEnabled: boolean;
  readonly memoryDepth: ChatMemoryDepth;
  readonly memoryGithubEnabled: boolean;
  readonly pending: boolean;
  readonly pendingConfig: ChatSessionConfig | null;
  readonly lastConfig: ChatSessionConfig;
  readonly lastError: string | null;
}
