// Claude API key lives ONLY on the server (Vercel env: ANTHROPIC_API_KEY).
// Native apps call the deployed Vercel API at this base URL.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

// Google OAuth Client IDs (create at console.cloud.google.com)
export const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? "";
export const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? "";

// Google Sheets config
export const SHEET_NAME = "WineList";
