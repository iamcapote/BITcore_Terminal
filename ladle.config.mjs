/**
 * Why: Align Ladle's story discovery with the UI workspace for quick primitive previews.
 * What: Points Ladle to the stories directory and reuses the primary Vite config.
 * How: Exports a minimal config consumed by ladle CLI commands.
 */

export default {
  stories: ['app/public/ui/stories/**/*.stories.@(ts|tsx)'],
  viteConfig: {
    configFile: 'vite.config.ts'
  }
};
