import { ResearchEngine } from '../../infrastructure/research/research-engine.mjs';
import { mainFunction } from '../infrastructure/deep-research.mjs';

const researchEngine = new ResearchEngine();

export function runApp() {
    mainFunction();
}

(async () => {
    const args = process.argv.slice(2);
    const query = args.join(' ');
    try {
        const results = await researchEngine.performResearch({ query });
        console.log('Research Results:', results);
    } catch (error) {
        console.error('Error:', error.message);
    }
})();