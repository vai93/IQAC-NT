require("dotenv").config();
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const SHEET_ID = process.env.NonTeachingStaff;

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

let sheets;
let cachedSheetName = null;

// Helpers
async function ensureAuthClient() {
  const tokenResponse = await oAuth2Client.getAccessToken();
  oAuth2Client.setCredentials({
    access_token: tokenResponse.token,
    refresh_token: process.env.REFRESH_TOKEN
  });
  sheets = google.sheets({ version: "v4", auth: oAuth2Client });
}

async function getSheetName() {
  if (cachedSheetName) return cachedSheetName;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  cachedSheetName = meta.data.sheets?.[0]?.properties?.title || "Sheet1";
  return cachedSheetName;
}

function columnToLetter(col) {
  let temp = col;
  let letter = "";
  while (temp > 0) {
    let rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

// Convert 0-based index to Excel-style column letter
function indexToColumnLetter(idx) {
  return columnToLetter(idx + 1);
}

// Map Department to short Dept code
function computeDeptCode(department) {
  if (!department) return null;
  const d = department.toString().toLowerCase();
  const isDT = d.includes("dairy technology") || d.includes("food technology");
  const isRA = d.includes("mechatronic engineering") || d.includes("robotics and automation");
  if (isDT) return "DT";
  if (isRA) return "RA";
  return null;
}

// Find MIS column with tolerant matching (mirrors faculty registration logic)
function findMisColumnIndex(headers) {
  const normalize = (value) => (value || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedHeaders = headers.map((h) => normalize(h));
  const candidates = ["miscode", "mis", "misid"];
  for (let i = 0; i < normalizedHeaders.length; i += 1) {
    if (candidates.includes(normalizedHeaders[i])) return i;
  }
  return -1;
}

function verifyToken(req) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) throw new Error("Missing token");
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid token");
  }
}

async function handleGet(req, res) {
  verifyToken(req);
  await ensureAuthClient();
  const sheetName = await getSheetName();
  const range = `${sheetName}!A1:AJ`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range
  });

  const rows = response.data.values || [];
  if (!rows.length) {
    return res.status(404).json({ message: "No data found" });
  }

  const headers = rows[0];
  const data = rows.slice(1).map(row => {
    const record = {};
    headers.forEach((h, i) => {
      record[h] = row[i] || "";
    });
    return record;
  });

  return res.status(200).json({
    message: "Non-teaching staff fetched",
    total: data.length,
    results: data
  });
}

const FORMULA_COLUMNS = ["active", "ageinyears", "puexperienceinmonths"];

const normalizeHeader = (h) => (h || "").toString().replace(/\s+/g, "").toLowerCase();
const isFormulaColumn = (h) => FORMULA_COLUMNS.includes(normalizeHeader(h));
const isUpdatedDateColumn = (h) => normalizeHeader(h) === "updateddate";

async function handlePut(req, res) {
  verifyToken(req);
  if (!SHEET_ID) {
    return res.status(500).json({ message: "NonTeachingStaff sheet id is missing." });
  }

  const payload = req.body || {};
  const MIScode = payload.MIScode;
  if (!MIScode) {
    return res.status(400).json({ message: "MIScode is required to update a record." });
  }

  await ensureAuthClient();
  const sheetName = await getSheetName();
  const range = `${sheetName}!A:AJ`;

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
    valueRenderOption: "FORMULA"
  });

  const rows = result.data.values || [];
  if (!rows.length) {
    return res.status(404).json({ message: "Sheet is empty." });
  }

  const headers = rows[0];
  const misIndex = headers.indexOf("MIScode");
  if (misIndex === -1) {
    return res.status(500).json({ message: "Sheet must contain MIScode column." });
  }

  const rowIndex = rows.findIndex((row, idx) => idx > 0 && String(row[misIndex]).trim() === String(MIScode).trim());
  if (rowIndex === -1) {
    return res.status(404).json({ message: "Staff not found." });
  }

  const existing = {};
  headers.forEach((h, i) => {
    existing[h] = rows[rowIndex][i] || "";
  });

  const updatedRecord = { ...existing };
  const todayIso = new Date().toISOString().split("T")[0];
  headers.forEach(h => {
    if (isFormulaColumn(h)) {
      updatedRecord[h] = existing[h]; // preserve formula/value from sheet
    } else if (isUpdatedDateColumn(h)) {
      updatedRecord[h] = payload.UpdatedDate || todayIso;
    } else if (Object.prototype.hasOwnProperty.call(payload, h)) {
      updatedRecord[h] = payload[h];
    } else {
      // try payload fallback by normalized header match
      const normH = normalizeHeader(h);
      const matchKey = Object.keys(payload).find(k => normalizeHeader(k) === normH);
      if (matchKey) updatedRecord[h] = payload[matchKey];
    }
  });

  const deptCode = computeDeptCode(updatedRecord.Department || updatedRecord.department || updatedRecord.Dept);
  if (deptCode) updatedRecord.Dept = deptCode;

  // Update only non-formula columns to avoid overwriting sheet formulas
  const updates = [];
  headers.forEach((h, colIdx) => {
    if (FORMULA_COLUMNS.includes(h)) return;
    const colLetter = indexToColumnLetter(colIdx);
    const target = `${sheetName}!${colLetter}${rowIndex + 1}`;
    updates.push({
      range: target,
      values: [[updatedRecord[h] ?? ""]]
    });
  });

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates
      }
    });
  }

  return res.status(200).json({
    message: "Record updated successfully",
    updated: updatedRecord
  });
}

