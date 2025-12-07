/**
 * @license INTERNAL ONLY — Chat history client tests
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
	deleteChatConversation,
	exportChatConversation,
	getChatConversation,
	listChatConversations,
} from "@/modules/chat/chatHistoryClient";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("chatHistoryClient", () => {
	it("lists conversations and normalizes optional fields", async () => {
		const payload = {
			success: true,
			conversations: [
				{
					id: "abc",
					origin: "terminal",
					tags: ["one", "two"],
					startedAt: "2025-11-01T12:00:00Z",
					updatedAt: "2025-11-01T12:05:00Z",
					messageCount: 5,
					user: { id: "user-1", username: "operator" },
				},
			],
			retentionDays: 30,
			maxMessagesPerConversation: 200,
		};
		const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await listChatConversations();

		expect(result.conversations).toHaveLength(1);
		expect(result.conversations[0]).toMatchObject({
			id: "abc",
			origin: "terminal",
			tags: ["one", "two"],
			messageCount: 5,
			user: { id: "user-1", username: "operator" },
		});
		expect(result.retentionDays).toBe(30);
		expect(result.maxMessagesPerConversation).toBe(200);
		expect(fetchMock).toHaveBeenCalledWith("/api/chat/history", { credentials: "include" });
	});

	it("throws when list endpoint returns error", async () => {
		const payload = { success: false, error: "boom" };
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 500 })),
		);

		await expect(listChatConversations()).rejects.toThrow(/boom/i);
	});

	it("fetches detail, export, and delete flows", async () => {
		const detailPayload = {
			success: true,
			conversation: {
				id: "xyz",
				origin: null,
				tags: [],
				messages: [
					{ id: "m1", role: "assistant", content: "hello", createdAt: "2025-11-02T10:00:00Z" },
				],
			},
		};
		const exportPayload = JSON.stringify({ id: "xyz" });

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify(detailPayload), { status: 200 }))
			.mockResolvedValueOnce(new Response(exportPayload, { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const detail = await getChatConversation("xyz");
		expect(detail.id).toBe("xyz");
		expect(detail.messages).toHaveLength(1);

		const exportResult = await exportChatConversation("xyz");
		expect(exportResult).toBe(exportPayload);

		await expect(deleteChatConversation("xyz")).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/chat/history/xyz", { credentials: "include" });
		expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/chat/history/xyz/export", { credentials: "include" });
		expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/chat/history/xyz", { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" } });
	});
});
