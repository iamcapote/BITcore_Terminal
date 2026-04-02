/**
 * Why: Deliver CLI↔GUI parity by turning command metadata into a safe executable form.
 * What: CommandRunnerCard lets operators select a command, set subcommand/flags/args, preview, and dispatch via terminal bus.
 * How: Reads CliCommand metadata, keeps local draft state, composes a slash command string, and executes through TerminalContext.
 */

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/modules/notifications/NotificationProvider";
import { useTerminal } from "@/modules/terminal/TerminalContext";
import type { CliCommand } from "@/modules/admin/adminClient";
import { TerminalSquare } from "lucide-react";

type FlagDraft = Record<string, string | boolean>;

interface CommandRunnerCardProps {
  readonly commands: Record<string, CliCommand>;
}

export function CommandRunnerCard({ commands }: CommandRunnerCardProps): JSX.Element {
  const commandOptions = useMemo(() => Object.values(commands).sort((a, b) => a.id.localeCompare(b.id)), [commands]);
  const initialCommandId = commandOptions[0]?.id ?? "";
  const [commandId, setCommandId] = useState(initialCommandId);
  const [subcommand, setSubcommand] = useState("");
  const [freeArgs, setFreeArgs] = useState("");
  const [flagDraft, setFlagDraft] = useState<FlagDraft>({});
  const { runCommand, inputEnabled, promptRequest, mode } = useTerminal();
  const { notify } = useNotifications();

  const selected = commands[commandId] ?? null;

  useEffect(() => {
    if (!commandId && initialCommandId) {
      setCommandId(initialCommandId);
    }
  }, [commandId, initialCommandId]);

  useEffect(() => {
    if (!selected) {
      setSubcommand("");
      setFlagDraft({});
      return;
    }
    setSubcommand(selected.subcommands[0]?.name ?? "");
    const nextDraft: FlagDraft = {};
    for (const flag of selected.flags) {
      nextDraft[flag.name] = flag.type === "boolean" ? false : "";
    }
    setFlagDraft(nextDraft);
    setFreeArgs("");
  }, [selected?.id]);

  const disabled = !selected || !inputEnabled || Boolean(promptRequest);

  const builtCommand = useMemo(() => {
    if (!selected) {
      return "";
    }
    const parts: string[] = [`/${selected.id}`];
    if (subcommand) {
      parts.push(subcommand);
    }
    const normalizedArgs = freeArgs.trim();
    if (normalizedArgs.length > 0) {
      parts.push(normalizedArgs);
    }
    for (const flag of selected.flags) {
      const value = flagDraft[flag.name];
      if (flag.type === "boolean") {
        if (value === true) {
          parts.push(`--${flag.name}`);
        }
        continue;
      }
      const normalized = typeof value === "string" ? value.trim() : "";
      if (!normalized) {
        continue;
      }
      parts.push(`--${flag.name}=${quoteFlagValue(normalized)}`);
    }
    return parts.join(" ");
  }, [selected, subcommand, freeArgs, flagDraft]);

  const runBuiltCommand = () => {
    if (!builtCommand) {
      return;
    }
    runCommand(builtCommand);
    notify("success", "Command queued", builtCommand);
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TerminalSquare className="h-4 w-4" />
          Command Runner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Build command invocations from CLI metadata and run them through the live terminal session.
        </p>
        {commandOptions.length === 0 ? (
          <p className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            No command metadata loaded.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Command</p>
                <Select value={commandId} onValueChange={setCommandId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select command" />
                  </SelectTrigger>
                  <SelectContent>
                    {commandOptions.map((command) => (
                      <SelectItem key={command.id} value={command.id} className="text-xs">
                        /{command.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selected && selected.subcommands.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Subcommand</p>
                  <Select value={subcommand} onValueChange={setSubcommand}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select subcommand" />
                    </SelectTrigger>
                    <SelectContent>
                      {selected.subcommands.map((item) => (
                        <SelectItem key={`${item.name}-${item.description}`} value={item.name} className="text-xs">
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {selected ? (
              <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <code className="font-mono">/{selected.id}</code>
                  <Badge variant="outline" className="text-[9px] uppercase">{selected.category}</Badge>
                  {selected.requiresAuth ? <Badge variant="secondary" className="text-[9px] uppercase">auth</Badge> : null}
                </div>
                <p className="mt-1 text-muted-foreground">{selected.description}</p>
              </div>
            ) : null}

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Positional args</p>
              <Input
                value={freeArgs}
                onChange={(event) => setFreeArgs(event.target.value)}
                className="h-9 text-xs"
                placeholder="Optional args, e.g. session-123"
              />
            </div>

            {selected && selected.flags.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Flags</p>
                <div className="space-y-2">
                  {selected.flags.map((flag) => {
                    const value = flagDraft[flag.name];
                    if (flag.type === "boolean") {
                      return (
                        <div key={flag.name} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                          <div>
                            <p className="text-xs font-medium">--{flag.name}</p>
                            <p className="text-[10px] text-muted-foreground">boolean{flag.required ? " • required" : ""}</p>
                          </div>
                          <Switch
                            checked={value === true}
                            onCheckedChange={(checked) => setFlagDraft((prev) => ({ ...prev, [flag.name]: checked }))}
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={flag.name} className="space-y-1 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">--{flag.name} ({flag.type}){flag.required ? " *" : ""}</p>
                        <Input
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) => setFlagDraft((prev) => ({ ...prev, [flag.name]: event.target.value }))}
                          className="h-8 text-xs"
                          placeholder={`Enter ${flag.name}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Preview</p>
              <p className="mt-1 break-words font-mono text-xs text-foreground">{builtCommand || "Select a command to preview"}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Terminal mode: {mode}</p>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={runBuiltCommand} disabled={disabled || !builtCommand}>
                Run command
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function quoteFlagValue(value: string): string {
  if (!/[\s"']/.test(value)) {
    return value;
  }
  return `"${value.replace(/\"/g, "\\\"")}"`;
}
