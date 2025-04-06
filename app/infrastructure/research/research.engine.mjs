import { output } from '../../utils/research.output-manager.mjs';
import { ResearchPath } from './research.path.mjs';
import fs from 'fs/promises';
import path from 'path';
import { generateSummary } from '../../features/ai/research.providers.mjs';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';

/**
 * Main research engine that coordinates research paths
 */
export class ResearchEngine {
  constructor(config) {
    this.config = config;
  }

  async research() {
    try {
      // Initialize progress tracking
      const progress = {
        currentDepth: this.config.depth,
        totalDepth: this.config.depth,
        currentBreadth: this.config.breadth,
        totalBreadth: this.config.breadth,
        totalQueries: 0,
        completedQueries: 0,
      };

      // Create and start research path
      const path = new ResearchPath(this.config, progress);
      const result = await path.research();

      const summary = await generateSummary({
        query: this.config.query.original || this.config.query,
        learnings: result.learnings,
        // Ensure metadata is passed to summary generation
        metadata: this.config.query.metadata || null
      });

      // Save results after research
      const filename = await this.saveResults(
        this.config.query.original || this.config.query,
        result.learnings,
        result.sources,
        summary
      );

      return { ...result, filename };
    } catch (error) {
      output.log(`[research] Error during research: ${error.message || error}`);
      return {
        learnings: [`Research attempted on: ${this.config.query.original || this.config.query}`],
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

      // Generate a properly structured markdown document with all sections
      const markdown = [
        '# Research Results',
        '---',
        `## Query\n\n${query}`,
        '',
        `## Summary\n\n${summary}`,
        '',
        `## Key Learnings\n`,
        // Use bullet points for learnings to prevent duplicate numbers
        ...learnings.map(l => `- ${l}`),
        '',
        `## References\n`,
        ...sources.map(s => `- ${s}`),
      ].join('\n');

      await fs.writeFile(filename, markdown);
      output.log(`[saveResults] Results saved to ${filename}`);
      return filename;
    } catch (error) {
      output.log(`[saveResults] Error saving research results: ${error.message || error}`);
      return null;
    }
  }
}
