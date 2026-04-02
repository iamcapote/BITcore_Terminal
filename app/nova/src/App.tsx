/**
 * Application entry point for Nova.
 * Wraps the shell with global providers: terminal, status, research, memory, notifications.
 * Overlays: ToastContainer (notification toasts).
 */

import { NovaShell } from "@/modules/layout/NovaShell";
import { TerminalProvider } from "@/modules/terminal/TerminalContext";
import { StatusProvider } from "@/modules/status/StatusProvider";
import { MemoryTelemetryProvider } from "@/modules/memory/MemoryTelemetryProvider";
import { ResearchPreferencesProvider } from "@/modules/research/ResearchPreferencesProvider";
import { ResearchProvider } from "@/modules/research/ResearchProvider";
import { NotificationProvider } from "@/modules/notifications/NotificationProvider";
import { ToastContainer } from "@/modules/notifications/ToastContainer";
import { LocalizationProvider } from "@/modules/settings/LocalizationProvider";

export default function App() {
  return (
    <NotificationProvider>
      <TerminalProvider>
        <StatusProvider>
          <ResearchProvider>
            <ResearchPreferencesProvider>
              <MemoryTelemetryProvider>
                <LocalizationProvider>
                  <NovaShell />
                  <ToastContainer />
                </LocalizationProvider>
              </MemoryTelemetryProvider>
            </ResearchPreferencesProvider>
          </ResearchProvider>
        </StatusProvider>
      </TerminalProvider>
    </NotificationProvider>
  );
}
