import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyRepoMock = vi.fn();
const pullRepoMock = vi.fn();
const pushRepoMock = vi.fn();
const statusRepoMock = vi.fn();
const resolveConflictsMock = vi.fn();
const commitRepoMock = vi.fn();

const mkdirMock = vi.fn();
const readFileMock = vi.fn();
const writeFileMock = vi.fn();

vi.mock('../app/infrastructure/missions/github-sync.mjs', () => ({
	verifyRepo: verifyRepoMock,
	pullRepo: pullRepoMock,
	pushRepo: pushRepoMock,
	statusRepo: statusRepoMock,
	resolveConflicts: resolveConflictsMock,
	commitRepo: commitRepoMock
}));

vi.mock('fs/promises', () => ({
	default: {
		mkdir: mkdirMock,
		readFile: readFileMock,
		writeFile: writeFileMock
	},
	mkdir: mkdirMock,
	readFile: readFileMock,
	writeFile: writeFileMock
}));

const { MissionGitHubSyncService } = await import('../app/features/missions/github-sync.service.mjs');

describe('MissionGitHubSyncService', () => {
	const defaults = {
		repoPath: '/tmp/missions-repo',
		filePath: 'missions.json',
		branch: 'main',
		remote: 'origin',
		commitMessage: 'sync missions'
	};

	beforeEach(() => {
		verifyRepoMock.mockReset();
		pullRepoMock.mockReset();
		pushRepoMock.mockReset();
		statusRepoMock.mockReset();
		resolveConflictsMock.mockReset();
		commitRepoMock.mockReset();
		mkdirMock.mockReset();
		readFileMock.mockReset();
		writeFileMock.mockReset();
	});

	it('loads manifest and returns content', async () => {
		const service = new MissionGitHubSyncService({ defaults });
		verifyRepoMock.mockResolvedValue({ success: true });
		pullRepoMock.mockResolvedValue({ success: true });
		readFileMock.mockResolvedValue('{"missions":[]}');
		statusRepoMock.mockResolvedValue({
			success: true,
			conflicts: [],
			staged: [],
			modified: [],
			ahead: 0,
			behind: 0,
			clean: true
		});

		const result = await service.load();

		expect(result.status).toBe('ok');
		expect(result.payload).toBe('{"missions":[]}');
		expect(readFileMock).toHaveBeenCalledWith('/tmp/missions-repo/missions.json', 'utf8');
	});

	it('surfaces conflict status when commit fails with conflicts', async () => {
		const service = new MissionGitHubSyncService({ defaults });
		verifyRepoMock.mockResolvedValue({ success: true });
		pullRepoMock.mockResolvedValue({ success: true });
		mkdirMock.mockResolvedValue();
		writeFileMock.mockResolvedValue();
		commitRepoMock.mockResolvedValue({ success: false, message: 'conflicts' });
		statusRepoMock.mockResolvedValue({
			success: true,
			conflicts: ['missions.json'],
			staged: [],
			modified: [],
			ahead: 0,
			behind: 0,
			clean: false
		});

		const result = await service.save({}, { content: '{"missions":[]}' });

		expect(result.status).toBe('conflict');
		expect(result.statusReport.conflicts).toContain('missions.json');
		expect(commitRepoMock).toHaveBeenCalled();
	});

		it('saves manifest and pushes changes when clean', async () => {
			const service = new MissionGitHubSyncService({ defaults });
			verifyRepoMock.mockResolvedValue({ success: true });
			pullRepoMock.mockResolvedValue({ success: true });
			mkdirMock.mockResolvedValue();
			writeFileMock.mockResolvedValue();
			commitRepoMock.mockResolvedValue({ success: true });
			pushRepoMock.mockResolvedValue({ success: true });
			statusRepoMock.mockResolvedValue({
				success: true,
				conflicts: [],
				staged: [],
				modified: [],
				ahead: 0,
				behind: 0,
				clean: true
			});

			const result = await service.save({}, { content: '{"missions":[]}' });

			expect(result.status).toBe('ok');
			expect(pushRepoMock).toHaveBeenCalled();
			expect(writeFileMock).toHaveBeenCalledWith('/tmp/missions-repo/missions.json', '{"missions":[]}', 'utf8');
		});

	it('resolves conflicts using configured strategy', async () => {
		const service = new MissionGitHubSyncService({ defaults: { ...defaults, strategy: 'theirs' } });
		resolveConflictsMock.mockResolvedValue({ success: true, message: 'resolved' });
		statusRepoMock.mockResolvedValue({
			success: true,
			conflicts: [],
			staged: [],
			modified: [],
			ahead: 0,
			behind: 0,
			clean: true
		});

		const result = await service.resolve();

		expect(result.status).toBe('ok');
		expect(resolveConflictsMock).toHaveBeenCalledWith('/tmp/missions-repo', {
			filePath: 'missions.json',
			strategy: 'theirs'
		});
	});
});


