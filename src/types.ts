export interface SheetMetadata {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

export interface SheetAudit {
  title: string;
  headers: string[];
  rows: string[][]; // Excluding headers
  totalCells: number;
  emptyCells: number;
  incompleteRows: number[]; // Indices of rows with missing fields
  isFullyFilled: boolean;
}

export interface SpreadsheetInfo {
  id: string;
  title: string;
  sheets: SheetMetadata[];
}
