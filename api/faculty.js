require("dotenv").config();
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

let sheets;

async function ensureAuthClient() {
  const tokenResponse = await oAuth2Client.getAccessToken();
  oAuth2Client.setCredentials({
    access_token: tokenResponse.token,
    refresh_token: process.env.REFRESH_TOKEN,
  });
  sheets = google.sheets({ version: "v4", auth: oAuth2Client });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // 🔹 Verify token
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Missing token" });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }

  try {
    await ensureAuthClient();

    const spreadsheetId = process.env.PROFILE_SHEET_ID;
    const range = "all in one!A1:ZZ1000"; // adjust range as per sheet

    // 🔹 Fetch all rows
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    // console.log(rows);
    if (!rows.length) {
      return res.status(404).json({ message: "No data found" });
    }

    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const record = {};
      headers.forEach((h, i) => {
        record[h] = row[i] || "";
      });
      return record;
    });

    return res.status(200).json({
      message: "Profile data fetched successfully",
      miscode: decoded.miscode || decoded.MIScode || null, // 🔹 include MIS code
      total: data.length,
      results: data,
    });
  } catch (error) {
    console.error("Error in profile API:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
