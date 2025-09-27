/**
 * Express routes exposing chat history management APIs.
 */

import express from 'express';
import config from '../../config/index.mjs';
import { getChatHistoryController } from './index.mjs';

function sendError(res, status, message) {
  res.status(status).json({ success: false, error: message });
}

export function setupChatHistoryRoutes(app, { logger = console } = {}) {
  const router = express.Router();
  const controller = getChatHistoryController({ logger });

  router.get('/', async (req, res) => {
    try {
      const summaries = await controller.listConversations();
      res.json({
        success: true,
        conversations: summaries,
        retentionDays: config?.chat?.history?.retentionDays ?? null,
        maxMessagesPerConversation: config?.chat?.history?.maxMessagesPerConversation ?? null
      });
    } catch (error) {
      logger.error?.(`[ChatHistoryRoutes] Failed to list conversations: ${error.message}`);
      sendError(res, 500, 'Failed to list chat history.');
    }
  });

  router.get('/:conversationId', async (req, res) => {
    const { conversationId } = req.params;
    try {
      const conversation = await controller.getConversation(conversationId);
      if (!conversation) {
        return sendError(res, 404, `Conversation '${conversationId}' not found.`);
      }
      res.json({ success: true, conversation });
    } catch (error) {
      logger.error?.(`[ChatHistoryRoutes] Failed to load conversation ${conversationId}: ${error.message}`);
      sendError(res, 500, 'Failed to load conversation.');
    }
  });

  router.get('/:conversationId/export', async (req, res) => {
    const { conversationId } = req.params;
    try {
      const payload = await controller.exportConversation(conversationId);
      if (!payload) {
        return sendError(res, 404, `Conversation '${conversationId}' not found.`);
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${conversationId}.json"`);
      res.send(payload);
    } catch (error) {
      logger.error?.(`[ChatHistoryRoutes] Failed to export conversation ${conversationId}: ${error.message}`);
      sendError(res, 500, 'Failed to export conversation.');
    }
  });

  router.delete('/:conversationId', async (req, res) => {
    const { conversationId } = req.params;
    try {
      const removed = await controller.removeConversation(conversationId);
      if (!removed) {
        return sendError(res, 404, `Conversation '${conversationId}' not found.`);
      }
      res.json({ success: true, removed: true });
    } catch (error) {
      logger.error?.(`[ChatHistoryRoutes] Failed to delete conversation ${conversationId}: ${error.message}`);
      sendError(res, 500, 'Failed to delete conversation.');
    }
  });

  router.delete('/', async (req, res) => {
    const olderThanDaysRaw = req.query.olderThanDays;
    const olderThanDays = olderThanDaysRaw != null ? Number(olderThanDaysRaw) : undefined;
    try {
      const result = await controller.clearConversations({ olderThanDays });
      res.json({ success: true, cleared: result });
    } catch (error) {
      logger.error?.(`[ChatHistoryRoutes] Failed to clear conversations: ${error.message}`);
      sendError(res, 500, 'Failed to clear chat history.');
    }
  });

  app.use('/api/chat/history', router);
}
