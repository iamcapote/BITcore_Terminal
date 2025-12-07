/**
 * @license INTERNAL ONLY — WebComm client (Nova)
 *
 * Why: Reuse the backend command and telemetry stream inside Nova without depending on the legacy global bundle.
 * What: Lightweight WebSocket client that exposes command helpers and typed message handlers for terminal surfaces.
 * How: Wraps browser WebSocket APIs, normalizes message dispatch, and surfaces a small event emitter interface.
 */

export interface WebCommMessage {
  readonly type: string;
  readonly [key: string]: unknown;
}

export type WebCommHandler<TMessage extends WebCommMessage = WebCommMessage> = (message: TMessage) => void;

export interface WebCommOptions {
  readonly url: string;
}

export class WebCommClient {
  private readonly url: string;

  private ws: WebSocket | null = null;

  private readonly handlers = new Map<string, Set<WebCommHandler>>();

  private connectPromise: Promise<void> | null = null;

  private resolveConnect: (() => void) | null = null;

  private rejectConnect: ((error: Error) => void) | null = null;

  private isClosing = false;

  constructor(options: WebCommOptions) {
    if (!options?.url) {
      throw new Error("WebCommClient requires a WebSocket url.");
    }
    this.url = options.url;
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  get isConnecting(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.CONNECTING;
  }

  connect(): Promise<void> {
    if (this.isConnected) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.isClosing = false;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.resolveConnect = resolve;
      this.rejectConnect = reject;
    });

    try {
      this.ws = new WebSocket(this.url);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.cleanupConnect(err);
      return Promise.reject(err);
    }

    this.ws.addEventListener("open", () => {
      this.emit({ type: "connection", connected: true });
      this.cleanupConnect();
    });

    this.ws.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    this.ws.addEventListener("error", (event) => {
      console.error("[WebCommClient] WebSocket error", event);
      this.emit({ type: "error", error: "WebSocket error" });
    });

    this.ws.addEventListener("close", (event) => {
      this.handleClose(event);
    });

    return this.connectPromise;
  }

  close(code?: number, reason?: string): void {
    this.isClosing = true;
    if (this.ws) {
      this.ws.close(code ?? 1000, reason ?? "Client closing connection");
    }
  }

  on<TMessage extends WebCommMessage = WebCommMessage>(type: string, handler: WebCommHandler<TMessage>): () => void {
    if (!type || typeof handler !== "function") {
      return () => undefined;
    }
    const normalized = String(type);
    if (!this.handlers.has(normalized)) {
      this.handlers.set(normalized, new Set());
    }
    const set = this.handlers.get(normalized)!;
    set.add(handler as WebCommHandler);
    return () => {
      set.delete(handler as WebCommHandler);
      if (set.size === 0) {
        this.handlers.delete(normalized);
      }
    };
  }

  async sendCommand(rawCommand: string): Promise<void> {
    const trimmed = rawCommand.trim();
    if (!trimmed) {
      throw new Error("Command cannot be empty.");
    }

    const normalized = trimmed.startsWith("/") ? trimmed.substring(1) : trimmed;
    const [command, ...args] = normalized.split(/\s+/).filter((part) => part.length > 0);

    if (!command) {
      throw new Error("Missing command name.");
    }

    const payload = {
      type: "command",
      command,
      args,
    };

    await this.send(payload);
  }

  async sendChatMessage(message: string): Promise<void> {
    const text = message.trim();
    if (!text) {
      throw new Error("Chat message cannot be empty.");
    }
    await this.send({ type: "chat-message", message: text });
  }

  async sendInput(value: string): Promise<void> {
    await this.send({ type: "input", value });
  }

  async sendMessage(payload: WebCommMessage): Promise<void> {
    if (!payload || typeof payload !== "object") {
      throw new Error("Message payload must be an object.");
    }
    if (!payload.type || typeof payload.type !== "string") {
      throw new Error("Message payload requires a type property.");
    }
    await this.send(payload);
  }

  private async send(payload: unknown): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected.");
    }
    const serialized = JSON.stringify(payload);
    this.ws.send(serialized);
  }

  private cleanupConnect(error?: Error): void {
    const resolve = this.resolveConnect;
    const reject = this.rejectConnect;
    this.resolveConnect = null;
    this.rejectConnect = null;
    this.connectPromise = null;

    if (error) {
      reject?.(error);
      return;
    }
    resolve?.();
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== "string") {
      return;
    }
    try {
      const message = JSON.parse(raw) as WebCommMessage;
      if (!message || typeof message.type !== "string") {
        return;
      }
      this.emit(message);
    } catch (error) {
      console.error("[WebCommClient] Failed to parse message", error);
      this.emit({ type: "error", error: "Invalid message format" });
    }
  }

  private handleClose(event: CloseEvent): void {
    const reason = this.describeCloseReason(event);
    this.emit({ type: "connection", connected: false, reason });

    if (!this.isClosing && this.connectPromise) {
      const error = new Error(`WebSocket closed: ${reason}`);
      this.cleanupConnect(error);
    } else {
      this.cleanupConnect();
    }

    this.ws = null;
  }

  private emit(message: WebCommMessage): void {
    const listeners = this.handlers.get(message.type);
    if (!listeners || listeners.size === 0) {
      return;
    }
    listeners.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error("[WebCommClient] handler error", error);
      }
    });
  }

  private describeCloseReason(event: CloseEvent): string {
    if (event.reason) {
      return event.reason;
    }
    switch (event.code) {
      case 1000:
        return "Normal closure";
      case 1001:
        return "Going away";
      case 1002:
        return "Protocol error";
      case 1003:
        return "Unsupported data";
      case 1005:
        return "No status received";
      case 1006:
        return "Abnormal closure";
      case 1007:
        return "Invalid payload";
      case 1008:
        return "Policy violation";
      case 1009:
        return "Message too big";
      case 1010:
        return "Missing extension";
      case 1011:
        return "Internal error";
      case 1015:
        return "TLS handshake failure";
      default:
        return `Closed with code ${event.code}`;
    }
  }
}
