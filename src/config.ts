/**
 * App configuration — central place for tunable values.
 * Edit here, no need to dig into components.
 */

export const APP_CONFIG = {
  /** Default spreadsheet that loads on first sign-in. Users can swap via Settings. */
  defaultSpreadsheetId: "1tDFYyLBJedRa02s5Nb4GAg1Ro22sp-LnmG3nxU2fFys",

  /** Default sheet tab name target for batch attendance writes. */
  defaultTargetSheet: "gudang",

  /** Token expiry buffer (seconds) — refresh before this many seconds remain. */
  tokenExpirySeconds: 3300,

  /** OAuth scopes requested at sign-in. */
  oauthScopes: ["https://www.googleapis.com/auth/spreadsheets"],

  /** Branding strings (single source of truth for header / meta). */
  brand: {
    name: "Mulazamah",
    arabicName: "المُلازَمَة",
    subtitle: "Sistem Input Data Santri",
    institution: "Mahad Mulazamah Al-Azhar",
  },
};
