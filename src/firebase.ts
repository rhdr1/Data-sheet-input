import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure persistent session across reloads
setPersistence(auth, browserLocalPersistence).catch((e) =>
  console.warn("Could not set auth persistence:", e)
);

export const provider = new GoogleAuthProvider();
// We need the spreadsheets scope to read/write to user's spreadsheets
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.setCustomParameters({ prompt: "select_account" });

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Resolve redirect-based login fallback (only relevant if popup is blocked)
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          const expiry = Date.now() + 3300 * 1000;
          localStorage.setItem("g_oauth_token", cachedAccessToken);
          localStorage.setItem("g_oauth_token_exp", expiry.toString());
          if (onAuthSuccess && result.user) {
            onAuthSuccess(result.user, cachedAccessToken);
          }
        }
      }
    })
    .catch((error) => console.error("Redirect auth error:", error));

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const savedToken = localStorage.getItem("g_oauth_token");
      const expired = Number(localStorage.getItem("g_oauth_token_exp") || "0");

      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (savedToken && Date.now() < expired) {
        cachedAccessToken = savedToken;
        if (onAuthSuccess) onAuthSuccess(user, savedToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem("g_oauth_token");
      localStorage.removeItem("g_oauth_token_exp");
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction.
// Uses popup primarily (more reliable across browsers) with redirect fallback.
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    if (!accessToken) {
      throw new Error("Tidak mendapat access token dari Google.");
    }
    cachedAccessToken = accessToken;
    const expiry = Date.now() + 3300 * 1000;
    localStorage.setItem("g_oauth_token", accessToken);
    localStorage.setItem("g_oauth_token_exp", expiry.toString());
    return { user: result.user, accessToken };
  } catch (error: any) {
    // Fallback: if popup blocked or unsupported, use redirect
    const code = error?.code || "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      console.warn("Popup unavailable, falling back to redirect:", code);
      try {
        await signInWithRedirect(auth, provider);
        return null; // browser navigates away; getRedirectResult will resolve
      } catch (redirectErr: any) {
        console.error("Redirect sign-in failed:", redirectErr);
        throw redirectErr;
      }
    }
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Checks if token is about to expire, and if so, quietly re-authenticates to get a fresh token.
 * MUST be called directly within a user event handler (onClick) to avoid popup blockers.
 */
export const ensureValidToken = async (): Promise<string | null> => {
  const expired = Number(localStorage.getItem("g_oauth_token_exp") || "0");
  if (Date.now() > expired) {
    // Token is expired, trigger popup login to refresh
    // (Requires this function to be called from a direct click handler)
    const res = await googleSignIn();
    return res ? res.accessToken : null;
  }
  return cachedAccessToken || localStorage.getItem("g_oauth_token");
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem("g_oauth_token");
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("g_oauth_token");
  localStorage.removeItem("g_oauth_token_exp");
};
