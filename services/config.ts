// Replace with your actual API key
// For production, use environment variables via EAS secrets
export const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? "";

// Google OAuth Client IDs (create at console.cloud.google.com)
export const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? "";
export const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? "";

// Google Sheets config
export const SHEET_NAME = "WineList";