async function handlePost(req, res) {
  verifyToken(req);
  if (!SHEET_ID) {
    return res.status(500).json({ message: "NonTeachingStaff sheet id is missing." });
  }

  const payload = req.body || {};
  const MIScode = payload.MIScode;
  if (!MIScode) {
    return res.status(400).json({ message: "MIScode is required to add a record." });
  }

  await ensureAuthClient();
  const sheetName = await getSheetName();
  const range = `${sheetName}!A:AJ`;

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range
  });

  const rows = result.data.values || [];
  if (!rows.length) {
    return res.status(500).json({ message: "Sheet is empty or headers missing." });
  }

  const headers = rows[0] || [];
  let misIndex = findMisColumnIndex(headers);
  if (misIndex === -1) {
    misIndex = headers.indexOf("MIScode");
  }
  if (misIndex === -1) {
    return res.status(500).json({ message: "Sheet must contain MIScode column." });
  }

  const duplicate = rows.find((row, idx) => idx > 0 && String(row[misIndex]).trim() === String(MIScode).trim());
  if (duplicate) {
    return res.status(409).json({ message: "MIScode already exists." });
  }

  const todayIso = new Date().toISOString().split("T")[0];
  const processedRecord = {
    ...payload,
    MIScode,
    UpdatedDate: payload.UpdatedDate || todayIso
  };

  // leave formula columns blank so sheet formulas remain intact
  FORMULA_COLUMNS.forEach(col => {
    if (headers.some(h => normalizeHeader(h) === col)) processedRecord[col] = "";
  });

  const deptCode = computeDeptCode(processedRecord.Department || processedRecord.department || processedRecord.Dept);
  if (deptCode) processedRecord.Dept = deptCode;

  // Try to reuse first empty MIS row to preserve formulas (like faculty registration)
  let emptyRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const mis = rows[i][misIndex];
    if (!mis || mis.toString().trim() === "" || mis === "N/A") {
      emptyRowIndex = i;
      break;
    }
  }

  if (emptyRowIndex !== -1) {
    const updates = [];
    Object.entries(processedRecord).forEach(([key, value]) => {
      if (isFormulaColumn(key)) return;
      const colIndex = headers.findIndex(
        (h) => h && normalizeHeader(h) === normalizeHeader(key)
      );
      if (colIndex !== -1) {
        updates.push({
          range: `${sheetName}!${indexToColumnLetter(colIndex)}${emptyRowIndex + 1}`,
          values: [[value ?? ""]]
        });
      }
    });

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updates
        }
      });
    }

    return res.status(201).json({
      message: "Record added into first empty MIScode row (formulas preserved)",
      MIScode,
      row: emptyRowIndex + 1,
      record: processedRecord
    });
  }

  // No empty MIS row: insert new row at bottom, inheriting formulas/formatting
  const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheetMeta = sheetInfo.data.sheets.find((s) => s.properties.title === sheetName);
  const sheetId = sheetMeta?.properties?.sheetId;
  if (!sheetId && sheetId !== 0) {
    return res.status(500).json({ message: `Sheet '${sheetName}' not found.` });
  }

  const insertRowIndex = rows.length;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: insertRowIndex,
              endIndex: insertRowIndex + 1
            },
            inheritFromBefore: true
          }
        }
      ]
    }
  });

  const newRow = headers.map((h) => {
    if (isFormulaColumn(h)) return "";
    return processedRecord[h] ?? "";
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A${insertRowIndex + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [newRow] }
  });

  return res.status(201).json({
    message: "Record added successfully at bottom",
    MIScode,
    record: processedRecord
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      return await handleGet(req, res);
    }
    if (req.method === "PUT") {
      return await handlePut(req, res);
    }
    if (req.method === "POST") {
      return await handlePost(req, res);
    }
    return res.status(405).json({ message: "Method Not Allowed" });
  } catch (error) {
    const status = error.message === "Missing token" ? 401 : error.message === "Invalid token" ? 403 : 500;
    return res.status(status).json({ message: error.message || "Internal Server Error" });
  }
};
