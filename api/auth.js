require("dotenv").config();
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET ;
const PROFILE_SHEET_ID = process.env.PROFILE_SHEET_ID;

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

let sheets, drive;

// ✅ Ensure we always have a valid access token
async function ensureAuthClient() {
  const tokenResponse = await oAuth2Client.getAccessToken();
  oAuth2Client.setCredentials({
    access_token: tokenResponse.token,
    refresh_token: process.env.REFRESH_TOKEN,
  });
  sheets = google.sheets({ version: "v4", auth: oAuth2Client });
  drive = google.drive({ version: "v3", auth: oAuth2Client });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { abc, def } = req.query;
    if (!abc || !def) {
      return res.status(400).json({ message: "MIS and Role are required." });
    }

    const MIScode = abc.trim();
    const selectedRole = def.trim().toUpperCase();

    // ✅ Authenticate with Google Sheets API
    await ensureAuthClient();

    // ✅ Fetch sheet data
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: PROFILE_SHEET_ID,
      range: "all in one!A:Z", // adjust to your tab name
    });

    const rows = sheetResponse.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No data found in profile sheet." });
    }

    // Assume first row is headers
    const headers = rows[0].map((h) => h.trim());
    const misIndex = headers.indexOf("MIScode");
    const rolesIndex = headers.indexOf("Roles");

    if (misIndex === -1 || rolesIndex === -1) {
      return res
        .status(500)
        .json({ message: "Sheet must contain MIScode and Roles columns." });
    }

    // Find matching user row
    const userRow = rows.find(
      (row, idx) => idx > 0 && row[misIndex]?.trim() === MIScode
    );

    if (!userRow) {
      return res.status(404).json({ message: "User not found in sheet." });
    }

    // Extract roles
    const rolesRaw = userRow[rolesIndex] || "";
    const rolesArray = rolesRaw.split(",").map((r) => r.trim().toUpperCase());

    // Validate role
    if (!rolesArray.includes(selectedRole)) {
      return res
        .status(403)
        .json({ message: "Role not authorized for this user." });
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      {
        MIScode,
        Roles: rolesArray,
        CurrentRole: selectedRole,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    console.log(MIScode);
      console.log(selectedRole);
    return res.status(200).json({
      message: "Role validated",
      token,
      redirect: "index.html",
    });
  } catch (error) {
    console.error("Error in role authentication:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



