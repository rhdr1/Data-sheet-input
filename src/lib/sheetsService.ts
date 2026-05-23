import { SpreadsheetInfo, SheetAudit, SheetMetadata } from "../types";

/**
 * Extracts a Spreadsheet ID from a standard Google Sheets URL, or returns the raw ID if already a valid ID.
 */
export function parseSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) return "";
  const trimmed = urlOrId.trim();
  
  // Regex to match spreadsheet ID from URL (e.g. /spreadsheets/d/[ID]/...)
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  // Alternative match if someone pastes only edit link with key
  const matchAlt = trimmed.match(/key=([^&#]+)/);
  if (matchAlt && matchAlt[1]) {
    return matchAlt[1];
  }

  // Return original clean string if it contains no slashes
  if (!trimmed.includes("/")) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Generates Excel column letters from index (e.g., 0 -> A, 1 -> B, 26 -> AA)
 */
export function getColumnLetter(colIndex: number): string {
  let letter = "";
  let index = colIndex;
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

/**
 * Fetches basic info and list of tabs from a spreadsheet.
 */
export async function fetchSpreadsheetInfo(
  token: string,
  spreadsheetId: string
): Promise<SpreadsheetInfo> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let errorMsg = `Error fetching spreadsheet: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (response.status === 401 || errBody?.error?.status === "UNAUTHENTICATED" || errBody?.error?.message?.includes("invalid authentication credentials")) {
        errorMsg = "Sesi Google Anda telah kedaluwarsa. Silakan Logout dan Login kembali.";
      } else if (errBody?.error?.message) {
        errorMsg = errBody.error.message;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const sheets: SheetMetadata[] = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
    index: s.properties.index,
    rowCount: s.properties.gridProperties?.rowCount || 0,
    columnCount: s.properties.gridProperties?.columnCount || 0,
  }));

  return {
    id: spreadsheetId,
    title: data.properties?.title || "Untitled Spreadsheet",
    sheets,
  };
}

/**
 * Fetches sheet data and performs dynamic audit.
 */
export async function fetchSheetAudit(
  token: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<SheetAudit> {
  // Read all populated columns in the sheet
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetTitle
  )}?valueRenderOption=FORMATTED_VALUE`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let errorMsg = `Error reading sheet values: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (response.status === 401 || errBody?.error?.status === "UNAUTHENTICATED" || errBody?.error?.message?.includes("invalid authentication credentials")) {
        errorMsg = "Sesi Google Anda telah kedaluwarsa. Silakan Logout dan Login kembali.";
      } else if (errBody?.error?.message) {
        errorMsg = errBody.error.message;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const rawValues: string[][] = data.values || [];

  if (rawValues.length === 0) {
    return {
      title: sheetTitle,
      headers: [],
      rows: [],
      totalCells: 0,
      emptyCells: 0,
      incompleteRows: [],
      isFullyFilled: true,
    };
  }

  // Treat first row as headers
  const headers = rawValues[0].map((h) => h?.trim() || "");
  const dataRows = rawValues.slice(1);

  // Pad short headers with placeholder names to avoid indices mismatch
  while (headers.length === 0) {
    headers.push("Column A");
  }

  let emptyCells = 0;
  const incompleteRows: number[] = [];
  const headerCount = headers.length;

  dataRows.forEach((row, idx) => {
    let rowHasEmpty = false;
    // We check all cells within the columns list range
    for (let colIdx = 0; colIdx < headerCount; colIdx++) {
      const val = row[colIdx];
      if (val === undefined || val === null || val.trim() === "") {
        emptyCells++;
        rowHasEmpty = true;
      }
    }
    if (rowHasEmpty) {
      // Remember 0-based dataRows index corresponds to index + 2 in spreadsheet rows (1-indexed, +1 header)
      incompleteRows.push(idx);
    }
  });

  const totalCells = dataRows.length * headerCount;

  return {
    title: sheetTitle,
    headers,
    rows: dataRows,
    totalCells,
    emptyCells,
    incompleteRows,
    isFullyFilled: emptyCells === 0,
  };
}

/**
 * Appends a new values row array to the targeted sheet tab.
 */
export async function appendRow(
  token: string,
  spreadsheetId: string,
  sheetTitle: string,
  values: string[]
): Promise<any> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetTitle
  )}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range: sheetTitle,
      majorDimension: "ROWS",
      values: [values],
    }),
  });

  if (!response.ok) {
    let errorMsg = `Error writing values: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (response.status === 401 || errBody?.error?.status === "UNAUTHENTICATED" || errBody?.error?.message?.includes("invalid authentication credentials")) {
        errorMsg = "Sesi Google Anda telah kedaluwarsa. Silakan Logout dan Login kembali.";
      } else if (errBody?.error?.message) {
        errorMsg = errBody.error.message;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Appends multiple rows of values to the targeted sheet tab in a single API call.
 */
export async function appendMultipleRows(
  token: string,
  spreadsheetId: string,
  sheetTitle: string,
  rows: string[][]
): Promise<any> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetTitle
  )}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range: sheetTitle,
      majorDimension: "ROWS",
      values: rows,
    }),
  });

  if (!response.ok) {
    let errorMsg = `Error writing multiple values: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (response.status === 401 || errBody?.error?.status === "UNAUTHENTICATED" || errBody?.error?.message?.includes("invalid authentication credentials")) {
        errorMsg = "Sesi Google Anda telah kedaluwarsa. Silakan Logout dan Login kembali.";
      } else if (errBody?.error?.message) {
        errorMsg = errBody.error.message;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Updates a specific row index (0-indexed in data array, which means row (index + 2) in sheet due to 1-indexed and header).
 */
export async function updateRowCells(
  token: string,
  spreadsheetId: string,
  sheetTitle: string,
  dataRowIndex: number, // 0-indexed in data rows array
  values: string[]
): Promise<any> {
  const sheetRowIndex = dataRowIndex + 2; // Row index in spreadsheet (Row 2 for the first data row)
  const colLetter = getColumnLetter(values.length - 1);
  const range = `${sheetTitle}!A${sheetRowIndex}:${colLetter}${sheetRowIndex}`;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range,
      majorDimension: "ROWS",
      values: [values],
    }),
  });

  if (!response.ok) {
    let errorMsg = `Error updating row values: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (response.status === 401 || errBody?.error?.status === "UNAUTHENTICATED" || errBody?.error?.message?.includes("invalid authentication credentials")) {
        errorMsg = "Sesi Google Anda telah kedaluwarsa. Silakan Logout dan Login kembali.";
      } else if (errBody?.error?.message) {
        errorMsg = errBody.error.message;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}
