# Wine List App — Setup Guide

## 1. Claude API Key
1. Go to https://console.anthropic.com → API Keys → Create Key
2. Copy the key into `.env.local`:
   ```
   EXPO_PUBLIC_CLAUDE_API_KEY=sk-ant-...
   ```

## 2. Google OAuth Setup
1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "Wine List App")
3. Enable these APIs:
   - Google Sheets API
   - Google Drive API
4. Go to **APIs & Services → OAuth consent screen**
   - User type: External
   - Add your email as a test user
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**

### For iPhone (iOS):
- Application type: **iOS**
- Bundle ID: `com.winelist.app`
- Copy the Client ID to `.env.local`:
  ```
  EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=xxx.apps.googleusercontent.com
  ```

### For MacBook/Laptop (Web):
- Application type: **Web application**
- Authorized redirect URIs: add `https://auth.expo.io/@your-expo-username/wine-list`
- Copy the Client ID to `.env.local`:
  ```
  EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=xxx.apps.googleusercontent.com
  ```

## 3. Run the App

```bash
cd wine-list
npm start
```

- Press `i` for iPhone simulator
- Press `w` for web browser (MacBook/laptop)
- Scan QR code with Expo Go app on your real iPhone

## How It Works

1. **Login** with Google on first launch
2. App auto-creates a "My Wine List" Google Sheet in your Drive
3. Tap the 📷 **camera button** to scan a wine label
4. Claude Vision AI reads: wine name, winery, vintage, region, grape variety
5. Pick your rating: 👎 👍 👍👍
6. Optionally add price and notes
7. Tap **Save** — wine is added to your Google Sheet, photo saved to Drive
8. Tap any wine card to edit or delete it
