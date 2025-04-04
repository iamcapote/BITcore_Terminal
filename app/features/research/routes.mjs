import express from 'express';
import { ResearchEngine } from '../../infrastructure/research/research.engine.mjs';
import { cleanQuery } from '../../utils/research.clean-query.mjs';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { query, depth = 2, breadth = 3 } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    const engine = new ResearchEngine({ query, depth, breadth });
    const result = await engine.research();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
