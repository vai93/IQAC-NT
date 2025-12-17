require("dotenv").config();
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";
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

function findMisColumnIndex(headers) {
  const normalize = (value) => (value || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedHeaders = headers.map((h) => normalize(h));
  const candidates = ["miscode", "mis", "miscode", "misid"]; // normalized forms
  for (let i = 0; i < normalizedHeaders.length; i += 1) {
    if (candidates.includes(normalizedHeaders[i])) return i;
  }
  return -1;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
 res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

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
    } catch (authError) {
      return res.status(401).json({ status: "auth_required", message: authError.message });
    }
    const MIScode = decoded.MIScode;
  const { updates } = req.body;
  if (!MIScode || !updates) {
    return res.status(400).json({ message: "MIScode and updates are required" });
  }

  // Function to calculate age from date of birth
  function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    
    try {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      
      return age > 0 ? age : null;
    } catch (error) {
      console.error("Error calculating age:", error);
      return null;
    }
  }

  // Function to calculate experience years
  function calculateExperience(joiningDate) {
    if (!joiningDate) return null;
    
    try {
      const joinDate = new Date(joiningDate);
      const today = new Date();
      let years = today.getFullYear() - joinDate.getFullYear();
      const monthDiff = today.getMonth() - joinDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < joinDate.getDate())) {
        years--;
      }
      
      return years > 0 ? years : 0;
    } catch (error) {
      console.error("Error calculating experience:", error);
      return null;
    }
  }

  // Initialize processed updates
  let processedUpdates = { ...updates };

  try {
    await ensureAuthClient();

    let spreadsheetId = "1M9ozA5bXVExJVZI3E0QzjgQbr7dAeBPZqiEcAidsdmc";
    
    // Test sheet access
    try {
      const testResponse = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });
    } catch (accessError) {
      console.error('=== DEBUG: Sheet access failed ===');
      console.error('Access error:', accessError.message);
      return res.status(403).json({ 
        message: "Cannot access Google Sheet", 
        error: accessError.message 
      });
    }
    if (!spreadsheetId) {
      return res.status(500).json({ message: "PROFILE_SHEET_ID is not configured" });
    }

    const rangeParam = "all in one";
    const escapedRange = rangeParam.includes(' ') || rangeParam.includes('!') ? `'${rangeParam}'` : rangeParam;
    
    // First, get the current data to find the row and column mappings
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapedRange}!A1:ZZ1000`,
    });

    const rows = response.data.values || [];
    if (!rows.length) return res.status(404).json({ message: "No data found" });

    const headers = rows[0] || [];
    let misIndex = findMisColumnIndex(headers);
    if (misIndex === -1) {
      // Fallback: user confirmed MIS is the 2nd column
      misIndex = 1;
    }

    // Find the row with the matching MIS code
    let targetRowIndex = -1;
    let currentRowData = {};
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][misIndex] || "").toString().trim() === MIScode) {
        targetRowIndex = i;
        // Store current row data for calculations
        headers.forEach((header, index) => {
          currentRowData[header] = rows[i][index] || '';
        });

        break;
      }
    }

    if (targetRowIndex === -1) {
      return res.status(404).json({ message: "Faculty record not found" });
    }

    // Process dependent fields after getting current data
    // Function to find field value from either updates or current data
    function getFieldValue(fieldNames) {
      for (const fieldName of fieldNames) {
        if (updates[fieldName]) return updates[fieldName];
        if (currentRowData[fieldName]) return currentRowData[fieldName];
      }
      return null;
    }
    
    // Auto-calculate age from DOB (either new or existing)
    const dobFieldNames = ['DOB', 'dateofbirth', 'Date of Birth', 'DateOfBirth'];
    const dobValue = getFieldValue(dobFieldNames);
    if (dobValue && dobValue !== 'N/A' && dobValue !== '') {
      const calculatedAge = calculateAge(dobValue);
      
      if (calculatedAge !== null) {
        processedUpdates['AgeInYears'] = calculatedAge;
        processedUpdates['age'] = calculatedAge;
        processedUpdates['Age'] = calculatedAge;
        processedUpdates['Age (years)'] = calculatedAge;
      }
    }

    // Auto-calculate experience from joining date (either new or existing)
    const joiningFieldNames = ['JoiningDate', 'joiningdate', 'Joining Date', 'Date of Joining'];
    const joiningValue = getFieldValue(joiningFieldNames);
    if (joiningValue && joiningValue !== 'N/A' && joiningValue !== '') {
      const calculatedExp = calculateExperience(joiningValue);
      
      if (calculatedExp !== null) {
        processedUpdates['TotalExperienceInYears'] = calculatedExp;
        processedUpdates['experience'] = calculatedExp;
        processedUpdates['Experience'] = calculatedExp;
        processedUpdates['Experience (years)'] = calculatedExp;
        processedUpdates['Total Experience'] = calculatedExp;
      }
    }

    // Auto-calculate total experience from teaching + industry experience
    const teachingExpFieldNames = ['TotalTeachingExperienceInMonths', 'Total Teaching Experience (months)', 'totalteachingexperienceinmonths'];
    const industryExpFieldNames = ['IndustryExperienceInMonths', 'Industry Experience (months)', 'industryexperienceinmonths'];
    
    const teachingExpValue = getFieldValue(teachingExpFieldNames);
    const industryExpValue = getFieldValue(industryExpFieldNames);
    
    if (teachingExpValue || industryExpValue) {
      const teachingMonths = parseFloat(teachingExpValue) || 0;
      const industryMonths = parseFloat(industryExpValue) || 0;
      const totalMonths = teachingMonths + industryMonths;
      const totalYears = Math.round((totalMonths / 12) * 10) / 10; // Round to 1 decimal place
      
      if (totalMonths > 0) {
        // Update total months
        processedUpdates['TotalExperienceInMonths'] = totalMonths;
        processedUpdates['Total Experience (months)'] = totalMonths;
        processedUpdates['totalexperienceinmonths'] = totalMonths;
        
        // Update total years
        processedUpdates['TotalExperienceInYears'] = totalYears;
        processedUpdates['Total Experience (years)'] = totalYears;
        processedUpdates['totalexperienceinyears'] = totalYears;
        processedUpdates['experience'] = totalYears;
        processedUpdates['Experience'] = totalYears;
        processedUpdates['Experience (years)'] = totalYears;
        processedUpdates['Total Experience'] = totalYears;
      }
    }

    // Auto-generate email if not provided but have other details
    const emailFieldNames = ['InstituteEmailId', 'email', 'Email', 'Institute Email ID'];
    const existingEmail = getFieldValue(emailFieldNames);
    
    if (!existingEmail || existingEmail === 'N/A' || existingEmail === '') {
      const nameFieldNames = ['FullName', 'fullname', 'Full Name', 'Name'];
      const nameValue = getFieldValue(nameFieldNames);
      
      if (nameValue && nameValue !== 'N/A' && nameValue !== '') {
        const cleanName = nameValue.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanName && MIScode) {
          const generatedEmail = `${cleanName}${MIScode}@paruluniversity.ac.in`;
          processedUpdates['InstituteEmailId'] = generatedEmail;
          processedUpdates['Institute Email ID'] = generatedEmail;
          processedUpdates['email'] = generatedEmail;
        }
      }
    }

    // Auto-update the "Updated Date" field with current timestamp (local date)
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // getMonth() is 0-indexed
    const day = String(currentDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`; // YYYY-MM-DD format in local timezone
    
    // Alternative formats if needed:
    // const formattedDate = currentDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
    // const formattedDate = currentDate.toLocaleDateString('en-US'); // MM/DD/YYYY
    
    processedUpdates['UpdatedDate'] = formattedDate;
    processedUpdates['Updated Date'] = formattedDate;
    processedUpdates['updateddate'] = formattedDate;

    // Prepare batch update requests
    const batchUpdateRequests = [];
    
    for (const [fieldName, newValue] of Object.entries(processedUpdates)) {
      // Find the column index for this field
      const columnIndex = headers.findIndex(header => 
        header.toLowerCase().replace(/[^a-z0-9]/g, '') === fieldName.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      

      
      if (columnIndex !== -1) {
        // Convert column index to A1 notation (handle columns beyond Z)
        let columnLetter = '';
        let tempIndex = columnIndex;
        
        if (tempIndex >= 26) {
          // For columns beyond Z (AA, AB, etc.)
          columnLetter = String.fromCharCode(64 + Math.floor(tempIndex / 26)) + String.fromCharCode(65 + (tempIndex % 26));
        } else {
          // For columns A-Z
          columnLetter = String.fromCharCode(65 + tempIndex);
        }
        
        const cellRange = `${escapedRange}!${columnLetter}${targetRowIndex + 1}`;
        

        
        batchUpdateRequests.push({
          range: cellRange,
          values: [[newValue]]
        });
      } else {

      }
    }

    if (batchUpdateRequests.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    // Execute batch update
    

    
    try {
      const updateResult = await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: batchUpdateRequests
        }
      });
      

      
    } catch (updateError) {
      console.error('=== DEBUG: Batch update failed ===');
      console.error('Error details:', updateError);
      console.error('Error message:', updateError.message);
      console.error('Error response:', updateError.response?.data);
      console.error('Error status:', updateError.response?.status);
      console.error('Error code:', updateError.code);
      
      // Check for common permission issues
      if (updateError.response?.status === 403) {
        console.error('PERMISSION DENIED: Check if the service account has edit access to the sheet');
      } else if (updateError.response?.status === 404) {
        console.error('SHEET NOT FOUND: Check if the spreadsheet ID is correct');
      } else if (updateError.response?.status === 400) {
        console.error('BAD REQUEST: Check the range format and data structure');
      }
      
      throw updateError; // Re-throw to be handled by outer catch
    }


    
    return res.status(200).json({ 
      message: "Profile updated successfully",
      updatedFields: Object.keys(processedUpdates).length,
      originalFields: Object.keys(updates).length,
      calculatedFields: Object.keys(processedUpdates).length - Object.keys(updates).length,
      MIScode: MIScode,
      processedUpdates: processedUpdates
    });

  } catch (error) {
    console.error("Error updating faculty profile:", error);
    return res.status(500).json({ 
      message: "Internal Server Error", 
      error: error.message 
    });
  }
};
