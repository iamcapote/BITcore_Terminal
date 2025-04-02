import express from 'express';
import researchRoutes from './features/research/routes.mjs';

const app = express();
app.use(express.json());

// Register routes
app.use('/api/research', researchRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});