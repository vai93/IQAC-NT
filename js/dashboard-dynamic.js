// dashboard-dynamic.js
// Dynamically fetch and update counts in dashboard

// API endpoints
const apiBaseEvent = (location.port === '5500' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api/event'
  : '/api/event';

const apiBaseFaculty = (location.port === '5500' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

const sheet = "event";
const range = "organized";

const eventCountElem = document.getElementById("eventCount");
const facultyCountElem = document.getElementById("facultyCount");
const departmentCountElem = document.getElementById("departmentCount");
let totalFaculties;
// Get auth token
const authToken = localStorage.getItem("authTokenAdmin");

// Global variable to store faculty data for modal
let allFaculties = [];
let allFacultyProfiles = []; // Store full faculty profile data
let experienceDeptStats = {}; // { dept: {bucket counts, total}}
let experienceBucketTotals = {}; // { bucket: count }
let experienceTotalOverall = 0;
let experienceCustomDeptStats = null;
let experienceCustomTotal = 0;
let experienceCustomLabel = '';
let experienceFilterInitialized = false;

// Helper: simple CSV download
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(v => {
    const val = v == null ? '' : String(v).replace(/"/g, '""');
    return `"${val}"`;
  }).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper: safe filename slug
function slugifyFilename(str) {
  return (str || 'export')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'export';
}

// Helper: title-case words
function toTitleCaseWords(str) {
  return str.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Helper: normalize department, and split Applied Science And Humanities by Sub-Department when available
function getDepartmentLabel(fac) {
  let dept = (fac.Department || fac.department || "").trim();
  if (!dept) return null;
  const deptLower = dept.toLowerCase();
  if (deptLower === 'na' || dept === '-') return null;

  const subDept = (fac.SubDepartment || fac.subDepartment || fac['Sub Department'] || fac.subDept || fac.SubDept || "").trim();

  const deptTitle = toTitleCaseWords(dept);
  if (deptLower === 'applied science and humanities' && subDept) {
    const subLower = subDept.toLowerCase();
    let subLabel = toTitleCaseWords(subDept);
    if (subLower.includes('math')) subLabel = 'Maths';
    else if (subLower.includes('phys')) subLabel = 'Physics';
    return `${deptTitle} (${subLabel})`;
  }
  return deptTitle;
}

// Helper: classify qualification bucket consistently everywhere
function classifyQualification(fac) {
  const highestQualRaw = (
    fac.HighestQualification ||
    fac.highestQualification ||
    fac['Highest Qualification'] ||
    fac.Qualification ||
    fac.qualification ||
    fac['Educational Qualification'] ||
    fac.educationalQualification ||
    fac.qual ||
    fac.Qual ||
    ""
  ).toString();

  // Normalize: trim, lowercase, and strip leading non-letters (e.g., quotes, dots, hyphens)
  const highestQual = highestQualRaw.trim().toLowerCase().replace(/^[^a-z]+/g, '');

  // Ph.D based solely on highest qualification text
  if (highestQual.includes('ph.d') || highestQual.includes('phd')) {
    return 'Ph.D';
  }

  // PG bucket: only if degree text starts with 'm'
  if (highestQual.toLowerCase().startsWith('m')) {
    return 'M.Tech/PG';
}

  // UG bucket
  const bKeywords = ['b.tech', 'btech', 'b. tech', 'b.e', 'b e', 'ug', 'under graduate', 'undergraduate', 'bachelor'];
  if (bKeywords.some(k => highestQual.includes(k))) {
    return 'B.Tech/UG';
  }

  return null;
}

// Helper: detect Ph.D pursuing based on status fields
function isPhdPursuing(fac) {
  const phdStatus = (fac['Ph.D. Status'] || fac['Ph.D Status'] || fac.phdStatus || "").trim().toLowerCase();
  const phdPursuingRaw = (fac['Ph.D Pursuing'] || fac['Phd Pursuing'] || fac['PhdPursuing'] || fac.phdPursuing || fac.pursuingPhd || fac.pursuingphd || "").toString().trim().toLowerCase();
  const pursuingTokens = ['pursuing', 'ongoing', 'registered'];
  const pursueFlagTokens = ['yes', 'true', '1', 'y', ...pursuingTokens];
  return pursuingTokens.some(t => phdStatus.includes(t)) || pursueFlagTokens.includes(phdPursuingRaw);
}

// Helper: detect PG pursuing based on PGStatus column
function isPgPursuing(fac) {
  const pgStatus = (fac.PGStatus || fac.pgStatus || fac['PG Status'] || "").toString().trim().toLowerCase();
  return pgStatus === 'pursuing';
}

// Helper: detect if faculty has any degree from IIT/NIT
function hasDegreeFromNITIIT(fac) {
  const val = (fac.HasAnyDegreeFromIITorNIT || fac.hasAnyDegreeFromIITorNIT || "").toString().trim().toLowerCase();
  const yesTokens = ['yes', 'true', '1', 'y'];
  return yesTokens.includes(val);
}

// Function to fetch and display all departments
async function fetchDepartmentList() {
  const loadingDiv = document.getElementById('departmentListLoading');
  const contentDiv = document.getElementById('departmentListContent');
  const errorDiv = document.getElementById('departmentListError');
  const departmentGrid = document.getElementById('departmentGrid');
  const totalCountSpan = document.getElementById('totalDepartmentCount');
  const searchInput = document.getElementById('departmentSearch');

  // Show loading
  loadingDiv.style.display = 'block';
  contentDiv.style.display = 'none';
  errorDiv.style.display = 'none';

  try {
    if (allFaculties.length === 0) {
      // Fetch faculty data if not already loaded
      const params = new URLSearchParams({
        query: 'a',
        searchType: 'name_mis',
        limit: 1000
      });

      const response = await fetch(`${apiBaseFaculty}/faculty?${params.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) throw new Error("API error");
      const data = await response.json();

      // Filter only active faculties
      allFaculties = (data.results || []).filter(fac => {
        const active = fac.Active || fac.active;
        return active && active.toString().trim().toLowerCase() === "yes";
      });
    }

    // Get unique departments without faculty counts
    const departmentSet = new Set();
    allFaculties.forEach(fac => {
      const deptLabel = getDepartmentLabel(fac);
      if (deptLabel) departmentSet.add(deptLabel);
    });

    // Convert to array and sort alphabetically
    const sortedDepts = Array.from(departmentSet).sort((a, b) => a.localeCompare(b));

    totalCountSpan.textContent = sortedDepts.length;

    // Function to render departments
    function renderDepartments(departments) {
      departmentGrid.innerHTML = '';
      departments.forEach((dept) => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-3';
        col.innerHTML = `
          <div class="card h-100 border-0 shadow-sm department-card">
            <div class="card-body d-flex align-items-center">
              <div class="flex-shrink-0 me-3">
                <div class="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;">
                  <i class="bi bi-building text-warning"></i>
                </div>
              </div>
              <div class="flex-grow-1">
                <h6 class="card-title mb-0" title="${dept}">${dept}</h6>
              </div>
            </div>
          </div>
        `;
        departmentGrid.appendChild(col);
      });
    }

    // Initial render
    renderDepartments(sortedDepts);

    // Search functionality
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase().trim();
      if (searchTerm === '') {
        renderDepartments(sortedDepts);
      } else {
        const filtered = sortedDepts.filter((dept) => 
          dept.toLowerCase().includes(searchTerm)
        );
        renderDepartments(filtered);
      }
    });

    // Show content
    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';

  } catch (err) {
    console.error('Error fetching department list:', err);
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
  }
}

// Function to fetch and display department-wise faculty data
async function fetchDepartmentFacultyData() {
  const loadingDiv = document.getElementById('departmentFacultyLoading');
  const contentDiv = document.getElementById('departmentFacultyContent');
  const errorDiv = document.getElementById('departmentFacultyError');
  const tableBody = document.getElementById('departmentFacultyTableBody');
  const totalCountSpan = document.getElementById('totalFacultyCount');
  const tableHeadRow = tableBody?.closest('table')?.querySelector('thead tr');

  // Remove percentage column header if present
  if (tableHeadRow && tableHeadRow.children.length > 3) {
    tableHeadRow.removeChild(tableHeadRow.lastElementChild);
  }

  // Show loading
  loadingDiv.style.display = 'block';
  contentDiv.style.display = 'none';
  errorDiv.style.display = 'none';

  try {
    if (allFaculties.length === 0) {
      // Fetch faculty data if not already loaded
      const params = new URLSearchParams({
        query: 'a',
        searchType: 'name_mis',
        limit: 1000
      });

      const response = await fetch(`${apiBaseFaculty}/faculty?${params.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) throw new Error("API error");
      const data = await response.json();

      // Filter only active faculties
      allFaculties = (data.results || []).filter(fac => {
        const active = fac.Active || fac.active;
        return active && active.toString().trim().toLowerCase() === "yes";
      });
    }

    // Calculate totalFaculties from valid faculties BEFORE using it
    // This ensures totalFaculties is always set, even if the initial load hasn't completed
    const validFaculties = allFaculties.filter(fac => {
      const dept = getDepartmentLabel(fac);
      const mis = (fac.MIScode || fac.miscode || "").trim();
      const name = (fac.FullName || fac.fullname || fac.Name || "").trim();
      return dept && mis && name;
    });
    
    // Set totalFaculties here to ensure it's available for calculations
    const calculatedTotal = validFaculties.length;
    totalFaculties = calculatedTotal;

    // Group faculties by department
    const departmentCounts = {};
    allFaculties.forEach(fac => {
      const deptLabel = getDepartmentLabel(fac);
      if (deptLabel) {
        departmentCounts[deptLabel] = (departmentCounts[deptLabel] || 0) + 1;
      }
    });

    // Convert to array and sort by count (descending)
    const sortedDepts = Object.entries(departmentCounts)
      .sort(([, a], [, b]) => b - a);
    totalCountSpan.textContent = calculatedTotal;

    // Populate table (no percentage/progress)
    tableBody.innerHTML = '';
    sortedDepts.forEach(([dept, count], index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${dept}</strong></td>
        <td><span class="badge bg-primary">${count}</span></td>
      `;
      tableBody.appendChild(row);
    });

    // Show content
    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';

  } catch (err) {
    console.error('Error fetching department faculty data:', err);
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
  }
}

// Event listener for modal show
document.addEventListener('DOMContentLoaded', function() {
  const facultyModal = document.getElementById('departmentFacultyModal');
  if (facultyModal) {
    facultyModal.addEventListener('show.bs.modal', function() {
      fetchDepartmentFacultyData();
    });
  }

  const departmentModal = document.getElementById('departmentListModal');
  if (departmentModal) {
    departmentModal.addEventListener('show.bs.modal', function() {
      fetchDepartmentList();
    });
  }
});

if (!authToken) {
  if (eventCountElem) eventCountElem.textContent = "-";
  if (facultyCountElem) facultyCountElem.textContent = "-";
  if (departmentCountElem) departmentCountElem.textContent = "-";
} else {
  // --- Organized Events ---
  try {
    const response = await fetch(`${apiBaseEvent}/readEventSheet`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sheet, range })
    });

    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    const events = data.data || [];
    if (eventCountElem) eventCountElem.textContent = events.length;
  } catch (err) {
    if (eventCountElem) eventCountElem.textContent = "-";
  }

  // --- Faculties & Departments ---
  try {
    const params = new URLSearchParams({
      query: 'a',
      searchType: 'name_mis',
      limit: 1000
    });

    const response = await fetch(`${apiBaseFaculty}/faculty?${params.toString()}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) throw new Error("API error");
    const data = await response.json();

    // 🔹 Only Active = Yes
    const faculties = (data.results || []).filter(fac => {
      const active = fac.Active || fac.active;
      return active && active.toString().trim().toLowerCase() === "yes";
    });
    
    // Count only valid faculty entries
    const validFaculties = faculties.filter(fac => {
      const dept = (fac.Department || fac.department || "").trim();
      const mis = (fac.MIScode || fac.miscode || "").trim();
      const name = (fac.FullName || fac.fullname || fac.Name || "").trim();

      return dept && dept.toLowerCase() !== "na" && dept !== "-" && mis && name;
    });
    totalFaculties=validFaculties.length;
    if (facultyCountElem) facultyCountElem.textContent = totalFaculties;

    const departments = new Set();
    faculties.forEach(fac => {
      let dept = fac.Department || fac.department;
      if (dept && typeof dept === "string") {
        dept = dept.trim().toLowerCase();
        if (dept && dept !== "na" && dept !== "-") {
          departments.add(dept);
        }
      }
    });

    if (departmentCountElem) departmentCountElem.textContent = departments.size;
    
    // Store faculty profiles for statistics
    allFacultyProfiles = validFaculties;
    
    // Load designation and qualification statistics
    loadDesignationAndQualificationStats();
  } catch (err) {
    if (facultyCountElem) facultyCountElem.textContent = "-";
    if (departmentCountElem) departmentCountElem.textContent = "-";
  }
}

// Function to load and display designation and qualification statistics
async function loadDesignationAndQualificationStats() {
  const designationLoading = document.getElementById('designationStatsLoading');
  const designationContent = document.getElementById('designationStatsContent');
  const designationBody = document.getElementById('designationStatsBody');
  const designationTotal = document.getElementById('designationTotal');
  
  const qualificationLoading = document.getElementById('qualificationStatsLoading');
  const qualificationContent = document.getElementById('qualificationStatsContent');
  const qualificationBody = document.getElementById('qualificationStatsBody');
  const qualificationTotal = document.getElementById('qualificationTotal');

  const experienceLoading = document.getElementById('experienceStatsLoading');
  const experienceContent = document.getElementById('experienceStatsContent');
  const experienceBody = document.getElementById('experienceStatsBody');
  const experienceTotal = document.getElementById('experienceTotal');

  const experienceFilterOp = document.getElementById('experienceFilterOp');
  const experienceFilterVal1 = document.getElementById('experienceFilterVal1');
  const experienceFilterVal2 = document.getElementById('experienceFilterVal2');
  const experienceFilterVal2Wrapper = document.getElementById('experienceFilterVal2Wrapper');
  const experienceFilterApply = document.getElementById('experienceFilterApply');
  const experienceFilterCount = document.getElementById('experienceFilterCount');
  const experienceFilterDeptBtn = document.getElementById('experienceFilterDeptBtn');
  const experienceSourceSelect = document.getElementById('experienceSourceSelect');

  try {
    // Fetch full faculty profile data if not already loaded
    if (allFacultyProfiles.length === 0) {
      const params = new URLSearchParams({
        query: 'a',
        searchType: 'name_mis',
        limit: 1000
      });

      const response = await fetch(`${apiBaseFaculty}/faculty?${params.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) throw new Error("API error");
      const data = await response.json();

      // Filter only active faculties
      const faculties = (data.results || []).filter(fac => {
        const active = fac.Active || fac.active;
        return active && active.toString().trim().toLowerCase() === "yes";
      });
      
      // Get valid faculties
      allFacultyProfiles = faculties.filter(fac => {
        const dept = (fac.Department || fac.department || "").trim();
        const mis = (fac.MIScode || fac.miscode || "").trim();
        const name = (fac.FullName || fac.fullname || fac.Name || "").trim();
        return dept && dept.toLowerCase() !== "na" && dept !== "-" && mis && name;
      });
    }

    // Calculate Designation-wise statistics
    const designationCounts = {
      'Professor': 0,
      'Associate Professor': 0,
      'Assistant Professor': 0,
      'Adhoc/Lecturer': 0
    };
    const deptDesignationCounts = {}; // { dept: {Professor:0,..., total:0} }
    let nitIITCount = 0;
    const deptNitIITCounts = {}; // { dept: count }

    allFacultyProfiles.forEach(fac => {
      const designation = (fac.Designation || fac.designation || "").trim();
      const deptLabel = getDepartmentLabel(fac);
      if (hasDegreeFromNITIIT(fac)) {
        nitIITCount++;
        if (deptLabel) {
          deptNitIITCounts[deptLabel] = (deptNitIITCounts[deptLabel] || 0) + 1;
        }
      }
      if (designation) {
        const desigLower = designation.toLowerCase();
        if (desigLower.includes('professor') && !desigLower.includes('associate') && !desigLower.includes('assistant')) {
          const bucket = 'Professor';
          designationCounts[bucket]++;
          if (deptLabel) {
            if (!deptDesignationCounts[deptLabel]) {
              deptDesignationCounts[deptLabel] = { 'Professor': 0, 'Associate Professor': 0, 'Assistant Professor': 0, 'Adhoc/Lecturer': 0, total: 0 };
            }
            deptDesignationCounts[deptLabel][bucket]++;
            deptDesignationCounts[deptLabel].total++;
          }
        } else if (desigLower.includes('associate professor')) {
          const bucket = 'Associate Professor';
          designationCounts[bucket]++;
          if (deptLabel) {
            if (!deptDesignationCounts[deptLabel]) {
              deptDesignationCounts[deptLabel] = { 'Professor': 0, 'Associate Professor': 0, 'Assistant Professor': 0, 'Adhoc/Lecturer': 0, total: 0 };
            }
            deptDesignationCounts[deptLabel][bucket]++;
            deptDesignationCounts[deptLabel].total++;
          }
        } else if (desigLower.includes('assistant professor')) {
          const bucket = 'Assistant Professor';
          designationCounts[bucket]++;
          if (deptLabel) {
            if (!deptDesignationCounts[deptLabel]) {
              deptDesignationCounts[deptLabel] = { 'Professor': 0, 'Associate Professor': 0, 'Assistant Professor': 0, 'Adhoc/Lecturer': 0, total: 0 };
            }
            deptDesignationCounts[deptLabel][bucket]++;
            deptDesignationCounts[deptLabel].total++;
          }
        } else if (desigLower.includes('adhoc') || desigLower.includes('lecturer') || desigLower.includes('lecture')) {
          const bucket = 'Adhoc/Lecturer';
          designationCounts[bucket]++;
          if (deptLabel) {
            if (!deptDesignationCounts[deptLabel]) {
              deptDesignationCounts[deptLabel] = { 'Professor': 0, 'Associate Professor': 0, 'Assistant Professor': 0, 'Adhoc/Lecturer': 0, total: 0 };
            }
            deptDesignationCounts[deptLabel][bucket]++;
            deptDesignationCounts[deptLabel].total++;
          }
        }
      }
    });

    const designationTotalCount = Object.values(designationCounts).reduce((a, b) => a + b, 0);
    
    // Populate designation table
    designationBody.innerHTML = '';
    Object.entries(designationCounts).forEach(([desig, count]) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${desig}</td>
        <td class="text-center">
          <span class="badge bg-primary" style="cursor: pointer;" 
                onclick="showDesignationDeptBreakdown('${desig}')" 
                title="Click to see department-wise breakdown">${count}</span>
        </td>
      `;
      designationBody.appendChild(row);
    });

    // Extra row for IIT/NIT degree holders (not part of designation totals)
    const nitIITRow = document.createElement('tr');
    nitIITRow.innerHTML = `
      <td>NIT/IIT (HasAnyDegreeFromIITorNIT)</td>
      <td class="text-center">
        <span class="badge bg-secondary" style="cursor: pointer;"
              onclick="showDesignationDeptBreakdown('NIT/IIT')"
              title="Click to see department-wise breakdown">${nitIITCount}</span>
      </td>
    `;
    designationBody.appendChild(nitIITRow);

    designationTotal.textContent = designationTotalCount;

    // Dept-wise Designation export matrix (Department, Professor, Associate, Assistant, Adhoc, Total)
    const deptDesigCsv = [['Department', 'Professor', 'Associate Professor', 'Assistant Professor', 'Adhoc/Lecturer', 'Total', 'NIT/IIT (HasAnyDegreeFromIITorNIT)']];
    const deptKeys = Array.from(new Set([
      ...Object.keys(deptDesignationCounts),
      ...Object.keys(deptNitIITCounts)
    ])).sort((a, b) => a.localeCompare(b));

    deptKeys.forEach(dept => {
      const counts = deptDesignationCounts[dept] || { 'Professor': 0, 'Associate Professor': 0, 'Assistant Professor': 0, 'Adhoc/Lecturer': 0, total: 0 };
      const nitIITDept = deptNitIITCounts[dept] || 0;
      deptDesigCsv.push([
        dept,
        counts['Professor'] || 0,
        counts['Associate Professor'] || 0,
        counts['Assistant Professor'] || 0,
        counts['Adhoc/Lecturer'] || 0,
        counts.total || 0,
        nitIITDept
      ]);
    });
    deptDesigCsv.push([
      'Total',
      designationCounts['Professor'] || 0,
      designationCounts['Associate Professor'] || 0,
      designationCounts['Assistant Professor'] || 0,
      designationCounts['Adhoc/Lecturer'] || 0,
      designationTotalCount,
      nitIITCount
    ]);
    const designationBtnContainer =
      document.getElementById('designationStatsActions') ||
      document.getElementById('designationStatsHeader') ||
      designationContent?.closest('.card')?.querySelector('.card-header') ||
      designationContent?.previousElementSibling;

    if (designationBtnContainer) {
      let desigDeptBtn = document.getElementById('designationDeptMatrixDownload');
      if (!desigDeptBtn) {
        desigDeptBtn = document.createElement('button');
        desigDeptBtn.id = 'designationDeptMatrixDownload';
        desigDeptBtn.type = 'button';
        desigDeptBtn.className = 'btn btn-sm btn-outline-primary ms-2';
        designationBtnContainer.appendChild(desigDeptBtn);
      }
      desigDeptBtn.textContent = 'Download';
      desigDeptBtn.onclick = () => downloadCSV('designation-dept-wise.csv', deptDesigCsv);
    }

    // Calculate Qualification-wise statistics
    const qualificationCounts = {
      'Ph.D': 0,
      'M.Tech/PG': 0,
      'B.Tech/UG': 0
    };
    const deptQualificationCounts = {}; // { dept: {Ph.D:0, M.Tech/PG:0, B.Tech/UG:0, Ph.D Pursuing (status):0, PG Pursuing (status):0, total:0} }
    let phdPursuingCount = 0;
    let pgPursuingCount = 0;

    allFacultyProfiles.forEach(fac => {
      if (isPhdPursuing(fac)) {
        phdPursuingCount++;
      }
      if (isPgPursuing(fac)) {
        pgPursuingCount++;
      }

      const bucket = classifyQualification(fac);
      if (bucket && qualificationCounts[bucket] !== undefined) {
        qualificationCounts[bucket]++;
        let dept = fac.Department || fac.department;
        if (dept && typeof dept === "string") {
          dept = dept.trim();
          if (dept && dept.toLowerCase() !== "na" && dept !== "-") {
            dept = dept.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            if (!deptQualificationCounts[dept]) {
              deptQualificationCounts[dept] = { 'Ph.D': 0, 'M.Tech/PG': 0, 'B.Tech/UG': 0, 'Ph.D Pursuing (status)': 0, 'PG Pursuing (status)': 0, total: 0 };
            }
            deptQualificationCounts[dept][bucket]++;
            deptQualificationCounts[dept].total++;
          }
        }
      }

      if (isPhdPursuing(fac)) {
        let dept = fac.Department || fac.department;
        if (dept && typeof dept === "string") {
          dept = dept.trim();
          if (dept && dept.toLowerCase() !== "na" && dept !== "-") {
            dept = dept.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            if (!deptQualificationCounts[dept]) {
              deptQualificationCounts[dept] = { 'Ph.D': 0, 'M.Tech/PG': 0, 'B.Tech/UG': 0, 'Ph.D Pursuing (status)': 0, 'PG Pursuing (status)': 0, total: 0 };
            }
            deptQualificationCounts[dept]['Ph.D Pursuing (status)']++;
          }
        }
      }

      if (isPgPursuing(fac)) {
        let dept = fac.Department || fac.department;
        if (dept && typeof dept === "string") {
          dept = dept.trim();
          if (dept && dept.toLowerCase() !== "na" && dept !== "-") {
            dept = dept.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            if (!deptQualificationCounts[dept]) {
              deptQualificationCounts[dept] = { 'Ph.D': 0, 'M.Tech/PG': 0, 'B.Tech/UG': 0, 'Ph.D Pursuing (status)': 0, 'PG Pursuing (status)': 0, total: 0 };
            }
            deptQualificationCounts[dept]['PG Pursuing (status)']++;
          }
        }
      }
    });

    const qualificationTotalCount = Object.values(qualificationCounts).reduce((a, b) => a + b, 0);
    
    // Populate qualification table with Ph.D Pursuing first, then others
    qualificationBody.innerHTML = '';
    const qualificationDisplayOrder = ['Ph.D', 'M.Tech/PG', 'B.Tech/UG'];
    qualificationDisplayOrder.forEach(qual => {
      const count = qualificationCounts[qual] || 0;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${qual}</td>
        <td class="text-center">
          <span class="badge bg-success" style="cursor: pointer;" 
                onclick="showQualificationDeptBreakdown('${qual}')" 
                title="Click to see department-wise breakdown">${count}</span>
        </td>
      `;
      qualificationBody.appendChild(row);
    });
    qualificationTotal.textContent = qualificationTotalCount;

    // Add a separate row for Ph.D Pursuing (status) without affecting totals
    const pursuingRow = document.createElement('tr');
    pursuingRow.innerHTML = `
      <td>Ph.D Pursuing (status)</td>
      <td class="text-center">
        <span class="badge bg-secondary" style="cursor: pointer;"
              onclick="showQualificationDeptBreakdown('Ph.D Pursuing (status)')"
              title="Click to see department-wise breakdown">${phdPursuingCount}</span>
      </td>
    `;
    qualificationBody.appendChild(pursuingRow);

    // Add a separate row for PG Pursuing (status) without affecting totals
    const pgPursuingRow = document.createElement('tr');
    pgPursuingRow.innerHTML = `
      <td>PG Pursuing (status)</td>
      <td class="text-center">
        <span class="badge bg-secondary" style="cursor: pointer;"
              onclick="showQualificationDeptBreakdown('PG Pursuing (status)')"
              title="Click to see department-wise breakdown">${pgPursuingCount}</span>
      </td>
    `;
    qualificationBody.appendChild(pgPursuingRow);

    // Locate header container for qualification downloads
    const qualificationBtnContainer =
      document.getElementById('qualificationStatsActions') ||
      document.getElementById('qualificationStatsHeader') ||
      qualificationContent?.parentElement?.querySelector('.card-header') ||
      qualificationContent?.previousElementSibling ||
      qualificationTotal?.parentElement;

    // Dept-wise Qualification export (rows: dept, Ph.D, PG, UG, Pursuing, Total)
    const deptQualCsv = [['Department', 'Ph.D', 'M.Tech/PG', 'B.Tech/UG', 'Total', 'Ph.D Pursuing (status)', 'PG Pursuing (status)']];
    Object.entries(deptQualificationCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dept, counts]) => {
        deptQualCsv.push([
          dept,
          counts['Ph.D'] || 0,
          counts['M.Tech/PG'] || 0,
          counts['B.Tech/UG'] || 0,
          counts.total || 0,
          counts['Ph.D Pursuing (status)'] || 0,
          counts['PG Pursuing (status)'] || 0
        ]);
      });
    deptQualCsv.push([
      'Total',
      qualificationCounts['Ph.D'] || 0,
      qualificationCounts['M.Tech/PG'] || 0,
      qualificationCounts['B.Tech/UG'] || 0,
      qualificationTotalCount,
      phdPursuingCount,
      pgPursuingCount
    ]);
    if (qualificationBtnContainer) {
      let qualDeptBtn = document.getElementById('qualificationDeptMatrixDownload');
      if (!qualDeptBtn) {
        qualDeptBtn = document.createElement('button');
        qualDeptBtn.id = 'qualificationDeptMatrixDownload';
        qualDeptBtn.type = 'button';
        qualDeptBtn.className = 'btn btn-sm btn-outline-success ms-2 float-end';
        qualificationBtnContainer.insertAdjacentElement('beforeend', qualDeptBtn);
      }
      qualDeptBtn.textContent = 'Download';
      qualDeptBtn.onclick = () => downloadCSV('qualification-dept-wise.csv', deptQualCsv);
    }

    // Calculate Experience statistics (TotalExperienceInYears)
    if (experienceBody && experienceTotal) {
      const experienceBuckets = {
        '0-5 Years (A)': 0,
        '5-10 Years (B)': 0,
        '10+ Years (C)': 0
      };
      const deptExperienceCounts = {}; // { dept: {A:0,B:0,C:0,total:0} }

      allFacultyProfiles.forEach(fac => {
        const rawExp =
          fac.TotalExperienceInYears ??
          fac.totalExperienceInYears ??
          fac.TotalExperience ??
          fac.totalExperience ??
          fac.TotalExperienceYears ??
          fac.totalExperienceYears ??
          "";

        const expNum = parseFloat(String(rawExp).replace(/[^0-9.+-]/g, ''));
        if (!Number.isFinite(expNum) || expNum < 0) return;

        let bucketKey = null;
        if (expNum <= 5) bucketKey = '0-5 Years (A)';
        else if (expNum > 5 && expNum <= 10) bucketKey = '5-10 Years (B)';
        else if (expNum > 10) bucketKey = '10+ Years (C)';

        if (bucketKey) {
          experienceBuckets[bucketKey]++;
          const deptLabel = getDepartmentLabel(fac);
          if (deptLabel) {
            if (!deptExperienceCounts[deptLabel]) {
              deptExperienceCounts[deptLabel] = { '0-5 Years (A)': 0, '5-10 Years (B)': 0, '10+ Years (C)': 0, total: 0 };
            }
            deptExperienceCounts[deptLabel][bucketKey]++;
            deptExperienceCounts[deptLabel].total++;
          }
        }
      });

      const experienceTotalCount = Object.values(experienceBuckets).reduce((a, b) => a + b, 0);

      // Populate experience table
      experienceBody.innerHTML = '';
      const experienceOrder = ['0-5 Years (A)', '5-10 Years (B)', '10+ Years (C)'];
      experienceOrder.forEach(bucket => {
        const count = experienceBuckets[bucket] || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${bucket}</td>
          <td class="text-center">
            <span class="badge bg-info" style="cursor: pointer;"
                  onclick="showExperienceDeptBreakdown('${bucket}')"
                  title="Click to see department-wise breakdown">${count}</span>
          </td>
        `;
        experienceBody.appendChild(row);
      });
      experienceTotal.textContent = experienceTotalCount;

      // cache for modal use
      experienceDeptStats = deptExperienceCounts;
      experienceBucketTotals = experienceBuckets;
      experienceTotalOverall = experienceTotalCount;

      // Downloads
      const experienceBtnContainer =
        document.getElementById('experienceStatsActions') ||
        document.getElementById('experienceStatsHeader') ||
        experienceContent?.closest('.card')?.querySelector('.card-header') ||
        experienceContent?.previousElementSibling ||
        experienceTotal?.parentElement;

      const deptExpCsv = [['Department', '0-5 Years (A)', '5-10 Years (B)', '10+ Years (C)', 'Total']];
      Object.entries(deptExperienceCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([dept, counts]) => {
          deptExpCsv.push([
            dept,
            counts['0-5 Years (A)'] || 0,
            counts['5-10 Years (B)'] || 0,
            counts['10+ Years (C)'] || 0,
            counts.total || 0
          ]);
        });
      deptExpCsv.push([
        'Total',
        experienceBuckets['0-5 Years (A)'] || 0,
        experienceBuckets['5-10 Years (B)'] || 0,
        experienceBuckets['10+ Years (C)'] || 0,
        experienceTotalCount
      ]);

      if (experienceBtnContainer) {
        let expDeptBtn = document.getElementById('experienceDeptDownload');
        if (!expDeptBtn) {
          expDeptBtn = document.createElement('button');
          expDeptBtn.id = 'experienceDeptDownload';
          expDeptBtn.type = 'button';
          expDeptBtn.className = 'btn btn-sm btn-outline-info ms-2 float-end';
          experienceBtnContainer.insertAdjacentElement('beforeend', expDeptBtn);
        }
        expDeptBtn.textContent = 'Download';
        expDeptBtn.onclick = () => downloadCSV('experience-dept-wise.csv', deptExpCsv);
      }

      if (experienceLoading) experienceLoading.style.display = 'none';
      if (experienceContent) experienceContent.style.display = 'block';
    }

    // Initialize experience custom filter once
    if (!experienceFilterInitialized && experienceFilterOp && experienceFilterVal1 && experienceFilterApply && experienceFilterCount && experienceFilterDeptBtn) {
      experienceFilterInitialized = true;

      const toggleSecondInput = () => {
        if (experienceFilterOp.value === 'between') {
          experienceFilterVal2Wrapper.style.display = '';
        } else {
          experienceFilterVal2Wrapper.style.display = 'none';
          experienceFilterVal2.value = '';
        }
      };
      experienceFilterOp.addEventListener('change', toggleSecondInput);
      toggleSecondInput();

      experienceFilterDeptBtn.disabled = true;
      experienceFilterDeptBtn.onclick = () => {
        if (experienceCustomDeptStats) {
          showExperienceCustomDeptBreakdown();
        }
      };

      experienceFilterApply.addEventListener('click', () => {
        const op = (experienceFilterOp.value || '').toLowerCase();
        const v1 = parseFloat(experienceFilterVal1.value);
        const v2 = parseFloat(experienceFilterVal2?.value);
        const source = (experienceSourceSelect?.value || 'TotalExperienceInYears').toString();

        const validOp = ['<', '<=', '=', '>=', '>', 'between'].includes(op);
        const needsSecond = op === 'between';
        const v1Ok = Number.isFinite(v1) && v1 >= 0;
        const v2Ok = !needsSecond || (Number.isFinite(v2) && v2 >= 0);

        if (!validOp || !v1Ok || !v2Ok) {
          experienceFilterCount.textContent = '0';
          experienceCustomDeptStats = null;
          experienceCustomTotal = 0;
          experienceCustomLabel = '';
          experienceFilterDeptBtn.disabled = true;
          return;
        }

        let minVal = v1;
        let maxVal = v1;
        let label = `Source: ${source} | `;
        if (op === 'between') {
          minVal = Math.min(v1, v2);
          maxVal = Math.max(v1, v2);
          label += `Between ${minVal} and ${maxVal} years`;
        } else {
          label += `${op} ${v1} years`;
        }

        const deptCounts = {};
        let total = 0;
        const fromMonthsToYears = val => val / 12;
        allFacultyProfiles.forEach(fac => {
          let rawExp = "";
          if (source === 'IndustryExperienceInMonths') {
            rawExp = fac.IndustryExperienceInMonths ?? fac.industryExperienceInMonths ?? "";
          } else if (source === 'CurrentPUExperienceInMonths') {
            rawExp = fac.CurrentPUExperienceInMonths ?? fac.currentPUExperienceInMonths ?? "";
          } else if (source === 'TotalPUExperienceInMonths') {
            rawExp = fac.TotalPUExperienceInMonths ?? fac.totalPUExperienceInMonths ?? "";
          } else if (source === 'TotalTeachingExperienceInMonths') {
            rawExp = fac.TotalTeachingExperienceInMonths ?? fac.totalTeachingExperienceInMonths ?? "";
          } else {
            rawExp =
              fac.TotalExperienceInYears ??
              fac.totalExperienceInYears ??
              fac.TotalExperience ??
              fac.totalExperience ??
              fac.TotalExperienceYears ??
              fac.totalExperienceYears ??
              "";
          }

          let expNum = parseFloat(String(rawExp).replace(/[^0-9.+-]/g, ''));
          if (!Number.isFinite(expNum) || expNum < 0) return;
          if (source !== 'TotalExperienceInYears') {
            expNum = fromMonthsToYears(expNum);
          }

          let match = false;
          switch (op) {
            case '<': match = expNum < v1; break;
            case '<=': match = expNum <= v1; break;
            case '=': match = expNum === v1; break;
            case '>=': match = expNum >= v1; break;
            case '>': match = expNum > v1; break;
            case 'between': match = expNum >= minVal && expNum <= maxVal; break;
          }
          if (!match) return;

          total++;
          const deptLabel = getDepartmentLabel(fac);
          if (deptLabel) {
            if (!deptCounts[deptLabel]) {
              deptCounts[deptLabel] = 0;
            }
            deptCounts[deptLabel]++;
          }
        });

        experienceFilterCount.textContent = total;
        experienceCustomDeptStats = deptCounts;
        experienceCustomTotal = total;
        experienceCustomLabel = label;
        experienceFilterDeptBtn.disabled = total === 0;
      });
    }

    // Show content
    designationLoading.style.display = 'none';
    designationContent.style.display = 'block';
    qualificationLoading.style.display = 'none';
    qualificationContent.style.display = 'block';

  } catch (err) {
    console.error('Error loading designation and qualification stats:', err);
    designationLoading.style.display = 'none';
    qualificationLoading.style.display = 'none';
    if (experienceLoading) experienceLoading.style.display = 'none';
  }
}

// Function to show department-wise breakdown for a specific designation
// Make it global so it can be called from inline onclick handlers
window.showDesignationDeptBreakdown = function(designation) {
  const modal = document.getElementById('designationDeptModal');
  const modalTitle = document.getElementById('designationDeptModalTitle');
  const loadingDiv = document.getElementById('designationDeptLoading');
  const contentDiv = document.getElementById('designationDeptContent');
  const errorDiv = document.getElementById('designationDeptError');
  const tableBody = document.getElementById('designationDeptTableBody');
  const totalSpan = document.getElementById('designationDeptTotal');
  const tableHeadRow = modal.querySelector('thead tr');

  // Remove percentage column header if present
  if (tableHeadRow && tableHeadRow.children.length > 3) {
    tableHeadRow.removeChild(tableHeadRow.lastElementChild);
  }

  // Update modal title
  modalTitle.textContent = designation;

  // Show loading
  loadingDiv.style.display = 'block';
  contentDiv.style.display = 'none';
  errorDiv.style.display = 'none';

  try {
    // Filter faculties by designation
    const filteredFaculties = allFacultyProfiles.filter(fac => {
      const facDesignation = (fac.Designation || fac.designation || "").trim();
      const targetLower = designation.toLowerCase();

      if (targetLower === 'nit/iit') {
        return hasDegreeFromNITIIT(fac);
      }

      if (!facDesignation) return false;
      const desigLower = facDesignation.toLowerCase();
      
      if (targetLower === 'professor') {
        return desigLower.includes('professor') && 
               !desigLower.includes('associate') && 
               !desigLower.includes('assistant');
      } else if (targetLower === 'associate professor') {
        return desigLower.includes('associate professor');
      } else if (targetLower === 'assistant professor') {
        return desigLower.includes('assistant professor');
      } else if (targetLower === 'adhoc/lecturer') {
        return desigLower.includes('adhoc') || 
               desigLower.includes('lecturer') || 
               desigLower.includes('lecture');
      }
      return false;
    });

    // Group by department
    const deptCounts = {};
    filteredFaculties.forEach(fac => {
      const deptLabel = getDepartmentLabel(fac);
      if (deptLabel) {
        deptCounts[deptLabel] = (deptCounts[deptLabel] || 0) + 1;
      }
    });

    // Sort by count (descending)
    const sortedDepts = Object.entries(deptCounts)
      .sort(([, a], [, b]) => b - a);
    
    const total = filteredFaculties.length;
    totalSpan.textContent = total;

    // Populate table (no percentage/progress)
    tableBody.innerHTML = '';
    sortedDepts.forEach(([dept, count], index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${dept}</strong></td>
        <td><span class="badge bg-primary">${count}</span></td>
      `;
      tableBody.appendChild(row);
    });

    // Show content
    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';

    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

  } catch (err) {
    console.error('Error loading designation department breakdown:', err);
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
  }
}

// Function to show department-wise breakdown for a specific qualification
// Make it global so it can be called from inline onclick handlers
window.showQualificationDeptBreakdown = function(qualification) {
  const modal = document.getElementById('qualificationDeptModal');
  const modalTitle = document.getElementById('qualificationDeptModalTitle');
  const loadingDiv = document.getElementById('qualificationDeptLoading');
  const contentDiv = document.getElementById('qualificationDeptContent');
  const errorDiv = document.getElementById('qualificationDeptError');
  const tableBody = document.getElementById('qualificationDeptTableBody');
  const totalSpan = document.getElementById('qualificationDeptTotal');
  const tableHeadRow = modal.querySelector('thead tr');

  // Remove percentage column header if present
  if (tableHeadRow && tableHeadRow.children.length > 3) {
    tableHeadRow.removeChild(tableHeadRow.lastElementChild);
  }

  // Update modal title
  modalTitle.textContent = qualification;

  // Show loading
  loadingDiv.style.display = 'block';
  contentDiv.style.display = 'none';
  errorDiv.style.display = 'none';

  try {
    // Filter faculties by qualification - use EXACT same logic as initial calculation
    const filteredFaculties = allFacultyProfiles.filter(fac => {
      if (qualification === 'Ph.D Pursuing (status)') {
        return isPhdPursuing(fac);
      }
      if (qualification === 'PG Pursuing (status)') {
        return isPgPursuing(fac);
      }
      return classifyQualification(fac) === qualification;
    });

    // Group by department
    const deptCounts = {};
    filteredFaculties.forEach(fac => {
      const deptLabel = getDepartmentLabel(fac);
      if (deptLabel) {
        deptCounts[deptLabel] = (deptCounts[deptLabel] || 0) + 1;
      }
    });

    // Sort by count (descending)
    const sortedDepts = Object.entries(deptCounts)
      .sort(([, a], [, b]) => b - a);
    
    const total = filteredFaculties.length;
    totalSpan.textContent = total;

    // Populate table (no percentage/progress)
    tableBody.innerHTML = '';
    sortedDepts.forEach(([dept, count], index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${dept}</strong></td>
        <td><span class="badge bg-success">${count}</span></td>
      `;
      tableBody.appendChild(row);
    });

    // Show content
    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';

    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

  } catch (err) {
    console.error('Error loading qualification department breakdown:', err);
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
  }
}

// Function to show department-wise breakdown for a specific experience bucket
// Make it global so it can be called from inline onclick handlers
window.showExperienceDeptBreakdown = function(bucketLabel) {
  const modal = document.getElementById('experienceDeptModal');
  const modalTitle = document.getElementById('experienceDeptModalTitle');
  const loadingDiv = document.getElementById('experienceDeptLoading');
  const contentDiv = document.getElementById('experienceDeptContent');
  const errorDiv = document.getElementById('experienceDeptError');
  const tableBody = document.getElementById('experienceDeptTableBody');
  const totalSpan = document.getElementById('experienceDeptTotal');
  const tableHeadRow = modal?.querySelector('thead tr');

  // Remove percentage column header if present
  if (tableHeadRow && tableHeadRow.children.length > 3) {
    tableHeadRow.removeChild(tableHeadRow.lastElementChild);
  }

  if (!bucketLabel || !experienceDeptStats || !experienceBucketTotals) return;

  modalTitle.textContent = bucketLabel;
  loadingDiv.style.display = 'block';
  contentDiv.style.display = 'none';
  errorDiv.style.display = 'none';

  try {
    const rows = Object.entries(experienceDeptStats || {})
      .map(([dept, counts]) => ({ dept, count: counts[bucketLabel] || 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count || a.dept.localeCompare(b.dept));

    const total = rows.reduce((sum, r) => sum + r.count, 0);
    totalSpan.textContent = total;

    tableBody.innerHTML = '';
    rows.forEach((row, idx) => {
      const percent = experienceTotalOverall ? ((row.count / experienceTotalOverall) * 100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${row.dept}</strong></td>
        <td><span class="badge bg-info">${row.count}</span></td>
      `;
      tableBody.appendChild(tr);
    });

    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  } catch (err) {
    console.error('Error loading experience department breakdown:', err);
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
  }
}

// Function to show department-wise breakdown for custom experience filter
window.showExperienceCustomDeptBreakdown = function() {
  if (!experienceCustomDeptStats) return;

  const modal = document.getElementById('experienceDeptModal');
  const modalTitle = document.getElementById('experienceDeptModalTitle');
  const loadingDiv = document.getElementById('experienceDeptLoading');
  const contentDiv = document.getElementById('experienceDeptContent');
  const errorDiv = document.getElementById('experienceDeptError');
  const tableBody = document.getElementById('experienceDeptTableBody');
  const totalSpan = document.getElementById('experienceDeptTotal');
  const tableHeadRow = modal?.querySelector('thead tr');

  // Remove percentage column header if present
  if (tableHeadRow && tableHeadRow.children.length > 3) {
    tableHeadRow.removeChild(tableHeadRow.lastElementChild);
  }

  modalTitle.textContent = experienceCustomLabel || 'Experience (Custom)';
  loadingDiv.style.display = 'block';
  contentDiv.style.display = 'none';
  errorDiv.style.display = 'none';

  try {
    const rows = Object.entries(experienceCustomDeptStats || {})
      .map(([dept, count]) => ({ dept, count }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count || a.dept.localeCompare(b.dept));

    const total = experienceCustomTotal || rows.reduce((sum, r) => sum + r.count, 0);
    totalSpan.textContent = total;

    tableBody.innerHTML = '';
    rows.forEach((row, idx) => {
      const percent = total ? ((row.count / total) * 100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${row.dept}</strong></td>
        <td><span class="badge bg-info">${row.count}</span></td>
      `;
      tableBody.appendChild(tr);
    });

    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  } catch (err) {
    console.error('Error loading custom experience department breakdown:', err);
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
  }
}
