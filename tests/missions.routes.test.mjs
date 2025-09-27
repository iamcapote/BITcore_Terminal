import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupMissionRoutes } from '../app/features/missions/routes.mjs';

const missionConfigMock = {
  enabled: true,
  httpEnabled: true,
  schedulerEnabled: true,
  telemetryEnabled: true,
};

const controllerMock = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const schedulerMock = {
  runMission: vi.fn(),
  trigger: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  getState: vi.fn(() => ({ running: false })),
  isRunning: vi.fn(() => false),
};

const templatesRepositoryMock = {
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn()
};

let app;
const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('mission routes', () => {
  beforeEach(() => {
    Object.values(controllerMock).forEach(mock => mock?.mockReset?.());
    Object.values(schedulerMock).forEach(mock => mock?.mockReset?.());
    schedulerMock.getState.mockReturnValue({ running: false });
    schedulerMock.isRunning.mockReturnValue(false);
    Object.values(templatesRepositoryMock).forEach(mock => mock?.mockReset?.());

    app = express();
    app.use(express.json());
    setupMissionRoutes(app, {
      missionConfig: missionConfigMock,
      controller: controllerMock,
      scheduler: schedulerMock,
      templatesRepository: templatesRepositoryMock,
      logger: loggerMock,
    });
  });

  it('creates missions via POST /api/missions', async () => {
    const mission = { id: 'm-1', name: 'Ops Sync', schedule: { intervalMinutes: 60 } };
    controllerMock.create.mockResolvedValueOnce(mission);

    const response = await request(app)
      .post('/api/missions')
      .send({ name: 'Ops Sync', schedule: { intervalMinutes: 60 } })
      .expect(201);

    expect(response.body.mission).toEqual(mission);
    expect(controllerMock.create).toHaveBeenCalledWith({ name: 'Ops Sync', schedule: { intervalMinutes: 60 } });
  });

  it('rejects non-object bodies on create', async () => {
    await request(app).post('/api/missions').send([]).expect(400);
    expect(controllerMock.create).not.toHaveBeenCalled();
  });

  it('updates missions via PATCH /api/missions/:id', async () => {
    const mission = { id: 'm-1', name: 'Ops Sync', enable: false };
    controllerMock.update.mockResolvedValueOnce(mission);

    const response = await request(app)
      .patch('/api/missions/m-1')
      .send({ enable: false })
      .expect(200);

    expect(response.body.mission).toEqual(mission);
    expect(controllerMock.update).toHaveBeenCalledWith('m-1', { enable: false });
  });

  it('rejects non-object bodies on update', async () => {
    await request(app).patch('/api/missions/m-1').send([]).expect(400);
    expect(controllerMock.update).not.toHaveBeenCalled();
  });

  it('returns 404 when update fails due to missing mission', async () => {
    controllerMock.update.mockRejectedValueOnce(new Error("Mission 'm-404' not found"));

    const response = await request(app)
      .patch('/api/missions/m-404')
      .send({ enable: true })
      .expect(404);

    expect(response.body.error).toMatch(/not found/i);
  });

  it('removes missions via DELETE /api/missions/:id', async () => {
    const removed = { id: 'm-1', name: 'Ops Sync' };
    controllerMock.remove.mockResolvedValueOnce(removed);

    const response = await request(app)
      .delete('/api/missions/m-1')
      .expect(200);

    expect(response.body.mission).toEqual(removed);
    expect(controllerMock.remove).toHaveBeenCalledWith('m-1');
  });

  it('returns 404 when delete fails due to missing mission', async () => {
    controllerMock.remove.mockRejectedValueOnce(new Error("Mission 'm-404' not found"));

    const response = await request(app)
      .delete('/api/missions/m-404')
      .expect(404);

    expect(response.body.error).toMatch(/not found/i);
  });

  it('lists templates via GET /api/missions/templates', async () => {
    templatesRepositoryMock.listTemplates.mockResolvedValueOnce([
      { slug: 'weekly', name: 'Weekly', schedule: { intervalMinutes: 60 }, tags: [], enable: true }
    ]);

    const response = await request(app)
      .get('/api/missions/templates')
      .expect(200);

    expect(response.body.templates).toHaveLength(1);
    expect(templatesRepositoryMock.listTemplates).toHaveBeenCalled();
  });

  it('retrieves a single template', async () => {
    templatesRepositoryMock.getTemplate.mockResolvedValueOnce({
      slug: 'weekly',
      name: 'Weekly',
      schedule: { intervalMinutes: 60 },
      tags: [],
      enable: true
    });

    const response = await request(app)
      .get('/api/missions/templates/weekly')
      .expect(200);

    expect(response.body.template.slug).toBe('weekly');
    expect(templatesRepositoryMock.getTemplate).toHaveBeenCalledWith('weekly');
  });

  it('returns 404 for missing template', async () => {
    templatesRepositoryMock.getTemplate.mockResolvedValueOnce(null);

    await request(app)
      .get('/api/missions/templates/missing')
      .expect(404);
  });

  it('creates a new template with PUT', async () => {
    templatesRepositoryMock.getTemplate.mockResolvedValueOnce(null);
    templatesRepositoryMock.saveTemplate.mockResolvedValueOnce({
      slug: 'fresh',
      name: 'Fresh Template',
      schedule: { intervalMinutes: 30 },
      tags: [],
      enable: true
    });

    const response = await request(app)
      .put('/api/missions/templates/fresh')
      .send({ name: 'Fresh Template', schedule: { intervalMinutes: 30 } })
      .expect(201);

    expect(response.body.template.slug).toBe('fresh');
    expect(templatesRepositoryMock.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ slug: 'fresh' }));
  });

  it('updates an existing template with PUT', async () => {
    templatesRepositoryMock.getTemplate.mockResolvedValueOnce({ slug: 'weekly', schedule: { intervalMinutes: 60 } });
    templatesRepositoryMock.saveTemplate.mockResolvedValueOnce({
      slug: 'weekly',
      name: 'Weekly',
      schedule: { cron: '0 9 * * 1' },
      tags: [],
      enable: true
    });

    const response = await request(app)
      .put('/api/missions/templates/weekly')
      .send({ schedule: { cron: '0 9 * * 1' } })
      .expect(200);

    expect(response.body.template.schedule.cron).toBe('0 9 * * 1');
  });

  it('deletes a template', async () => {
    templatesRepositoryMock.deleteTemplate.mockResolvedValueOnce(true);

    const response = await request(app)
      .delete('/api/missions/templates/weekly')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(templatesRepositoryMock.deleteTemplate).toHaveBeenCalledWith('weekly');
  });
});
