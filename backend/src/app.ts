import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import storesRoutes from './routes/stores.js';
import dealsRoutes from './routes/deals.js';
import mealsRoutes from './routes/meals.js';
import landingRoutes from './routes/landing.js';
import optimizeRoutes from './routes/optimize.js';
import recipesRoutes from './routes/recipes.js';
import watchlistRoutes from './routes/watchlist.js';
import importantItemsRoutes from './routes/importantItems.js';
import eventsRoutes from './routes/events.js';
import sharingRoutes from './routes/sharing.js';
import adminRoutes from './routes/admin.js';
import familyRoutes from './routes/family.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(apiLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/stores', storesRoutes);
app.use('/api/v1/deals', dealsRoutes);
app.use('/api/v1/meals', mealsRoutes);
app.use('/api/v1/landing', landingRoutes);
app.use('/api/v1/optimize', optimizeRoutes);
app.use('/api/v1/recipes', recipesRoutes);
app.use('/api/v1/watchlist', watchlistRoutes);
app.use('/api/v1/important-items', importantItemsRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/share', sharingRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/family', familyRoutes);

app.use(errorHandler);

export { app };
