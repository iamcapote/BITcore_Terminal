/**
 * Application entry point for Nova.
 * Wraps the shell with the terminal provider so surfaces can run commands.
 */

import { NovaShell } from "@/modules/layout/NovaShell";
import { TerminalProvider } from "@/modules/terminal/TerminalContext";
import { StatusProvider } from "@/modules/status/StatusProvider";
import { MemoryTelemetryProvider } from "@/modules/memory/MemoryTelemetryProvider";
import { ResearchPreferencesProvider } from "@/modules/research/ResearchPreferencesProvider";
import { ResearchProvider } from "@/modules/research/ResearchProvider";

export default function App() {
  return (
    <TerminalProvider>
      <StatusProvider>
        <ResearchProvider>
          <ResearchPreferencesProvider>
            <MemoryTelemetryProvider>
              <NovaShell />
            </MemoryTelemetryProvider>
          </ResearchPreferencesProvider>
        </ResearchProvider>
      </StatusProvider>
    </TerminalProvider>
  );
}
