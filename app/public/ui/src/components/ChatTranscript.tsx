/**
 * Why: Demonstrate the modern chat skin so designers can validate bubble layouts before wiring live data.
 * What: Presents a static transcript with user and assistant roles, a preview footer, and theme-aware styling hooks.
 * How: Maps canned messages into Card rows, pulling bubble tokens from the ThemeProvider context to reflect skins.
 * Contract
 * Inputs:
 *   - none (uses internal demo transcript)
 * Outputs:
 *   - JSX.Element; renders a Card with bubble-styled messages and compose footer
 * Error modes:
 *   - none; component is pure render
 * Performance:
 *   - negligible; renders four static rows
 * Side effects:
 *   - none
 */

import type { ReactNode } from 'react';

import { Card } from './primitives/Card';
import { Input } from './primitives/Input';
import { useTheme } from '../theme/ThemeProvider';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  author: string;
  timestamp: string;
  content: ReactNode;
}

const SAMPLE_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    author: 'BITcore',
    timestamp: '09:42',
    content: 'Morning! Ready to plan today\'s research sprint. What mission should we prioritize?'
  },
  {
    id: 'msg-2',
    role: 'user',
    author: 'You',
    timestamp: '09:43',
    content: 'Focus on GitHub-based intel. Summaries for the latest Venice agents would help the briefing.'
  },
  {
    id: 'msg-3',
    role: 'assistant',
    author: 'BITcore',
    timestamp: '09:44',
    content: (
      <span>
        Copy that. I\'ll run <code>/research "Venice agent updates"</code> and prep highlights. Need a GitHub sync too?
      </span>
    )
  },
  {
    id: 'msg-4',
    role: 'user',
    author: 'You',
    timestamp: '09:44',
    content: 'Yes, queue the sync after the summary lands. Ping memory when complete.'
  }
];

function bubbleBackground(role: Message['role']): string {
  if (role === 'user') {
    return 'var(--chat-bubble-user, var(--color-bg-secondary))';
  }
  if (role === 'assistant') {
    return 'var(--chat-bubble-assistant, var(--color-bg-surface))';
  }
  return 'rgba(30, 41, 59, 0.5)';
}

function bubbleAlignment(role: Message['role']): 'flex-start' | 'flex-end' {
  return role === 'user' ? 'flex-end' : 'flex-start';
}

function transcriptDirection(role: Message['role']): 'row' | 'row-reverse' {
  return role === 'user' ? 'row-reverse' : 'row';
}

function bubbleTextColor(role: Message['role']): string {
  return role === 'user' ? '#0f172a' : 'var(--color-fg-primary)';
}

function avatarBackground(role: Message['role']): string {
  if (role === 'user') {
    return 'var(--chat-avatar-user, var(--color-bg-surface))';
  }
  if (role === 'assistant') {
    return 'var(--chat-avatar-assistant, var(--color-bg-secondary))';
  }
  return 'var(--color-bg-secondary)';
}

function avatarTextColor(role: Message['role']): string {
  if (role === 'assistant') {
    return '#f8fafc';
  }
  if (role === 'user') {
    return '#0f172a';
  }
  return 'var(--color-fg-primary)';
}

export function ChatTranscript(): JSX.Element {
  const { theme } = useTheme();
  const isModernTheme = theme === 'modern';

  return (
    <Card
      title="Chat Transcript"
      subtitle={isModernTheme ? 'Modern chat skin preview' : 'Switch to Modern theme for full effect'}
      footer={
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-sm)',
            alignItems: 'center'
          }}
        >
          <Input placeholder="Type a message…" disabled={!isModernTheme} style={{ flex: 1 }} />
          <button
            type="button"
            disabled={!isModernTheme}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radii-full)',
              border: 'none',
              background: 'var(--chat-bubble-user, var(--color-bg-surface))',
              color: '#0f172a',
              cursor: isModernTheme ? 'pointer' : 'not-allowed',
              opacity: isModernTheme ? 1 : 0.5,
              fontFamily: 'var(--typography-font-family-sans)',
              fontWeight: 600
            }}
          >
            Send
          </button>
        </div>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md)',
          maxHeight: '260px',
          overflowY: 'auto',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radii-lg)',
          background: isModernTheme ? 'rgba(15, 23, 42, 0.35)' : 'var(--color-bg-surface)',
          backdropFilter: isModernTheme ? 'var(--panel-blur)' : undefined,
          boxShadow: isModernTheme ? '0 20px 40px -24px var(--chat-bubble-shadow)' : undefined
        }}
      >
        {SAMPLE_MESSAGES.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: bubbleAlignment(message.role),
              gap: 'var(--spacing-xs)'
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                color: 'var(--color-muted)',
                fontSize: 'var(--typography-font-size-xs)',
                fontFamily: 'var(--typography-font-family-sans)'
              }}
            >
              <span>{message.author}</span>
              <span>•</span>
              <span>{message.timestamp}</span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: transcriptDirection(message.role),
                alignItems: 'flex-end',
                gap: 'var(--spacing-sm)'
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  borderRadius: '24px',
                  background: bubbleBackground(message.role),
                  color: bubbleTextColor(message.role),
                  boxShadow: isModernTheme ? '0 12px 24px -16px var(--chat-bubble-shadow)' : undefined,
                  fontFamily: 'var(--typography-font-family-sans)',
                  fontSize: 'var(--typography-font-size-sm)',
                  lineHeight: 'var(--typography-line-height-relaxed)'
                }}
              >
                {message.content}
              </div>
              <div
                aria-hidden="true"
                style={{
                  width: 'var(--chat-avatar-size, 40px)',
                  height: 'var(--chat-avatar-size, 40px)',
                  minWidth: 'var(--chat-avatar-size, 40px)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: avatarBackground(message.role),
                  color: avatarTextColor(message.role),
                  fontFamily: 'var(--typography-font-family-sans)',
                  fontWeight: 700,
                  fontSize: 'var(--typography-font-size-sm)',
                  border: isModernTheme
                    ? '2px solid var(--chat-avatar-ring, rgba(148, 163, 184, 0.45))'
                    : '1px solid var(--color-border)',
                  boxShadow: isModernTheme ? '0 10px 20px -16px var(--chat-bubble-shadow)' : undefined
                }}
              >
                {message.author.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
