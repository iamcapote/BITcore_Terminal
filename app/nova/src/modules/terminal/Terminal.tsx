/**
 * @license INTERNAL ONLY — Terminal console components
 *
 * Why: Reuse the Bitcore command console across Nova surfaces without repeating wiring logic.
 * What: Exposes a composable terminal console and shortcut bar bound to the TerminalContext state machine.
 * How: Renders the live history stream, handles prompt interactions, and delegates command dispatchers to the context.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { KeyRound, Undo2 } from "lucide-react";
import { useTerminal } from "@/modules/terminal/TerminalContext";

interface TerminalConsoleProps {
	readonly className?: string;
	readonly focusInputOnMount?: boolean;
}

/** TerminalConsole renders the live command stream with prompt handling. */
export function TerminalConsole({ className, focusInputOnMount = false }: TerminalConsoleProps): JSX.Element {
	const {
		history,
		prompt,
		runCommand,
		clearHistory,
		connection,
		inputEnabled,
		promptRequest,
		respondToPrompt,
		cancelPrompt,
		reconnect,
	} = useTerminal();
	const historyContainerRef = useRef<HTMLDivElement | null>(null);
	const commandInputRef = useRef<HTMLInputElement | null>(null);
	const [promptValue, setPromptValue] = useState("");
	const inputBlocked = Boolean(promptRequest) || !inputEnabled;

	useEffect(() => {
		setPromptValue("");
	}, [promptRequest?.id]);

	useEffect(() => {
		const container = historyContainerRef.current;
		if (!container) return;
		container.scrollTop = container.scrollHeight;
	}, [history]);

	useEffect(() => {
		if (!focusInputOnMount) {
			return;
		}
		commandInputRef.current?.focus();
	}, [focusInputOnMount]);

	const statusLabel = useMemo(() => {
		if (!connection.connected) {
			return connection.reason ? `Connection lost: ${connection.reason}` : "Connection lost.";
		}
		if (promptRequest) {
			return "Awaiting secure input before continuing.";
		}
		if (inputEnabled) {
			return "Type a command and press Enter.";
		}
		return "Finishing the previous command.";
	}, [connection.connected, connection.reason, inputEnabled, promptRequest]);

	const handleCommandSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const value = (formData.get("command") ?? "").toString();
		runCommand(value);
		event.currentTarget.reset();
		commandInputRef.current?.focus();
	};

	const handlePromptSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void respondToPrompt(promptValue);
		setPromptValue("");
	};

	const entries = history.length > 0 ? history : [];

	return (
		<div
			className={cn(
				"flex flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-background/80",
				className,
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
				<div className="flex items-center gap-3">
					<span className={cn("inline-flex items-center gap-2", connection.connected ? "text-emerald-300" : "text-destructive")}
					>
						<span className="flex h-2 w-2 items-center justify-center">
							<span className={cn("h-2 w-2 rounded-full", connection.connected ? "bg-emerald-400" : "bg-red-500")} />
						</span>
						{connection.connected ? "Connected" : connection.reason ?? "Disconnected"}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant={inputEnabled && connection.connected ? "outline" : "secondary"} className="h-5 px-2 text-[10px] tracking-[0.25em]">
						{inputEnabled && connection.connected ? "READY" : promptRequest ? "PROMPT" : "BUSY"}
					</Badge>
					{!connection.connected ? (
						<Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => void reconnect()}>
							Reconnect
						</Button>
					) : null}
					<Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={clearHistory}>
						<Undo2 className="mr-1 h-3.5 w-3.5" /> Reset
					</Button>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto px-3 py-2">
				<div
					ref={historyContainerRef}
					aria-live="polite"
					className="space-y-2 text-xs font-mono leading-relaxed"
				>
					{entries.length === 0 ? (
						<p className="text-muted-foreground/70">No terminal history yet.</p>
					) : (
						entries.map((entry) => (
							<p
								key={entry.id}
								className={cn(
									"whitespace-pre-wrap",
									entry.role === "input" && "text-emerald-300",
									entry.role === "output" && "text-foreground",
									entry.role === "system" && "text-muted-foreground",
								)}
							>
								{entry.text}
							</p>
						))
					)}
				</div>
			</div>
			{promptRequest ? (
				<div className="border-t border-border/60 px-3 py-2">
					<p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<KeyRound className="h-4 w-4" /> {promptRequest.message}
					</p>
					<form className="mt-2 flex items-center gap-2" onSubmit={handlePromptSubmit}>
						<Input
							type={promptRequest.isPassword ? "password" : "text"}
							value={promptValue}
							onChange={(event) => setPromptValue(event.target.value)}
							autoFocus
							placeholder="Enter response"
							className="h-9 flex-1"
						/>
						<div className="flex items-center gap-2">
							<Button type="submit" size="sm">
								Submit
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => {
									setPromptValue("");
									void cancelPrompt();
								}}
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			) : null}
			<div className="border-t border-border/60 px-3 py-2">
				<form className="flex items-center gap-2" onSubmit={handleCommandSubmit}>
					<span className="font-mono text-xs text-muted-foreground" aria-hidden>
						{prompt}
					</span>
					<Input
						name="command"
						placeholder="Run a command"
						className={cn(
							"h-9 flex-1 border-0 bg-transparent px-2 text-xs",
							"focus-visible:ring-0 focus-visible:ring-offset-0",
							"disabled:opacity-80 disabled:text-muted-foreground",
						)}
						aria-label="Terminal command input"
						disabled={inputBlocked}
						ref={commandInputRef}
					/>
				</form>
				<p className="mt-1 text-[11px] text-muted-foreground">
					{statusLabel}
				</p>
			</div>
		</div>
	);
}

interface TerminalShortcutBarProps {
	readonly className?: string;
}

/** TerminalShortcutBar lists quick-launch commands bound to the terminal context. */
export function TerminalShortcutBar({ className }: TerminalShortcutBarProps): JSX.Element | null {
	const { shortcuts, runCommand, inputEnabled, promptRequest } = useTerminal();
	const disabled = !inputEnabled || Boolean(promptRequest);

	if (!shortcuts || shortcuts.length === 0) {
		return null;
	}

	return (
		<div className={cn("rounded-lg border border-border/60 bg-background/80 p-3", className)}>
			<div className="mb-3 flex items-center justify-between gap-2">
				<p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Quick Commands</p>
				<Badge variant={disabled ? "secondary" : "outline"} className="h-5 px-2 text-[10px] tracking-[0.25em]">
					{disabled ? "BUSY" : "READY"}
				</Badge>
			</div>
			<div className="grid gap-2 sm:grid-cols-3">
				{shortcuts.map((shortcut) => {
					const Icon = shortcut.icon;
					return (
						<Button
							key={shortcut.id}
							type="button"
							variant="outline"
							size="sm"
							className="justify-start gap-2 text-xs"
							disabled={disabled}
							onClick={() => runCommand(shortcut.command)}
						>
							<Icon className="h-3.5 w-3.5" />
							<span className="font-mono text-xs">{shortcut.command}</span>
							<span className="ml-auto text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
								{shortcut.label}
							</span>
						</Button>
					);
				})}
			</div>
		</div>
	);
}

