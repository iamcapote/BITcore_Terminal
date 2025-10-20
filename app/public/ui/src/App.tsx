/**
 * Why: Provide a minimal shell component until feature modules land.
 * What: Renders a scaffolded layout that confirms token plumbing, exposes theme controls, and starts wiring feature modules.
 * How: Hosts the terminal shell, command palette launcher, focus mode toggle, and theme controls to validate state stores end to end.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { CommandMetadata } from './data/commandMetadata';
import { getCommandMetadata } from './data/commandMetadata';
import { CommandPalette } from './components/CommandPalette';
import { PromptModal } from './components/PromptModal';
import { TerminalShell } from './components/TerminalShell';
import { ResearchTelemetryCard } from './components/ResearchTelemetryCard';
import { ModelBrowser } from './components/ModelBrowser';
import { ChatTranscript } from './components/ChatTranscript';
import { MemoryTimeline } from './components/MemoryTimeline';
import { LogsViewer } from './components/LogsViewer';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Button } from './components/primitives';
import { ShellLayout } from './components/layout/ShellLayout';
import { ShellSidebar } from './components/layout/ShellSidebar';
import { CommandSurface } from './components/layout/CommandSurface';
import { InsightDeck } from './components/layout/InsightDeck';
import { SidebarNavigation, type SidebarCommandSection } from './components/layout/SidebarNavigation';
import { runConfigSetThemeCommand } from './controllers/runConfigSetThemeCommand';
import { listAvailableThemes, useTheme } from './theme/ThemeProvider';
import { useCommandPaletteStore } from './stores/commandPaletteStore';
import { usePromptModalStore } from './stores/promptModalStore';
import { useTerminalStore } from './stores/terminalStore';
import { useInterfaceStore } from './stores/interfaceStore';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { getResearchTelemetrySnapshot, useResearchTelemetryStore } from './stores/researchTelemetryStore';
import { getMemoryTimelineSnapshot, summarizeMemorySync, useMemoryTimelineStore } from './stores/memoryTimelineStore';
import { getLogStats, getLogsSnapshot, useLogsViewerStore } from './stores/logsViewerStore';
import { formatRelativeTime } from './utils/time';

const COMMAND_CATEGORY_CONFIG: Record<CommandMetadata['category'], { title: string; description: string; order: number; searchQuery: string }> = {
  research: {
    title: 'Research',
    description: 'Run adaptive research, monitor progress, and generate deliverables.',
    order: 1,
    searchQuery: 'research'
  },
  missions: {
    title: 'Missions',
    description: 'Schedule and supervise mission pipelines and automation runs.',
    order: 2,
    searchQuery: 'missions'
  },
  memory: {
    title: 'Memory',
    description: 'Inspect commits, sync status, and archival commands.',
    order: 3,
    searchQuery: 'memory'
  },
  tools: {
    title: 'Tools',
    description: 'Export assets and manage auxiliary tooling.',
    order: 4,
    searchQuery: 'export'
  },
  chat: {
    title: 'Chat',
    description: 'Launch or review conversations with memory context.',
    order: 5,
    searchQuery: 'chat'
  },
  system: {
    title: 'System',
    description: 'Configure keys, themes, and review operational telemetry.',
    order: 6,
    searchQuery: 'config'
  }
};

function generateShaStub(): string {
  return Math.random().toString(16).slice(2, 9);
}

function App(): JSX.Element {
  const { theme, setTheme, cycleTheme } = useTheme();
  const themes = listAvailableThemes();
  const openCommandPalette = useCommandPaletteStore((state) => state.open);
  const openCommandPaletteWithQuery = useCommandPaletteStore((state) => state.openWithQuery);
  const { openPassword, openConfirm, openSelect } = usePromptModalStore((state) => ({
    openPassword: state.openPassword,
    openConfirm: state.openConfirm,
    openSelect: state.openSelect
  }));
  const appendEntry = useTerminalStore((state) => state.appendEntry);
  const prompt = useTerminalStore((state) => state.prompt);
  const isFocusMode = useInterfaceStore((state) => state.isFocusMode);
  const toggleFocusMode = useInterfaceStore((state) => state.toggleFocusMode);
  const openSettings = useInterfaceStore((state) => state.openSettings);
  const startResearch = useResearchTelemetryStore((state) => state.start);
  const updateResearchStage = useResearchTelemetryStore((state) => state.updateStage);
  const updateResearchProgress = useResearchTelemetryStore((state) => state.updateProgress);
  const recordTokenUsage = useResearchTelemetryStore((state) => state.recordTokenUsage);
  const completeResearch = useResearchTelemetryStore((state) => state.complete);
  const appendMemoryEvent = useMemoryTimelineStore((state) => state.appendEvent);
  const updateMemoryEvent = useMemoryTimelineStore((state) => state.updateEvent);
  const appendLogEntry = useLogsViewerStore((state) => state.appendEntry);
  const setLogStreaming = useLogsViewerStore((state) => state.setStreaming);
  const telemetryTimers = useRef<number[]>([]);
  const memoryTimers = useRef<number[]>([]);
  const logTimers = useRef<number[]>([]);

  const commandSections = useMemo<SidebarCommandSection[]>(() => {
    const allCommands = getCommandMetadata();
    const grouped = allCommands.reduce((acc, command) => {
      const bucket = acc[command.category] ?? [];
      bucket.push(command);
      acc[command.category] = bucket;
      return acc;
    }, {} as Partial<Record<CommandMetadata['category'], CommandMetadata[]>>);

    return Object.entries(COMMAND_CATEGORY_CONFIG)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([category, config]) => {
        const commands = [...(grouped[category as CommandMetadata['category']] ?? [])].sort((left, right) =>
          left.name.localeCompare(right.name)
        );
        if (commands.length === 0) {
          return null;
        }
        return {
          id: category,
          title: config.title,
          description: config.description,
          commands,
          searchQuery: config.searchQuery
        } satisfies SidebarCommandSection;
      })
      .filter(Boolean) as SidebarCommandSection[];
  }, []);

  useGlobalShortcuts();

  useEffect(() => {
    return () => {
      telemetryTimers.current.forEach((timer) => window.clearTimeout(timer));
      telemetryTimers.current = [];
      memoryTimers.current.forEach((timer) => window.clearTimeout(timer));
      memoryTimers.current = [];
      logTimers.current.forEach((timer) => window.clearTimeout(timer));
      logTimers.current = [];
    };
  }, []);

  const handleRunCommand = useCallback(
    (command: CommandMetadata) => {
      appendEntry({ text: `${prompt}${command.name}`, type: 'input' });
      appendEntry({ text: `Command staged: ${command.description}`, type: 'system' });

      if (command.id === 'keys.set') {
        openPassword({
          title: 'Store Provider Key',
          message: 'Enter the API key or token. Secrets are redacted visually and encrypted at rest.',
          placeholder: 'venice_... or sk-live-...',
          onSubmit: () => {
            appendEntry({ text: 'API key captured (stubbed). Persist layer pending.', type: 'system' });
          },
          onCancel: () => {
            appendEntry({ text: 'API key entry cancelled.', type: 'system' });
          }
        });
      } else if (command.id === 'config.set.ui.theme') {
        runConfigSetThemeCommand({ themes, setTheme, openSelect, appendEntry });
      } else if (command.id === 'research.query') {
        startResearch({ depth: 3, breadth: 2 });
        recordTokenUsage({ timestamp: Date.now(), totalTokens: 120, promptTokens: 45, completionTokens: 75 });
        updateResearchProgress(12);
        updateResearchStage('planning');

        const now = Date.now();
        const commitId = `commit-${now}`;
        const syncId = `${commitId}-sync`;

        setLogStreaming(true);
        appendLogEntry({
          id: `log-${now}`,
          level: 'info',
          message: 'Accepted /research request and queued pipeline.',
          source: 'research.pipeline',
          timestamp: now
        });

        appendMemoryEvent({
          id: commitId,
          kind: 'commit',
          title: 'Commit: Research demo snapshot',
          description: 'Captured findings from simulated /research run.',
          status: 'completed',
          timestamp: now,
          repo: 'iamcapote/bitcore-memory',
          branch: 'main',
          commitSha: generateShaStub()
        });

        appendMemoryEvent({
          id: syncId,
          kind: 'sync',
          title: 'GitHub sync queued',
          description: 'Uploading memory delta to GitHub mirror.',
          status: 'pending',
          timestamp: now + 50,
          target: 'GitHub',
          repo: 'iamcapote/bitcore-memory',
          branch: 'main'
        });

        const executeTimer = window.setTimeout(() => {
          updateResearchStage('executing');
          updateResearchProgress(58);
          recordTokenUsage({ timestamp: Date.now(), totalTokens: 620, promptTokens: 180, completionTokens: 440 });
          telemetryTimers.current = telemetryTimers.current.filter((timer) => timer !== executeTimer);
        }, 450);

        const synthTimer = window.setTimeout(() => {
          updateResearchStage('synthesizing');
          updateResearchProgress(87);
          recordTokenUsage({ timestamp: Date.now(), totalTokens: 980, promptTokens: 260, completionTokens: 720 });
          telemetryTimers.current = telemetryTimers.current.filter((timer) => timer !== synthTimer);
        }, 900);

        const completeTimer = window.setTimeout(() => {
          completeResearch('Research complete (demo dataset)');
          recordTokenUsage({ timestamp: Date.now(), totalTokens: 1120, promptTokens: 320, completionTokens: 800 });
          telemetryTimers.current = telemetryTimers.current.filter((timer) => timer !== completeTimer);
        }, 1350);

        telemetryTimers.current.push(executeTimer, synthTimer, completeTimer);

        const logExecuteTimer = window.setTimeout(() => {
          appendLogEntry({
            id: `log-${Date.now()}-exec`,
            level: 'debug',
            message: 'Executing research stage with Venice + GitHub augmentation.',
            source: 'research.pipeline',
            timestamp: Date.now()
          });
          logTimers.current = logTimers.current.filter((timer) => timer !== logExecuteTimer);
        }, 420);

        const logSynthTimer = window.setTimeout(() => {
          appendLogEntry({
            id: `log-${Date.now()}-synth`,
            level: 'info',
            message: 'Synthesizing findings and scoring sources.',
            source: 'research.pipeline',
            timestamp: Date.now()
          });
          logTimers.current = logTimers.current.filter((timer) => timer !== logSynthTimer);
        }, 930);

        const logCompleteTimer = window.setTimeout(() => {
          appendLogEntry({
            id: `log-${Date.now()}-complete`,
            level: 'info',
            message: 'Research pipeline completed successfully (demo).',
            source: 'research.pipeline',
            timestamp: Date.now()
          });
          setLogStreaming(false);
          logTimers.current = logTimers.current.filter((timer) => timer !== logCompleteTimer);
        }, 1500);

        logTimers.current.push(logExecuteTimer, logSynthTimer, logCompleteTimer);

        const syncStartTimer = window.setTimeout(() => {
          updateMemoryEvent(syncId, {
            status: 'in-progress',
            description: 'Streaming notes to GitHub mirror (demo).'
          });
          memoryTimers.current = memoryTimers.current.filter((timer) => timer !== syncStartTimer);
        }, 550);

        const syncCompleteTimer = window.setTimeout(() => {
          updateMemoryEvent(syncId, {
            status: 'completed',
            description: 'Memory synced to GitHub (demo).',
            commitSha: generateShaStub()
          });
          memoryTimers.current = memoryTimers.current.filter((timer) => timer !== syncCompleteTimer);
        }, 1500);

        memoryTimers.current.push(syncStartTimer, syncCompleteTimer);

        appendEntry({ text: 'Research pipeline started (demo). Telemetry updating in real time.', type: 'system' });
      } else if (command.id === 'research.status') {
        const snapshot = getResearchTelemetrySnapshot();
        appendEntry({
          text: `Status: ${snapshot.status} · Stage: ${snapshot.stage} · Progress: ${snapshot.progress}% · Depth ${snapshot.depth} / Breadth ${snapshot.breadth}`,
          type: 'system'
        });
      } else if (command.id === 'memory.stats') {
        const snapshot = getMemoryTimelineSnapshot();
        const summary = summarizeMemorySync(snapshot.events);
        const lastSyncLabel = summary.lastSyncedAt ? formatRelativeTime(summary.lastSyncedAt) : 'Never';
        appendEntry({
          text: `Memory sync ${summary.status} · Commits ${summary.totalCommits} · Unsynced ${summary.unsyncedCommits} · In flight ${summary.inFlightUploads} · Failures ${summary.failedUploads} · Last GitHub sync ${lastSyncLabel}`,
          type: 'system'
        });
      } else if (command.id === 'logs.tail') {
        const snapshot = getLogsSnapshot();
        const stats = getLogStats(snapshot.entries);
        appendEntry({
          text: `Logs ${snapshot.streaming ? 'streaming' : 'idle'} · total ${stats.total} (debug ${stats.byLevel.debug} · info ${stats.byLevel.info} · warn ${stats.byLevel.warn} · error ${stats.byLevel.error})`,
          type: 'system'
        });
      } else if (command.id === 'missions.schedule') {
        openConfirm({
          title: 'Queue Mission Scheduler',
          message: 'Queue the mission scheduler to run with default cadence?',
          confirmLabel: 'Queue mission',
          cancelLabel: 'Dismiss',
          onSubmit: () => {
            appendEntry({ text: 'Mission scheduler queued (simulation).', type: 'system' });
          },
          onCancel: () => {
            appendEntry({ text: 'Mission scheduling aborted.', type: 'system' });
          }
        });
      } else if (command.id === 'export.cli') {
        openSelect({
          title: 'Export Research Report',
          message: 'Choose the format for the current research result set.',
          options: ['Markdown', 'JSON', 'HTML'],
          onSubmit: (format) => {
            appendEntry({ text: `Export initiated as ${format}.`, type: 'system' });
          },
          onCancel: () => {
            appendEntry({ text: 'Export cancelled.', type: 'system' });
          }
        });
      }
    },
    [
      appendEntry,
      appendLogEntry,
      appendMemoryEvent,
      completeResearch,
      openConfirm,
      openPassword,
      openSelect,
      prompt,
      recordTokenUsage,
      setLogStreaming,
      startResearch,
      updateMemoryEvent,
      updateResearchProgress,
      updateResearchStage
    ]
  );

  const focusModeLabel = isFocusMode ? 'Exit Focus Mode (Esc)' : 'Toggle Focus Mode (⌘⇧F)';

  const sidebarActions = (
    <>
      <Button type="button" variant="outline" onClick={openCommandPalette}>
        Open Command Palette (⌘K)
      </Button>
      <Button type="button" intent="secondary" variant="outline" onClick={toggleFocusMode}>
        {focusModeLabel}
      </Button>
      <Button type="button" intent="secondary" variant="outline" onClick={openSettings}>
        Open Settings (⌘,)
      </Button>
      <Button type="button" intent="secondary" variant="ghost" onClick={cycleTheme}>
        Cycle Theme (Ctrl/Cmd + Alt + T)
      </Button>
    </>
  );

  const sidebarMeta = (
    <>
      <strong>Active theme: {theme}</strong>
      <span>Manage appearance in the settings drawer or run `/config set ui.theme`.</span>
    </>
  );

  const commandSurface = (
    <CommandSurface
      title="Console Prototype"
      subtitle="Virtualized terminal output and command palette shell are wired here while backend bridges are in flight."
    >
      <div className="command-surface__terminal">
        <TerminalShell height={isFocusMode ? 480 : 400} />
      </div>
    </CommandSurface>
  );

  const insightDeck = (
    <InsightDeck>
      <InsightDeck.Section>
        <ResearchTelemetryCard />
      </InsightDeck.Section>
      <InsightDeck.Section>
        <ChatTranscript />
      </InsightDeck.Section>
      <InsightDeck.Section>
        <MemoryTimeline />
      </InsightDeck.Section>
      <InsightDeck.Section>
        <LogsViewer />
      </InsightDeck.Section>
      <InsightDeck.Section span="full">
        <ModelBrowser />
      </InsightDeck.Section>
    </InsightDeck>
  );

  return (
    <>
      <ShellLayout
        isFocusMode={isFocusMode}
        sidebar={
          <ShellSidebar
            title="BITcore UI Preview"
            description="The full-featured command surface, telemetry deck, and multi-skin experience mount here. This scaffold ensures the build system is ready for iterative feature delivery."
            actions={sidebarActions}
            meta={sidebarMeta}
          >
            <SidebarNavigation
              sections={commandSections}
              onRunCommand={handleRunCommand}
              onOpenPaletteWithQuery={openCommandPaletteWithQuery}
            />
          </ShellSidebar>
        }
        commandSurface={commandSurface}
        insightDeck={insightDeck}
      />
      <SettingsDrawer />
      <CommandPalette onRunCommand={handleRunCommand} />
      <PromptModal />
    </>
  );
}

export default App;
