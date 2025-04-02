import { fetchResearch } from '../../infrastructure/research/research-engine.mjs';

export async function getResearchData() {
  return await fetchResearch();
}
