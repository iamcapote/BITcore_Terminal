/**
 * Why: Provide modular diagnostics for the /diagnose command without bloating the CLI entrypoint.
 * What: Exposes async probes for API connectivity, filesystem permissions, and storage metrics.
 * How: Leverages userManager configuration, filesystem/OS primitives, and structured logging helpers.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { userManager } from '../../features/auth/user-manager.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';

export const USER_FILES_DIR = userManager.storageDir;
export const RESEARCH_DIR = path.join(USER_FILES_DIR, 'research');

const moduleLogger = createModuleLogger('commands.diagnose.checks', { emitToStdStreams: false });

export async function checkApi({ output, error }) {
  output('\n--- API Connectivity & Key Check ---');
  moduleLogger.info('Diagnose API check started.');

  try {
    const results = await userManager.testApiKeys();

    const describe = (label, result) => {
      if (result.success === true) {
        output(`🟢 ${label}: OK`, { label, status: 'ok' });
      } else if (result.success === false) {
        output(`🔴 ${label}: Failed (${result.error || 'Unknown error'})`, {
          label,
          status: 'failed',
          error: result.error || null
        });
      } else {
        output(`🟡 ${label}: Not Configured`, { label, status: 'missing' });
      }
    };

    describe('Brave', results.brave);
    describe('Venice', results.venice);
    describe('GitHub', results.github);

    const anyFailure = Object.values(results).some((res) => res.success === false);
    output(`API Check Result: ${anyFailure ? 'Issues found' : 'OK'}`, { anyFailure });
    moduleLogger.info('Diagnose API check completed.', {
      results: {
        brave: results.brave?.success ?? null,
        venice: results.venice?.success ?? null,
        github: results.github?.success ?? null
      },
      anyFailure
    });
    return !anyFailure;
  } catch (err) {
    error(`API test failed: ${err.message}`, { message: err.message });
    moduleLogger.error('Diagnose API check failed.', {
      message: err.message,
      stack: err.stack || null
    });
    return false;
  }
}

export async function checkPermissions(output) {
  output('\n🔍 Checking file and directory permissions...');

  let allAccessible = true;
  const checkDirAccess = async (dirPath, dirName) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
      output(`✅ ${dirName} directory (${dirPath}) is readable and writable.`, {
        dirName,
        dirPath,
        status: 'ok'
      });
      moduleLogger.info('Diagnose directory accessibility verified.', {
        dirName,
        dirPath,
        accessible: true
      });
      return true;
    } catch (error) {
      output(`❌ ${dirName} directory (${dirPath}) is not accessible: ${error.message}`, {
        dirName,
        dirPath,
        status: 'error',
        message: error.message
      });
      moduleLogger.warn('Diagnose directory accessibility failed.', {
        dirName,
        dirPath,
        message: error.message
      });
      allAccessible = false;
      return false;
    }
  };

  await checkDirAccess(USER_FILES_DIR, 'Users');
  await checkDirAccess(RESEARCH_DIR, 'Research');

  const tempDir = os.tmpdir();
  await checkDirAccess(tempDir, 'Temporary');

  moduleLogger.info('Diagnose permissions check completed.', { allAccessible });
  return allAccessible;
}

export async function checkStorage(output) {
  output('\n🔍 Checking storage usage and availability...');
  moduleLogger.info('Diagnose storage check started.');

  let metricsCollected = true;
  const getDirSize = async (dirPath) => {
    let totalSize = 0;
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        try {
          if (item.isDirectory()) {
            totalSize += await getDirSize(itemPath);
          } else if (item.isFile()) {
            const stat = await fs.stat(itemPath);
            totalSize += stat.size;
          }
        } catch (itemError) {
          // Swallow per-item errors but continue traversal.
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        output(`⚠️ Error calculating size of ${dirPath}: ${error.message}`, {
          dirPath,
          message: error.message
        });
        metricsCollected = false;
      }
    }
    return totalSize;
  };

  const formatBytes = (bytes) => {
    if (bytes < 0) bytes = 0;
    if (bytes === 0) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    let i = 0;
    if (bytes > 0) {
      i = Math.floor(Math.log(bytes) / Math.log(k));
    }
    const unitIndex = Math.min(i, units.length - 1);
    return `${parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(2))} ${units[unitIndex]}`;
  };

  const userFilesSize = await getDirSize(USER_FILES_DIR);
  output(`📊 User files size (${USER_FILES_DIR}): ${formatBytes(userFilesSize)}`, {
    dirPath: USER_FILES_DIR,
    sizeBytes: userFilesSize
  });

  const researchFilesSize = await getDirSize(RESEARCH_DIR);
  output(`📊 Research files size (${RESEARCH_DIR}): ${formatBytes(researchFilesSize)}`, {
    dirPath: RESEARCH_DIR,
    sizeBytes: researchFilesSize
  });

  try {
    const homeDir = os.homedir();
    const stats = await fs.statfs(homeDir);
    const freeSpace = stats.bavail * stats.bsize;
    const totalSpace = stats.blocks * stats.bsize;
    output(`📊 Disk space (home partition: ${homeDir}): ${formatBytes(freeSpace)} free / ${formatBytes(totalSpace)} total`, {
      homeDir,
      freeBytes: freeSpace,
      totalBytes: totalSpace
    });
  } catch (statfsError) {
    output(`⚠️ Could not get disk space using fs.statfs: ${statfsError.message}. Trying fallback...`, {
      message: statfsError.message
    });
    try {
      const dfOutput = execSync('df -Pk .', { encoding: 'utf8' });
      const lines = dfOutput.trim().split('\n');
      if (lines.length > 1) {
        const values = lines[1].split(/\s+/);
        if (values.length >= 4) {
          const availableKB = parseInt(values[3], 10);
          const totalKB = parseInt(values[1], 10);
          if (!Number.isNaN(availableKB) && !Number.isNaN(totalKB)) {
            output(`📊 Disk space (fallback via df on '.'): ${formatBytes(availableKB * 1024)} free / ${formatBytes(totalKB * 1024)} total`, {
              freeBytes: availableKB * 1024,
              totalBytes: totalKB * 1024,
              method: 'df'
            });
          } else {
            output("⚠️ Could not parse 'df' output (non-numeric values).", { method: 'df', reason: 'non_numeric' });
            metricsCollected = false;
          }
        } else {
          output("⚠️ Could not parse 'df' output (unexpected format).", { method: 'df', reason: 'unexpected_format' });
          metricsCollected = false;
        }
      } else {
        output("⚠️ Could not parse 'df' output (no lines).", { method: 'df', reason: 'no_lines' });
        metricsCollected = false;
      }
    } catch (dfError) {
      output(`⚠️ Fallback 'df' command failed: ${dfError.message}`, { message: dfError.message });
      output('⚠️ Could not determine disk space.', { method: 'df', reason: 'fallback_failed' });
      metricsCollected = false;
    }
  }

  moduleLogger.info('Diagnose storage check completed.', {
    metricsCollected,
    userFilesSize,
    researchFilesSize
  });
  return metricsCollected;
}
