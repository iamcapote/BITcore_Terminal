/**
 * Express routes exposing chat history management APIs.
 */

import express from 'express';
import config from '../../config/index.mjs';
import { getChatHistoryController } from './index.mjs';
import { createWorkspaceGitService, ValidationError as GitValidationError, NotFoundError as GitNotFoundError } from '../files/workspace-git.service.mjs';

function sendError(res, status, message) {
  res.status(status).json({ success: false, error: message });
}

export function setupChatHistoryRoutes(app, { logger = console, controller = null, gitService = null } = {}) {
  const router = express.Router();
  const historyController = controller || getChatHistoryController({ logger });
  const workspaceGitService = gitService || createWorkspaceGitService();

  router.get('/', async (req, res) => {
    try {
      const summaries = await historyController.listConversations();
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
      const conversation = await historyController.getConversation(conversationId);
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
      const payload = await historyController.exportConversation(conversationId);
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
      const removed = await historyController.removeConversation(conversationId);
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
      const result = await historyController.clearConversations({ olderThanDays });
      res.json({ success: true, cleared: result });
    } catch (error) {
      logger.error?.(`[ChatHistoryRoutes] Failed to clear conversations: ${error.message}`);
      sendError(res, 500, 'Failed to clear chat history.');
    }
  });

  router.post('/:conversationId/workspace/link', async (req, res) => {
    const { conversationId } = req.params;
    const branchName = typeof req.body?.branchName === 'string' ? req.body.branchName.trim() : '';
    const baseBranch = typeof req.body?.baseBranch === 'string' && req.body.baseBranch.trim() ? req.body.baseBranch.trim() : null;
    const createBranch = req.body?.createBranch === true;
    const checkout = req.body?.checkout !== false;

    if (!branchName) {
      return sendError(res, 400, 'branchName is required.');
    }

    try {
      if (createBranch) {
        await workspaceGitService.createBranch(branchName, baseBranch);
      }
      if (checkout) {
        await workspaceGitService.checkoutBranch(branchName);
      }
      const workspace = await historyController.linkWorkspaceBranch(conversationId, {
        branchName,
        baseBranch,
      });
      const snapshot = await historyController.appendWorkspaceSnapshot(conversationId, {
        type: createBranch ? 'branch-linked-created' : 'branch-linked',
        branchName,
        note: createBranch
          ? `Branch '${branchName}' linked to conversation and created in workspace.`
          : `Branch '${branchName}' linked to conversation.`,
      });

      res.json({
        success: true,
        workspace,
        snapshot,
      });
    } catch (error) {
      if (error instanceof TypeError || error instanceof GitValidationError) {
        return sendError(res, 400, error.message);
      }
      if (error.message?.includes('not found')) {
        return sendError(res, 404, error.message);
      }
      if (error instanceof GitNotFoundError) {
        return sendError(res, 404, error.message);
      }
      logger.error?.(`[ChatHistoryRoutes] Failed to link workspace branch for ${conversationId}: ${error.message}`);
      sendError(res, 500, 'Failed to link workspace branch.');
    }
  });

  router.post('/:conversationId/workspace/snapshots', async (req, res) => {
    const { conversationId } = req.params;
    try {
      const snapshot = await historyController.appendWorkspaceSnapshot(conversationId, req.body ?? {});
      res.json({ success: true, snapshot });
    } catch (error) {
      if (error instanceof TypeError) {
        return sendError(res, 400, error.message);
      }
      if (error.message?.includes('not found')) {
        return sendError(res, 404, error.message);
      }
      logger.error?.(`[ChatHistoryRoutes] Failed to append workspace snapshot for ${conversationId}: ${error.message}`);
      sendError(res, 500, 'Failed to append workspace snapshot.');
    }
  });

  router.get('/:conversationId/workspace/snapshots', async (req, res) => {
    const { conversationId } = req.params;
    try {
      const snapshots = await historyController.listWorkspaceSnapshots(conversationId);
      res.json({ success: true, snapshots });
    } catch (error) {
      if (error.message?.includes('not found')) {
        return sendError(res, 404, error.message);
      }
      logger.error?.(`[ChatHistoryRoutes] Failed to list workspace snapshots for ${conversationId}: ${error.message}`);
      sendError(res, 500, 'Failed to list workspace snapshots.');
    }
  });

  app.use('/api/chat/history', router);
}
