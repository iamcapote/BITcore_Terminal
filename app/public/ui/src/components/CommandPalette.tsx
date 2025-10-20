/**
 * Why: Give operators a keyboard-first launcher that mirrors CLI commands while the full routing layer is under construction.
 * What: Implements a modal palette with fuzzy search powered by Fuse.js and a curated metadata set.
 * How: Pulls static command descriptors, filters them client-side, and emits a run callback for future orchestration hooks.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';

import type { CommandMetadata } from '../data/commandMetadata';
import { getCommandMetadata } from '../data/commandMetadata';
import { useCommandPaletteStore } from '../stores/commandPaletteStore';
import { Input } from './primitives/Input';

const MAX_RESULTS = 8;

type CommandPaletteProps = {
  onRunCommand?: (command: CommandMetadata) => void;
};

export function CommandPalette({ onRunCommand }: CommandPaletteProps): JSX.Element | null {
  const isOpen = useCommandPaletteStore((state) => state.isOpen);
  const query = useCommandPaletteStore((state) => state.query);
  const setQuery = useCommandPaletteStore((state) => state.setQuery);
  const close = useCommandPaletteStore((state) => state.close);

  const commands = useMemo(() => getCommandMetadata(), []);
  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: ['name', 'description', 'aliases', 'usage', 'category'],
        threshold: 0.3,
        ignoreLocation: true
      }),
    [commands]
  );

  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query) {
      return commands.slice(0, MAX_RESULTS);
    }
    return fuse
      .search(query)
      .slice(0, MAX_RESULTS)
      .map((match) => match.item);
  }, [commands, fuse, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    if (highlightedIndex > results.length - 1) {
      setHighlightedIndex(results.length > 0 ? results.length - 1 : 0);
    }
  }, [highlightedIndex, results]);

  const handleOverlayClick = () => {
    close();
  };

  const handleContainerClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
  };

  const handleSelect = (command: CommandMetadata) => {
    onRunCommand?.(command);
    close();
  };

  const handleKeyNavigation: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % Math.max(results.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = results[highlightedIndex];
      if (command) {
        handleSelect(command);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="presentation"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyNavigation}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20vh var(--spacing-lg) var(--spacing-xl)',
        zIndex: 1000
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={handleContainerClick}
        style={{
          width: 'min(640px, 100%)',
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radii-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands..."
            autoFocus
          />
        </div>
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {results.length === 0 ? (
            <p style={{ padding: 'var(--spacing-lg)', color: 'var(--color-muted)', margin: 0 }}>
              No commands match “{query}”. Try keywords like “research” or “mission”.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {results.map((command, index) => {
                const isActive = index === highlightedIndex;
                return (
                  <li key={command.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(command)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 'var(--spacing-md) var(--spacing-lg)',
                        backgroundColor: isActive
                          ? 'color-mix(in srgb, var(--color-accent-primary) 18%, transparent)'
                          : 'transparent',
                        color: 'var(--color-fg-primary)',
                        border: 'none',
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--spacing-xs)'
                      }}
                    >
                      <span style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: 'var(--typography-font-size-sm)' }}>
                        {command.name}
                      </span>
                      <span style={{ color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-xs)' }}>
                        {command.description}
                      </span>
                      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', fontSize: 'var(--typography-font-size-xs)', color: 'var(--color-muted)' }}>
                        <span>{command.category}</span>
                        <span>•</span>
                        <span>{command.usage}</span>
                        {command.shortcut ? (
                          <span style={{ marginLeft: 'auto', fontFamily: 'var(--typography-font-family-mono)' }}>{command.shortcut}</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
