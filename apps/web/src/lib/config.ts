// Centralized frontend config derived from Vite environment variables.
// In development, VITE_API_URL can be empty (Vite dev proxy forwards /api) or set to http://localhost:4000.
// In production, VITE_API_URL points to the backend origin (e.g., https://hiredesk-api.onrender.com).
// We defensively strip any trailing '/api' or '/' so `${API_BASE}/api/...` never produces double '/api/api/...'.

const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined) || '';
export const API_BASE = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');

