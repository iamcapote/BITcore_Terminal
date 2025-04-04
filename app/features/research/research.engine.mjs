import { output } from '../../utils/research.output-manager.mjs';
import { ResearchPath } from './research-path.mjs';
import fs from 'fs/promises';
import path from 'path';
import { generateSummary } from '../../features/ai/research.providers.mjs';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';

/**
 * @typedef {Object} ResearchConfig
 * @property {string} query - The research query.
 * @property {number} breadth - The breadth of the research.
 * @property {number} depth - The depth of the research.
 * @property {(progress: ResearchProgress) => void} [onProgress] - Optional callback for progress updates.
 */

/**
 * @typedef {Object} ResearchProgress
 * @property {number} currentDepth - The current depth of the research.
 * @property {number} totalDepth - The total depth of the research.
 * @property {number} currentBreadth - The current breadth of the research.
 * @property {number} totalBreadth - The total breadth of the research.
 * @property {number} totalQueries - The total number of queries.
 * @property {number} completedQueries - The number of completed queries.
 * @property {string} [currentQuery] - The current query being processed.
 */

/**
 * @typedef {Object} ResearchResult
 * @property {string[]} learnings - The key learnings from the research.
 * @property {string[]} sources - The sources of the research.
 * @property {string} [filename] - The filename where results are saved.
 */

export class ResearchEngine {
  /**
   * @param {ResearchConfig} config - The configuration for the research engine.
   */
  constructor(config) {
    this.config = config;
  }

  async research() {
    try {
      /** @type {ResearchProgress} */
      const progress = {
        currentDepth: this.config.depth,
        totalDepth: this.config.depth,
        currentBreadth: this.config.breadth,
        totalBreadth: this.config.breadth,
        totalQueries: 0,
        completedQueries: 0,
      };

      const path = new ResearchPath(this.config, progress);
      const result = await path.research();

      output.log('\nGenerating narrative summary...');
      const summary = await generateSummary({
        query: this.config.query,
        learnings: result.learnings,
      });

      const filename = await this.saveResults(this.config.query, result.learnings, result.sources, summary);
      
      return {
        ...result,
        filename
      };
    } catch (error) {
      output.log('[research] Error during research:', error);
      return {
        learnings: [`Research attempted on: ${this.config.query}`],
        sources: [],
      };
    }
  }

  async saveResults(query, learnings, sources, summary = 'No summary available.') {
    try {
      await ensureDir('research');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const subject = query.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().substring(0, 30);
      const filename = path.join('research', `research-${subject}-${timestamp}.md`);

      const report = [
        '# Research Results',
        '----------------',
        `## Query: ${query}`,
        '',
        '## Summary',
        summary || 'No summary available.',
        '',
        '## Key Learnings',
        ...learnings.map((l, i) => `${i + 1}. ${l}`),
        '',
        '## Sources',
        ...sources.map(s => `- ${s}`),
      ].join('\n');

      await fs.writeFile(filename, report);
      output.log(`[saveResults] Results saved to ${filename}`);
      return filename;
    } catch (error) {
      output.log(`[saveResults] Error saving research results: ${error.message || error}`);
      return null;
    }
  }
}
