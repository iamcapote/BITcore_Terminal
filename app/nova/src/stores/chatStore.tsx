import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatAttachment {
  readonly id: string;
  readonly label: string;
  readonly type: "file" | "memory" | "link";
  readonly description?: string;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly createdAt: Date;
  readonly tokens?: number;
  readonly attachments?: readonly ChatAttachment[];
  readonly status?: "streaming" | "complete";
}

export interface ChatConversation {
  readonly id: string;
  readonly title: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly pinned?: boolean;
  readonly tags?: readonly string[];
  readonly summary?: string;
  readonly messages: ChatMessage[];
}

export interface ChatModel {
  readonly id: string;
  readonly label: string;
  readonly provider: string;
  readonly contextWindow: string;
  readonly supportsTools: boolean;
  readonly temperatureRange: readonly [number, number];
}

export interface ChatPreferences {
  readonly streaming: boolean;
  readonly temperature: number;
  readonly topP: number;
  readonly attachmentsEnabled: boolean;
}

export type ChatEvent =
  | { readonly type: "conversation:selected"; readonly conversationId: string }
  | { readonly type: "message:sent"; readonly conversationId: string; readonly message: ChatMessage };

export type ChatEventListener = (event: ChatEvent) => void;

interface ChatStoreState {
  readonly conversations: readonly ChatConversation[];
  readonly activeConversationId: string;
  readonly models: readonly ChatModel[];
  readonly activeModelId: string;
  readonly preferences: ChatPreferences;
  selectConversation: (id: string) => void;
  createConversation: (title?: string) => string;
  sendMessage: (content: string) => Promise<void>;
  setActiveModel: (modelId: string) => void;
  updatePreferences: (patch: Partial<ChatPreferences>) => void;
  registerListener: (listener: ChatEventListener) => () => void;
}

const ChatContext = createContext<ChatStoreState | undefined>(undefined);

const MODELS: ChatModel[] = [
  { id: "gpt-5-studio", label: "GPT-5 Studio", provider: "OpenAI", contextWindow: "200k", supportsTools: true, temperatureRange: [0, 1] },
  { id: "sonnet-4", label: "Claude Sonnet", provider: "Anthropic", contextWindow: "150k", supportsTools: true, temperatureRange: [0, 1] },
  { id: "deepseek-r1", label: "DeepSeek R1", provider: "DeepSeek", contextWindow: "128k", supportsTools: false, temperatureRange: [0, 1] },
];

const MOCK_CONVERSATIONS: ChatConversation[] = [
  {
    id: "conv-nova",
    title: "Nova parity plan",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15),
    pinned: true,
    tags: ["planning", "gui"],
    summary: "Checklist for aligning Nova surfaces with CLI behaviours.",
    messages: [
      {
        id: "msg-1",
        role: "system",
        content: "You are the Nova workspace strategist. Maintain CLI ↔ web parity and respect guardrails.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
      {
        id: "msg-2",
        role: "user",
        content: "Map legacy GUI tabs into the Nova shell. Highlight missing mission and research panes.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
      {
        id: "msg-3",
        role: "assistant",
        content: "Start by recreating Mission Control, Memory Timeline, and Logs surfaces in the Studio stage.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2 + 30_000),
        attachments: [
          { id: "att-1", label: "Mission checklist", type: "file" },
        ],
      },
    ],
  },
  {
    id: "conv-rag",
    title: "Vector hygiene",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    tags: ["knowledge"],
    messages: [
      {
        id: "msg-4",
        role: "user",
        content: "Summarize vector store health and outline nightly sync SOP.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      },
      {
        id: "msg-5",
        role: "assistant",
        content: "Vectors show 3% growth over 24h. Schedule GPU window before midnight sync.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12 + 45_000),
      },
    ],
  },
];

const defaultPreferences: ChatPreferences = {
  streaming: true,
  temperature: 0.2,
  topP: 0.9,
  attachmentsEnabled: true,
};

const createId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `chat-${Math.random().toString(36).slice(2, 9)}`);

export interface ChatProviderProps extends PropsWithChildren {}

export function ChatProvider({ children }: ChatProviderProps): JSX.Element {
  const [conversations, setConversations] = useState<ChatConversation[]>(MOCK_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string>(MOCK_CONVERSATIONS[0]?.id ?? "");
  const [activeModelId, setActiveModelId] = useState<string>(MODELS[0].id);
  const [preferences, setPreferences] = useState<ChatPreferences>(defaultPreferences);
  const listeners = useRef(new Set<ChatEventListener>());

  const publish = useCallback((event: ChatEvent) => {
    listeners.current.forEach((listener) => listener(event));
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    publish({ type: "conversation:selected", conversationId: id });
  }, [publish]);

  const createConversation = useCallback((title?: string) => {
    const id = createId();
    const now = new Date();
    const conversation: ChatConversation = {
      id,
      title: title ?? "New conversation",
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: createId(),
          role: "system",
          content: "You are the Nova co-pilot. Coordinate with backend services once connected.",
          createdAt: now,
        },
      ],
    };
    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(id);
    publish({ type: "conversation:selected", conversationId: id });
    return id;
  }, [publish]);

  const sendMessage = useCallback(async (content: string) => {
    let targetConversationId = activeConversationId;
    if (!targetConversationId) {
      targetConversationId = createConversation();
    }

    const now = new Date();
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content,
      createdAt: now,
    };

    const applyMessage = (messages: ChatMessage[], message: ChatMessage) => [...messages, message];

    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== targetConversationId) return conversation;
        return {
          ...conversation,
          updatedAt: now,
          messages: applyMessage(conversation.messages, userMessage),
        };
      }),
    );
    publish({ type: "message:sent", conversationId: targetConversationId, message: userMessage });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const assistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      content: `Model ${activeModelId} acknowledges the request. Backend execution is stubbed during Step 1.`,
      createdAt: new Date(),
    };

    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== targetConversationId) return conversation;
        return {
          ...conversation,
          updatedAt: assistantMessage.createdAt,
          messages: applyMessage(conversation.messages, assistantMessage),
        };
      }),
    );
    publish({ type: "message:sent", conversationId: targetConversationId, message: assistantMessage });
  }, [activeConversationId, activeModelId, createConversation, publish]);

  const setActiveModel = useCallback((modelId: string) => {
    setActiveModelId(modelId);
  }, []);

  const updatePreferences = useCallback((patch: Partial<ChatPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const registerListener = useCallback<ChatStoreState["registerListener"]>((listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const value = useMemo<ChatStoreState>(
    () => ({
      conversations,
      activeConversationId,
      models: MODELS,
      activeModelId,
      preferences,
      selectConversation,
      createConversation,
      sendMessage,
      setActiveModel,
      updatePreferences,
      registerListener,
    }),
    [
      conversations,
      activeConversationId,
      activeModelId,
      preferences,
      selectConversation,
      createConversation,
      sendMessage,
      setActiveModel,
      updatePreferences,
      registerListener,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatStore(): ChatStoreState {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatStore must be used within a ChatProvider");
  }
  return context;
}
