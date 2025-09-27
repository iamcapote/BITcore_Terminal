import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { MissionTemplatesRepository } from '../app/features/missions/mission.templates.repository.mjs';
import { parse as parseYaml } from 'yaml';

const SAMPLE_TEMPLATE = `
name: Sample Mission
schedule:
  intervalMinutes: 30
priority: 5
tags:
  - ops
  - maintenance
payload:
  action: cleanup
`;

const SAMPLE_CRON_TEMPLATE = `
name: Cron Mission
schedule:
  cron: "0 9 * * 1"
  timezone: America/New_York
`;

describe('MissionTemplatesRepository', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-templates-'));
    await fs.writeFile(path.join(tempDir, 'sample.mission.yaml'), SAMPLE_TEMPLATE, 'utf8');
    await fs.writeFile(path.join(tempDir, 'cron.mission.yaml'), SAMPLE_CRON_TEMPLATE, 'utf8');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('lists templates with normalized metadata', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });
    const templates = await repository.listTemplates();

    expect(templates).toHaveLength(2);
    const sample = templates.find(template => template.slug.includes('sample'));
    expect(sample.name).toBe('Sample Mission');
    expect(sample.schedule.intervalMinutes).toBe(30);
    expect(sample.tags).toContain('ops');
  });

  it('creates a draft from template with overrides and normalization', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });
    const draft = await repository.createDraftFromTemplate('sample', {
      name: 'Custom Name',
      tags: 'custom,ops',
      priority: '7',
      enable: 'false',
      intervalMinutes: 45
    });

    expect(draft.name).toBe('Custom Name');
    expect(draft.priority).toBe(7);
    expect(draft.tags).toEqual(['custom', 'ops']);
    expect(draft.enable).toBe(false);
    expect(draft.schedule.intervalMinutes).toBe(45);
  });

  it('supports cron schedule templates', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });
    const draft = await repository.createDraftFromTemplate('cron');

    expect(draft.schedule.cron).toBe('0 9 * * 1');
    expect(draft.schedule.timezone).toBe('America/New_York');
  });

  it('returns null when requesting an unknown template', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });
    const template = await repository.getTemplate('missing');

    expect(template).toBeNull();
  });

  it('applies schedule overrides including timezone updates', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });
    const draft = await repository.createDraftFromTemplate('sample', {
      schedule: { cron: '*/5 * * * *', timezone: 'Europe/Paris' }
    });

    expect(draft.schedule.type).toBe('cron');
    expect(draft.schedule.cron).toBe('*/5 * * * *');
    expect(draft.schedule.timezone).toBe('Europe/Paris');
  });

  it('parses JSON payload overrides provided as strings', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });
    const draft = await repository.createDraftFromTemplate('sample', {
      payload: '{"action":"override","count":2}'
    });

    expect(draft.payload).toEqual({ action: 'override', count: 2 });
  });

  it('throws when payload override JSON is invalid', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });

    await expect(repository.createDraftFromTemplate('sample', {
      payload: '{invalid json}'
    })).rejects.toBeInstanceOf(SyntaxError);
  });

  it('throws when schedule overrides specify both interval and cron', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });

    await expect(repository.createDraftFromTemplate('sample', {
      schedule: { intervalMinutes: 10, cron: '0 * * * *' }
    })).rejects.toBeInstanceOf(RangeError);
  });

  it('requires a template slug when creating a draft', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });

    await expect(repository.createDraftFromTemplate('')).rejects.toBeInstanceOf(TypeError);
  });

  it('throws descriptive error when template slug is missing', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });

    await expect(repository.createDraftFromTemplate('unknown')).rejects.toThrow(/not found/);
  });

  it('bubbles schedule validation errors when loading invalid templates', async () => {
    const invalidTemplatePath = path.join(tempDir, 'invalid.mission.yaml');
    await fs.writeFile(invalidTemplatePath, 'name: Broken\nschedule: {}\n', 'utf8');
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });

    await expect(repository.listTemplates()).rejects.toBeInstanceOf(RangeError);
  });

  it('warns and returns empty list when templates directory is missing', async () => {
    const missingDir = path.join(tempDir, 'missing');
    const warnings = [];
    const logger = { warn: (...args) => warnings.push(args.join(' ')) };
    const repository = new MissionTemplatesRepository({ templatesDir: missingDir, logger });

    const templates = await repository.listTemplates();

    expect(templates).toEqual([]);
    expect(warnings.some(message => message.includes('Templates directory'))).toBe(true);
  });

  it('saves a new template to disk with derived slug', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });
    const saved = await repository.saveTemplate({
      name: 'Adhoc Audit Sweep',
      schedule: { intervalMinutes: 45, timezone: 'UTC' },
      tags: ['ops', 'audit'],
      priority: 6,
      enable: false,
      payload: { action: 'audit', severity: 'medium' }
    });

    expect(saved.slug).toBe('adhoc-audit-sweep');
    const filePath = path.join(tempDir, 'adhoc-audit-sweep.mission.yaml');
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = parseYaml(raw);
    expect(parsed.name).toBe('Adhoc Audit Sweep');
    expect(parsed.schedule.intervalMinutes).toBe(45);
    expect(parsed.tags).toContain('ops');
    expect(parsed.enable).toBe(false);

    const reloaded = await repository.getTemplate('adhoc-audit-sweep');
    expect(reloaded.name).toBe('Adhoc Audit Sweep');
    expect(reloaded.schedule.intervalMinutes).toBe(45);
    expect(reloaded.enable).toBe(false);
  });

  it('updates an existing template with schedule changes', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });
    const updated = await repository.saveTemplate({
      slug: 'sample',
      cron: '*/10 * * * *',
      timezone: 'America/Los_Angeles',
      tags: ['ops', 'cron'],
      enable: true
    });

    expect(updated.schedule.cron).toBe('*/10 * * * *');
    expect(updated.schedule.timezone).toBe('America/Los_Angeles');
    expect(updated.tags).toContain('cron');

    const raw = await fs.readFile(path.join(tempDir, 'sample.mission.yaml'), 'utf8');
    const parsed = parseYaml(raw);
    expect(parsed.schedule.cron).toBe('*/10 * * * *');
    expect(parsed.schedule.timezone).toBe('America/Los_Angeles');
  });

  it('deletes an existing template and removes file from disk', async () => {
    const repository = new MissionTemplatesRepository({ templatesDir: tempDir });
    const targetPath = path.join(tempDir, 'cron.mission.yaml');
  await repository.deleteTemplate('cron');

  await expect(fs.access(targetPath)).rejects.toThrow();
    const template = await repository.getTemplate('cron');
    expect(template).toBeNull();
  });
});
