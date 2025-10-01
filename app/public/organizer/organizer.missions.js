/**
 * Organizer Missions Module
 * Why: Encapsulate mission fetching, rendering, and interactions for the organizer dashboard.
 * What: Exposes load/render handlers and list interaction callbacks via `organizerMissions`.
 * How: Uses shared organizer state, DOM references, utilities, and scheduler messaging helpers.
 */
(function initializeOrganizerMissions(global) {
  if (!global) {
    return;
  }

  const state = global.organizerState;
  const els = global.organizerEls;
  const utils = global.organizerUtils;
  const scheduler = global.organizerScheduler;

  if (!state || !els || !utils || !scheduler) {
    return;
  }

  async function loadMissions(force = false) {
    if (state.missionsLoading && !force) {
      return;
    }
    state.missionsLoading = true;
    state.missionsError = null;
    renderMissionList();

    try {
      const response = await fetch('/api/missions');
      if (!response.ok) {
        throw new Error(`Failed to load missions (${response.status})`);
      }
      const payload = await response.json();
      state.missions = Array.isArray(payload?.missions) ? payload.missions : [];
      state.missionsError = null;
    } catch (error) {
      state.missions = [];
      state.missionsError = error.message;
    } finally {
      state.missionsLoading = false;
      renderMissionList();
      renderMissionSummary();
    }
  }

  function renderMissionList() {
    if (!els.missionList) return;

    els.missionList.innerHTML = '';

    if (state.missionsLoading) {
      if (els.missionsStatus) {
        els.missionsStatus.textContent = 'Loading missions…';
      }
      utils.appendEmptyState(els.missionList, 'Loading missions…');
      return;
    }

    if (state.missionsError) {
      if (els.missionsStatus) {
        els.missionsStatus.textContent = state.missionsError;
      }
      utils.appendEmptyState(els.missionList, state.missionsError);
      return;
    }

    if (!state.missions.length) {
      if (els.missionsStatus) {
        els.missionsStatus.textContent = 'No missions configured yet. Use the CLI to add missions from templates.';
      }
      utils.appendEmptyState(els.missionList, 'No missions configured.');
      return;
    }

    if (els.missionsStatus) {
      els.missionsStatus.textContent = `${state.missions.length} mission${state.missions.length === 1 ? '' : 's'} loaded.`;
    }

    state.missions
      .slice()
      .sort((a, b) => (a.priority ?? 0) === (b.priority ?? 0)
        ? (Date.parse(a.nextRunAt || 0) || 0) - (Date.parse(b.nextRunAt || 0) || 0)
        : (b.priority ?? 0) - (a.priority ?? 0))
      .forEach((mission) => {
        const item = document.createElement('li');
        item.className = 'organizer-mission';
        item.dataset.id = mission.id;

        const header = document.createElement('div');
        header.className = 'organizer-mission-header';

        const title = document.createElement('h3');
        title.textContent = mission.name || mission.id;
        header.appendChild(title);

        const status = document.createElement('span');
        status.className = 'organizer-status';
        status.dataset.status = mission.status || 'unknown';
        status.textContent = utils.formatStatus(mission.status);
        header.appendChild(status);
        item.appendChild(header);

        if (mission.description) {
          const description = document.createElement('p');
          description.className = 'organizer-mission-description';
          description.textContent = mission.description;
          item.appendChild(description);
        }

        const metaList = document.createElement('ul');
        metaList.className = 'organizer-mission-meta';

        metaList.appendChild(createMetaItem('Next Run', mission.nextRunAt ? utils.formatRelativeTime(mission.nextRunAt) : 'Not scheduled'));
        metaList.appendChild(createMetaItem('Priority', Number.isFinite(mission.priority) ? mission.priority : '0'));
        metaList.appendChild(createMetaItem('Schedule', utils.describeSchedule(mission.schedule)));
        if (mission.lastRunAt) {
          metaList.appendChild(createMetaItem('Last Run', utils.formatRelativeTime(mission.lastRunAt)));
        }
        if (mission.lastRunError) {
          metaList.appendChild(createMetaItem('Last Error', mission.lastRunError));
        }
        item.appendChild(metaList);

        if (Array.isArray(mission.tags) && mission.tags.length) {
          const tagRow = document.createElement('div');
          tagRow.className = 'organizer-tag-row';
          mission.tags.forEach((tag) => {
            const chip = document.createElement('span');
            chip.className = 'organizer-tag';
            chip.textContent = tag;
            tagRow.appendChild(chip);
          });
          item.appendChild(tagRow);
        }

        const footer = document.createElement('div');
        footer.className = 'organizer-mission-footer';

        const runButton = document.createElement('button');
        runButton.type = 'button';
        runButton.className = 'memory-secondary-btn organizer-run-btn';
        runButton.dataset.action = 'run-mission';
        runButton.dataset.id = mission.id;
        runButton.textContent = 'Run Now';
        if (mission.status === 'running') {
          runButton.disabled = true;
          runButton.textContent = 'Running…';
        } else if (mission.enable === false || mission.status === 'disabled') {
          runButton.disabled = true;
          runButton.textContent = 'Disabled';
        }
        footer.appendChild(runButton);

        item.appendChild(footer);
        els.missionList.appendChild(item);
      });
  }

  function createMetaItem(label, value) {
    const entry = document.createElement('li');
    const term = document.createElement('span');
    term.className = 'organizer-meta-label';
    term.textContent = label;
    const val = document.createElement('span');
    val.className = 'organizer-meta-value';
    val.textContent = value;
    entry.append(term, val);
    return entry;
  }

  async function handleMissionListClick(event) {
    const button = event.target.closest('button[data-action="run-mission"]');
    if (!button) return;

    const missionId = button.dataset.id;
    if (!missionId) return;

    button.disabled = true;
    button.textContent = 'Running…';
    try {
      const response = await fetch('/api/missions/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId })
      });
      if (!response.ok) {
        const details = await utils.readError(response);
        throw new Error(details || `Run failed (${response.status})`);
      }
      scheduler.announceSchedulerMessage(`Mission ${missionId} dispatched.`, 'success');
    } catch (error) {
      scheduler.announceSchedulerMessage(error.message || 'Failed to run mission.', 'error');
    } finally {
      await loadMissions(true);
    }
  }

  function renderMissionSummary() {
    const total = state.missions.length;
    const running = state.missions.filter((mission) => mission.status === 'running').length;
    const disabled = state.missions.filter((mission) => mission.status === 'disabled').length;
    const queued = state.missions.filter((mission) => mission.status === 'queued').length;

    if (els.missionCount) {
      els.missionCount.textContent = total.toString();
    }
    if (state.missionsLoading) {
      if (els.missionSummary) {
        els.missionSummary.textContent = 'Loading missions…';
      }
      return;
    }
    if (state.missionsError) {
      if (els.missionSummary) {
        els.missionSummary.textContent = state.missionsError;
      }
      return;
    }
    if (!total) {
      if (els.missionSummary) {
        els.missionSummary.textContent = 'No missions defined. Use /missions create to add one.';
      }
      return;
    }
    const parts = [];
    if (running) parts.push(`${running} running`);
    if (queued) parts.push(`${queued} queued`);
    if (disabled) parts.push(`${disabled} disabled`);
    if (!parts.length) {
      parts.push('All missions idle');
    }
    if (els.missionSummary) {
      els.missionSummary.textContent = parts.join(' • ');
    }
  }

  global.organizerMissions = {
    loadMissions,
    renderMissionList,
    renderMissionSummary,
    handleMissionListClick
  };
})(typeof window !== 'undefined' ? window : undefined);
