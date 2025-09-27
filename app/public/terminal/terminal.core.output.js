/**
 * Terminal Core Output
 * Why: Provide consistent rendering helpers for appending and updating terminal lines.
 * What: Extends the Terminal prototype with DOM utilities for output, updates, and AI response formatting.
 * How: Mirrors legacy behaviour while staying framework-free and composable.
 */
(function extendTerminalCoreOutput(global) {
  if (!global.Terminal || typeof global.Terminal !== 'function') {
    console.error('[terminal.core.output] Terminal constructor missing on window.');
    return;
  }

  const { Terminal } = global;

  Object.assign(Terminal.prototype, {
    appendOutput(value, type = 'output-default') {
      const container = this.outputArea;
      if (!container) {
        return;
      }

      const line = document.createElement('div');
      line.className = `terminal-line ${type}`;

      if (typeof value === 'object' && value !== null) {
        try {
          line.textContent = JSON.stringify(value, null, 2);
          line.classList.add('json-output');
        } catch (error) {
          line.textContent = String(value);
        }
      } else {
        line.innerHTML = String(value ?? '').replace(/\n/g, '<br>');
      }

      container.appendChild(line);
      this.scrollToBottom();
    },

    updateLastLine(value) {
      if (!this.outputArea) {
        return;
      }

      const lines = this.outputArea.getElementsByClassName('terminal-line');
      const text = String(value ?? '');
      const isPinnedToBottom = this.outputArea.scrollTop + this.outputArea.clientHeight >= this.outputArea.scrollHeight - 2;

      if (lines.length === 0) {
        this.appendOutput(text);
      } else {
        const lastLine = lines[lines.length - 1];
        lastLine.textContent = text;
      }

      if (isPinnedToBottom) {
        window.clearTimeout(this.scrollTimeout);
        this.scrollTimeout = window.setTimeout(() => {
          this.scrollToBottom();
        }, 50);
      }
    },

    displayAiResponse(content) {
      const container = this.outputArea;
      if (!container) {
        return;
      }

      const raw = String(content ?? '');
      const thinkingMatch = raw.match(/<(thinking|think)\s*>([\s\S]*?)<\/\s*(thinking|think)\s*>/i);

      if (thinkingMatch) {
        const [, , thinking] = thinkingMatch;
        if (thinking && thinking.trim()) {
          const thinkingLine = document.createElement('div');
          thinkingLine.className = 'terminal-line thinking-line';
          thinkingLine.innerHTML = `<span class="thinking-header">[thinking]</span><br>${thinking.trim().replace(/\n/g, '<br>')}`;
          container.appendChild(thinkingLine);

          const spacer = document.createElement('div');
          spacer.className = 'terminal-line-spacer';
          spacer.innerHTML = '&nbsp;';
          container.appendChild(spacer);
        }

        const reply = raw.replace(thinkingMatch[0], '').trim();
        if (reply) {
          const replyLine = document.createElement('div');
          replyLine.className = 'terminal-line reply-line';
          replyLine.innerHTML = `<span class="reply-header">[reply]</span><br>${reply.replace(/\n/g, '<br>')}`;
          container.appendChild(replyLine);
        }
      } else if (raw.trim()) {
        const line = document.createElement('div');
        line.className = 'terminal-line reply-line';
        line.innerHTML = `<span class="reply-header">[reply]</span><br>${raw.replace(/\n/g, '<br>')}`;
        container.appendChild(line);
      }

      this.scrollToBottom();
  },
  });

  if (!Terminal.prototype._displayAiResponse) {
    Terminal.prototype._displayAiResponse = Terminal.prototype.displayAiResponse;
  }
})(window);
