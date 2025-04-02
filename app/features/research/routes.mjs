import express from 'express';
import { ResearchEngine } from '../../infrastructure/research/research-engine.mjs';

const router = express.Router();

router.post('/', async (req, res) => {
  const { query, depth, breadth } = req.body;
  const engine = new ResearchEngine({ query, depth, breadth });
  const result = await engine.research();
  res.json(result);
});

export default router;
