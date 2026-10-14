// Vercel Serverless Function — wraps the Express app for /api/* routes
import { createApp } from '../apps/api/src/app.js';

const app = createApp();

// Vercel expects a default export of the Express app (or a handler function)
export default app;
