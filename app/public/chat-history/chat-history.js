'use strict';

(function () {
  const conversationListEl = document.getElementById('conversation-list');
  const conversationStatusEl = document.getElementById('conversation-status');
  const conversationCountEl = document.getElementById('conversation-count');
  const conversationSummaryEl = document.getElementById('conversation-summary');
  const detailStatusEl = document.getElementById('detail-status');
  const metadataEl = document.getElementById('conversation-metadata');
  const messagesEl = document.getElementById('conversation-messages');
  const searchInputEl = document.getElementById('conversation-search');
  const refreshButtonEl = document.getElementById('refresh-conversations');
  const clearButtonEl = document.getElementById('clear-conversations');
  const downloadButtonEl = document.getElementById('download-selected');
  const deleteButtonEl = document.getElementById('delete-selected');
  const retentionPolicyEl = document.getElementById('retention-policy');

  const state = {
    conversations: [],
    filtered: [],
    selectedId: null,
    retentionDays: null,
    maxMessages: null
  };

  function sanitize(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTimestamp(value) {
    if (!value) return '—';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return sanitize(value);
      return date.toLocaleString();
    } catch {
      return sanitize(value);
    }
  }

  function applyFilter() {
    const query = (searchInputEl?.value || '').trim().toLowerCase();
    if (!query) {
      state.filtered = [...state.conversations];
      return;
    }
    state.filtered = state.conversations.filter(conversation => {
      const username = conversation.user?.username || conversation.user?.id || '';
      const tags = Array.isArray(conversation.tags) ? conversation.tags.join(' ') : '';
      const origin = conversation.origin || '';
      const haystack = `${conversation.id} ${username} ${tags} ${origin}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderList() {
    conversationListEl.innerHTML = '';
    if (state.filtered.length === 0) {
      conversationStatusEl.textContent = state.conversations.length === 0
        ? 'No conversations stored.'
        : 'No conversations match the current filter.';
      conversationListEl.innerHTML = '<li class="organizer-list-empty">No conversations to display.</li>';
      disableActionButtons();
      return;
    }

    conversationStatusEl.textContent = `${state.filtered.length} conversation${state.filtered.length === 1 ? '' : 's'} shown.`;

    state.filtered.forEach(conversation => {
      const item = document.createElement('li');
      item.className = 'organizer-list-item';
      item.dataset.conversationId = conversation.id;
      if (conversation.id === state.selectedId) {
        item.classList.add('is-selected');
      }
      const tags = Array.isArray(conversation.tags) && conversation.tags.length
        ? conversation.tags.join(', ')
        : 'none';
      const userLabel = conversation.user?.username || conversation.user?.id || 'anonymous';
      item.innerHTML = `
        <div class="organizer-list-title">${sanitize(conversation.id)}</div>
        <div class="organizer-list-meta">
          <span>User: ${sanitize(userLabel)}</span>
          <span>Updated: ${sanitize(formatTimestamp(conversation.updatedAt || conversation.startedAt))}</span>
          <span>Messages: ${conversation.messageCount ?? 0}</span>
          <span>Origin: ${sanitize(conversation.origin || 'unknown')}</span>
          <span>Tags: ${sanitize(tags)}</span>
        </div>
      `;
      item.addEventListener('click', () => selectConversation(conversation.id));
      conversationListEl.appendChild(item);
    });

    updateActionButtons();
  }

  function updateSummary() {
    const total = state.conversations.length;
    conversationCountEl.textContent = total;
    if (total === 0) {
      conversationSummaryEl.textContent = 'No chat transcripts stored yet.';
    } else {
      const latest = state.conversations[0];
      const latestTime = latest ? formatTimestamp(latest.updatedAt || latest.startedAt) : '—';
      conversationSummaryEl.textContent = `Last updated ${latestTime}. ${total} conversation${total === 1 ? '' : 's'} retained.`;
    }
    if (state.retentionDays != null) {
      retentionPolicyEl.textContent = `Chat transcripts are retained for ${state.retentionDays} day${state.retentionDays === 1 ? '' : 's'} by default.`;
    }
  }

  function disableActionButtons() {
    downloadButtonEl.disabled = true;
    deleteButtonEl.disabled = true;
  }

  function updateActionButtons() {
    const hasSelection = Boolean(state.selectedId);
    downloadButtonEl.disabled = !hasSelection;
    deleteButtonEl.disabled = !hasSelection;
  }

  function renderDetail(conversation) {
    if (!conversation) {
      detailStatusEl.textContent = 'Select a conversation to inspect messages.';
      metadataEl.innerHTML = '';
      messagesEl.innerHTML = '';
      disableActionButtons();
      return;
    }

    detailStatusEl.textContent = `Reviewing ${conversation.messageCount ?? 0} message${(conversation.messageCount ?? 0) === 1 ? '' : 's'}.`;
    const userLabel = conversation.user?.username || conversation.user?.id || 'anonymous';
    const tags = Array.isArray(conversation.tags) && conversation.tags.length
      ? conversation.tags.join(', ')
      : 'none';
    metadataEl.innerHTML = `
      <dl>
        <div><dt>Conversation ID</dt><dd>${sanitize(conversation.id)}</dd></div>
        <div><dt>User</dt><dd>${sanitize(userLabel)}</dd></div>
        <div><dt>Origin</dt><dd>${sanitize(conversation.origin || 'unknown')}</dd></div>
        <div><dt>Started</dt><dd>${sanitize(formatTimestamp(conversation.startedAt))}</dd></div>
        <div><dt>Updated</dt><dd>${sanitize(formatTimestamp(conversation.updatedAt))}</dd></div>
        <div><dt>Ended</dt><dd>${sanitize(formatTimestamp(conversation.endedAt))}</dd></div>
        <div><dt>Tags</dt><dd>${sanitize(tags)}</dd></div>
        <div><dt>Messages</dt><dd>${conversation.messages?.length ?? 0}</dd></div>
      </dl>
    `;

    if (!Array.isArray(conversation.messages) || conversation.messages.length === 0) {
      messagesEl.innerHTML = '<p class="organizer-list-empty">No messages stored for this conversation.</p>';
    } else {
      messagesEl.innerHTML = conversation.messages.map(message => `
        <article class="conversation-message conversation-message-${sanitize(message.role)}">
          <header>
            <span class="conversation-message-role">${sanitize(message.role)}</span>
            <time datetime="${sanitize(message.createdAt)}">${sanitize(formatTimestamp(message.createdAt))}</time>
          </header>
          <p>${sanitize(message.content)}</p>
        </article>
      `).join('');
    }

    updateActionButtons();
  }

  async function refreshConversations() {
    conversationStatusEl.textContent = 'Loading conversations…';
    disableActionButtons();
    try {
      const response = await fetch('/api/chat/history');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      state.conversations = Array.isArray(payload.conversations) ? payload.conversations : [];
      state.retentionDays = payload.retentionDays ?? state.retentionDays;
      state.maxMessages = payload.maxMessagesPerConversation ?? state.maxMessages;
      applyFilter();
      updateSummary();
      renderList();
      if (state.selectedId) {
        await selectConversation(state.selectedId, { preserveSelection: true });
      } else {
        renderDetail(null);
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to load conversations:', error);
      conversationStatusEl.textContent = 'Failed to load conversations.';
      state.conversations = [];
      state.filtered = [];
      renderList();
    }
  }

  async function selectConversation(conversationId, { preserveSelection = false } = {}) {
    if (!conversationId) {
      state.selectedId = null;
      renderDetail(null);
      return;
    }
    state.selectedId = conversationId;
    detailStatusEl.textContent = 'Loading conversation…';
    updateActionButtons();

    try {
      const response = await fetch(`/api/chat/history/${encodeURIComponent(conversationId)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Unable to load conversation.');
      }
      renderDetail(payload.conversation);
      highlightSelected(conversationId);
    } catch (error) {
      console.error('[ChatHistory] Failed to load conversation:', error);
      detailStatusEl.textContent = 'Failed to load conversation detail.';
      if (!preserveSelection) {
        state.selectedId = null;
        renderDetail(null);
      }
    }
  }

  function highlightSelected(conversationId) {
    const items = conversationListEl.querySelectorAll('li.organizer-list-item');
    items.forEach(item => {
      if (item.dataset.conversationId === conversationId) {
        item.classList.add('is-selected');
      } else {
        item.classList.remove('is-selected');
      }
    });
  }

  async function downloadSelectedConversation() {
    if (!state.selectedId) return;
    try {
      const response = await fetch(`/api/chat/history/${encodeURIComponent(state.selectedId)}/export`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.text();
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `chat-${state.selectedId}-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[ChatHistory] Failed to export conversation:', error);
      alert('Failed to download conversation export.');
    }
  }

  async function deleteSelectedConversation() {
    if (!state.selectedId) return;
    if (!confirm('Delete this conversation permanently?')) {
      return;
    }
    try {
      const response = await fetch(`/api/chat/history/${encodeURIComponent(state.selectedId)}`, {
        method: 'DELETE'
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      state.selectedId = null;
      await refreshConversations();
      renderDetail(null);
    } catch (error) {
      console.error('[ChatHistory] Failed to delete conversation:', error);
      alert('Failed to delete conversation.');
    }
  }

  async function clearConversations() {
    const input = prompt('Clear conversations older than how many days? Leave blank to clear all.');
    if (input === null) {
      return; // cancelled
    }
    let url = '/api/chat/history';
    const cleaned = input.trim();
    if (cleaned) {
      const days = Number(cleaned);
      if (!Number.isFinite(days) || days <= 0) {
        alert('Please enter a positive number of days or leave blank.');
        return;
      }
      url += `?olderThanDays=${encodeURIComponent(days)}`;
    } else if (!confirm('Clear all stored conversations? This cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await refreshConversations();
      renderDetail(null);
    } catch (error) {
      console.error('[ChatHistory] Failed to clear conversations:', error);
      alert('Failed to clear conversations.');
    }
  }

  function bindEvents() {
    if (searchInputEl) {
      searchInputEl.addEventListener('input', () => {
        applyFilter();
        renderList();
      });
    }
    if (refreshButtonEl) {
      refreshButtonEl.addEventListener('click', () => refreshConversations());
    }
    if (clearButtonEl) {
      clearButtonEl.addEventListener('click', () => clearConversations());
    }
    if (downloadButtonEl) {
      downloadButtonEl.addEventListener('click', () => downloadSelectedConversation());
    }
    if (deleteButtonEl) {
      deleteButtonEl.addEventListener('click', () => deleteSelectedConversation());
    }
  }

  // Initialize
  bindEvents();
  refreshConversations();
})();
