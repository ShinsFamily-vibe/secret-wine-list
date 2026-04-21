import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { GOOGLE_CLIENT_ID_IOS, GOOGLE_CLIENT_ID_WEB } from "./config";

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEY = "wine_google_auth";

export interface AuthState {
  accessToken: string;
  spreadsheetId: string;
}

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function useGoogleAuth() {
  const clientId = Platform.OS === "ios" ? GOOGLE_CLIENT_ID_IOS : GOOGLE_CLIENT_ID_WEB;
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "winelist" });

  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: SCOPES,
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    },
    discovery
  );

  return { request, response, promptAsync };
}

export async function saveAuth(auth: AuthState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export async function loadAuth(): Promise<AuthState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function verifyToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" + accessToken);
    return res.ok;
  } catch {
    return false;
  }
}
