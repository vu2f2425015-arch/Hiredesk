// Centralized frontend config derived from Vite environment variables.
// In development, VITE_API_URL is empty so API calls use relative paths (Vite proxy handles them).
// In production, VITE_API_URL points to the backend origin (e.g., https://hiredesk-api.onrender.com).

export const API_BASE = import.meta.env.VITE_API_URL || '';
