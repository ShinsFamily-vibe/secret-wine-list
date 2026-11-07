import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GOOGLE_CLIENT_ID_IOS, GOOGLE_CLIENT_ID_WEB } from "./config";
import { auth } from "./firebase";

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in that works on both web and iOS.
 * - Web: Firebase popup (unchanged behaviour).
 * - iOS: Google OAuth via the iOS client ID → ID token → Firebase credential.
 */
export function useGoogleSignIn(onError: (e: unknown) => void) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    webClientId: GOOGLE_CLIENT_ID_WEB,
  });

  useEffect(() => {
    if (response?.type !== "success") {
      if (response?.type === "error") onError(response.error ?? "Google sign-in error");
      return;
    }
    const idToken = response.params.id_token;
    if (!idToken) { onError("No ID token returned from Google"); return; }
    signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).catch(onError);
  }, [response]);

  const signIn = async () => {
    if (Platform.OS === "web") {
      await signInWithPopup(auth, new GoogleAuthProvider());
      return;
    }
    await promptAsync();
  };

  return { signIn, ready: Platform.OS === "web" || !!request };
}
