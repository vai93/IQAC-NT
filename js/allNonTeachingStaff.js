// API Configuration
const apiBase1 = (location.port === '5501'||location.port === '5500' || location.hostname === '127.0.0.1') ? 'http://localhost:3000/api' : '/api';
let editingIndex1 = null;
let allStaff = [];
let TeachingStaffTableBody;
const detailsModal1 = new bootstrap.Modal(document.getElementById('detailsModal1'));

function toggleTeachingStaff() {
    const tableContainer = document.getElementById("TeachingStaffTable");
    if (tableContainer.style.display === "none") {
        tableContainer.style.display = "block";
    } else {
        tableContainer.style.display = "none";
    }
}


async function renderEvents1() {
    TeachingStaffTableBody.innerHTML = `
      <tr><td colspan="7" class="text-center text-muted">Loading Details...</td></tr>`;
    let loadedCount = 0;
    const LOAD_INITIAL = 50;
    const LOAD_MORE = 20;
    const loadMoreBtn = document.getElementById('loadMoreTeachingStaffBtn');
    try {
        const apiUrl = `${apiBase1}/faculty`;
    const response = await fetch(apiUrl, {

      method: "GET",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("authTokenNT")}`,
        "Content-Type": "application/json"
      }
    });

        if (!response.ok) throw new Error("API error: " + response.statusText);

        const data1 = await response.json();
        allStaff = data1.results || [];
        window.allStaff = allStaff;
        allStaff = allStaff;
        TeachingStaffTableBody.innerHTML = "";
        loadedCount = 0;
        function renderChunk() {
            const chunk = allStaff.slice(loadedCount, loadedCount + (loadedCount === 0 ? LOAD_INITIAL : LOAD_MORE));
            chunk.forEach((event, index) => {
                const realIndex = loadedCount + index;
                const row1 = document.createElement("tr");
                row1.innerHTML = `
    <td>${realIndex + 1}</td>
    <td>${event.FullName || '—'}</td>
    <td>${event.MIScode || '—'}</td>
    <td>${event.InstituteEmailId}</td>
    <td>${event.ContactNumber}</td>
    <td class="text-center">
        <button class="btn btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal1"
                        onclick="showEventDetails1(${event.MIScode})" title="View">
            <i class="bi bi-eye-fill" style="font-size: 1.2rem; color: #0d6efd;"></i>
        </button>
   </td>
`;
                TeachingStaffTableBody.appendChild(row1);
            });
            loadedCount += chunk.length;
            if (loadedCount < allStaff.length) {
                loadMoreBtn.style.display = '';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
        if (allStaff.length === 0) {
            TeachingStaffTableBody.innerHTML = `
                <tr><td colspan="7" class="text-center text-muted">No data found.</td></tr>`;
            loadMoreBtn.style.display = 'none';
            return;
        }
        renderChunk();
        loadMoreBtn.onclick = function() {
            renderChunk();
        };
    } catch (error) {
        console.error("Error loading events:", error);
        TeachingStaffTableBody.innerHTML = `
        <tr><td colspan="7" class="text-danger text-center">Error loading events. Please try again later.</td></tr>`;
        loadMoreBtn.style.display = 'none';
    }
}

// --- Search functionality ---
const staffSearchInput = document.getElementById('staffSearchInput');

staffSearchInput?.addEventListener('input', function () {
  const query = this.value.trim().toLowerCase();

  // Show "no results" message if list empty
  const tableBody = document.getElementById('TeachingStaffTableBody');
  if (!allStaff || allStaff.length === 0) return;

  // Filter staff
  const filteredStaff = allStaff.filter(staff =>
    (staff.FullName && staff.FullName.toLowerCase().includes(query)) ||
    (String(staff.MIScode).toLowerCase().includes(query))
  );

  // Clear old rows
  tableBody.innerHTML = '';

  if (filteredStaff.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No matching results found.</td></tr>`;
    return;
  }

  // Re-render matching rows
  filteredStaff.forEach((event, index) => {
    const row1 = document.createElement("tr");
    row1.innerHTML = `
      <td>${index + 1}</td>
      <td>${event.FullName || '—'}</td>
      <td>${event.MIScode || '—'}</td>
      <td>${event.InstituteEmailId || '—'}</td>
      <td>${event.ContactNumber || '—'}</td>
      <td class="text-center">
          <button class="btn btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal1"
                  onclick="showEventDetails1('${event.MIScode}')" title="View">
              <i class="bi bi-eye-fill" style="font-size: 1.2rem; color: #0d6efd;"></i>
          </button>
      </td>
    `;
    tableBody.appendChild(row1);
  });
});
let selectedMISCode = null; // to store which staff is being updated

function showEventDetails1(MIScode) {
  const staff = allStaff.find(ev => String(ev.MIScode) === String(MIScode));

    const detailsList = document.getElementById("staffDetailsList1");
    detailsList.innerHTML = "";
   const staffFieldLabels = {
       Active:"Active",
     MIScode: "MIS Code",
      StaffID:"Staff ID",	
     FullName: "Full Name",
     Department: "Department",
     Dept: "Dept (Short Code)",
     Roles: "Roles / Current Role",
     ContactNumber: "Contact Number",
     InstituteEmailId: "Institute Email ID",
     "Extension Code": "Extension Code",
     "Seating Room": "Seating Room",
     Designation: "Designation",
     "Status update Date for Current Designation":"Status update Date for Current Designation",	
     "Date of Joining Teaching Profession":"Date of Joining Teaching Profession",	
     DOB: "Date of Birth",
     AgeInYears: "Age (Years)",
     JoiningDate: "Date of Joining",
     ORCID: "ORCID ID",
     ScopusID: "Scopus ID",
     VidwanID: "Vidwan ID",
     WoSResearcherID: "Web of Science Researcher ID",
     TotalCitations: "Total Citations",
     "H-index": "H-index",
     "i10-index": "i10-index",
     Honorific: "Honorific (Mr./Ms./Dr./Prof.)",
     FirstName: "First Name",
     MiddleName: "Middle Name",
     LastName: "Last Name",
     Gender: "Gender",
     PanCard: "PAN Card Number",
     AdharCard: "Aadhar Card Number",
     AlternateContactNumber: "Alternate Contact Number",
     SocialCategory: "Social Category",
     ReligiousCommunity: "Religious Community",
     PlaceOfBirth: "Place of Birth",
     "City of Permanent Residence":"City of Permanent Residence",	
     "District of Permanent Residence":"District of Permanent Residence",
     AssociationType: "Association Type (Regular/Adhoc/Visiting)",
     PersonalEmailId: "Personal Email ID",
     HighestQualification: "Highest Qualification",
     HighestDegreeSpecialization: "Highest Degree Specialization",
     IndustryExperienceInMonths: "Industry Experience (Months)",
     TeachingExperienceOutsidePUInMonths: "Teaching Experience Outside PU (Months)",
     CurrentPUExperienceInMonths: "Current PU Experience (Months)",
     TotalExperienceInMonths: "Total Experience (Months)",
     TotalExperienceInYears: "Total Experience (Years)",
     TotalTeachingExperienceInMonths: "Total Teaching Experience (Months)",
     PastPUExperienceInMonths:"Past PU Experience (Months)",
     TotalPUExperienceInMonths:"Total PU Experience (Months)",
     UGDegreeFullName: "UG Degree Full Name",
     UGPassingYear: "UG Passing Year",
     PGDegreeFullName: "PG Degree Full Name",
     PGPassingYear: "PG Passing Year",
     "Ph.D. Status": "PhD Status",
     PhDAffiliatedUniversity: "PhD Affiliated University",
     YearOfReceivingPhD: "Year of Receiving PhD",
     PhDNotificationDate: "PhD Notification Date",
     "Institution/Univerisity name of Ph.D. completion": "Institution/University of PhD Completion",
     AdditionalQualification: "Additional Qualification",
     HasAnyDegreeFromIITorNIT: "Has Any Degree from IIT/NIT",
     PhDGuideshipAwardedYear: "PhD Guideship Awarded Year",
     PhDStudentsUnderGuidancePursuing: "PhD Students Under Guidance (Pursuing)",
     PhDStudentsUnderGuidanceCompleted: "PhD Students Under Guidance (Completed)",
     SpecializationArea: "Specialization Area",
     SCIJournalPapers: "SCI Journal Papers",
     ScopusJournalPaper: "Scopus Journal Papers",
     UGCJournalPaper: "UGC Journal Papers",
     ConferencePapers: "Conference Papers",
     TotalPublications: "Total Publications",
     TechnicalMemberships: "Technical Memberships",
     ParulAffiliatedPapersCount2016Onward: "Parul-Affiliated Papers (2016 Onwards)",
     ParulAffiliatedBookChapters2016Onward: "Parul-Affiliated Book Chapters (2016 Onwards)",
     ParulAffiliatedPatentsCopyrights2016Onward: "Parul-Affiliated Patents/Copyrights (2016 Onwards)",
     TotalProjectsGuidedPGPhD: "Total Projects Guided (PG/PhD)",
     IntraMuralFundedProjects: "Intra-Mural Funded Projects",
     ExtraMuralFundedProjects: "Extra-Mural Funded Projects",
     TotalExtramuralProjectFundReceived:"Total Extramural Project Fund Received",
     TravelGrantSupportReceived :"Travel Grant Support Received",	
     AppliedOrGrantedPatents	:"Applied Or Granted Patents",
     IndustryConsultancyProjects:"Industry Consultancy Projects"	,
     AvailTransport: "Avails Transport Facility",
     BusStop: "Bus Stop",
     ShiftTimings: "Shift Timings",
     RelievingDate: "Relieving Date",
     UpdatedDate: "Last Updated Date"
   };
    for (const key in staffFieldLabels) {
        const value = staff[key] && staff[key].trim() !== "" ? staff[key] : "—";
        const li = document.createElement("li");
        li.className = "list-group-item";
        li.innerHTML = `<strong>${staffFieldLabels[key]}:</strong> ${value}`;
        detailsList.appendChild(li);
    }
    detailsModal1.show();

}
document.addEventListener("DOMContentLoaded", function () {
    TeachingStaffTableBody = document.getElementById("TeachingStaffTableBody");
    renderEvents1();
});

// Column definitions with display names
const columnDefinitions = {
  "Active": "Active",
  "MIScode": "MIS Code",
  "FullName": "Full Name",
  "Department": "Department",
  "Dept": "Dept Short Name",
  "Roles": "Roles",
  "ContactNumber": "Contact Number",
  "InstituteEmailId": "Institute Email ID",
  "Sub-Department": "Sub-Department",
  "Extension Code": "Extension Code",
  "Seating Room": "Seating Room",
  "Designation": "Designation",
  "Additional Responsibility (Dean, Principal, HOI, HOD, etc.)": "Additional Responsibility",
  "DOB": "Date of Birth",
  "AgeInYears": "Age (Years)",
  "JoiningDate": "Joining Date",
  "ORCID": "ORCID",
  "GoogleScholarLink": "Google Scholar Link",
  "ScopusID": "Scopus ID",
  "VidwanID": "Vidwan ID",
  "WoSResearcherID": "Web of Science Researcher ID",
  "TotalCitations": "Total Citations",
  "H-index": "H-index",
  "i10-index": "i10-index",
  "Honorific": "Honorific",
  "FirstName": "First Name",
  "MiddleName": "Middle Name",
  "LastName": "Last Name",
  "Gender": "Gender",
  "PanCard": "PAN Card",
  "AdharCard": "Aadhar Card",
  "AlternateContactNumber": "Alternate Contact Number",
  "SocialCategory": "Social Category",
  "ReligiousCommunity": "Religious Community",
  "PlaceOfBirth": "Place of Birth",
  "AssociationType": "Association Type",
  "PersonalEmailId": "Personal Email ID",
  "HighestQualification": "Highest Qualification",
  "HighestDegreeSpecialization": "Highest Degree Specialization",
  "IndustryExperienceInMonths": "Industry Experience (Months)",
  "TeachingExperienceOutsidePUInMonths": "Teaching Experience Outside PU (Months)",
  "PastPUExperienceInMonths": "Past PU Experience (Months)",
  "CurrentPUExperienceInMonths": "Current PU Experience (Months)",
  "TotalPUExperienceInMonths": "Total PU Experience (Months)",
  "TotalExperienceInMonths": "Total Experience (Months)",
  "TotalExperienceInYears": "Total Experience (Years)",
  "TotalTeachingExperienceInMonths": "Total Teaching Experience (Months)",
  "UGDegreeFullName": "UG Degree Full Name",
  "UGPassingYear": "UG Passing Year",
  "PGDegreeFullName": "PG Degree Full Name",
  "PGPassingYear": "PG Passing Year",
  "Ph.D. Status": "Ph.D. Status",
  "PhDAffiliatedUniversity": "PhD Affiliated University",
  "YearOfReceivingPhD": "Year of Receiving PhD",
  "PhDNotificationDate": "PhD Notification Date",
  "Institution/Univerisity name of Ph.D. completion": "Institution/University of Ph.D. Completion",
  "AdditionalQualification": "Additional Qualification",
  "HasAnyDegreeFromIITorNIT": "Has Any Degree from IIT/NIT",
  "PhDGuideshipAwardedYear": "PhD Guideship Awarded Year",
  "PhDStudentsUnderGuidancePursuing": "PhD Students Under Guidance (Pursuing)",
  "PhDStudentsUnderGuidanceCompleted": "PhD Students Under Guidance (Completed)",
  "SpecializationArea": "Specialization Area",
  "SCIJournalPapers": "SCI Journal Papers",
  "ScopusJournalPaper": "Scopus Journal Paper",
  "UGCJournalPaper": "UGC Journal Paper",
  "ConferencePapers": "Conference Papers",
  "TotalPublications": "Total Publications",
  "TechnicalMemberships": "Technical Memberships",
  "ParulAffiliatedPapersCount2016Onward": "Parul Affiliated Papers (2016 Onward)",
  "ParulAffiliatedBookChapters2016Onward": "Parul Affiliated Book Chapters (2016 Onward)",
  "ParulAffiliatedPatentsCopyrights2016Onward": "Parul Affiliated Patents/Copyrights (2016 Onward)",
  "TotalProjectsGuidedPGPhD": "Total Projects Guided (PG/PhD)",
  "IntraMuralFundedProjects": "Intra-Mural Funded Projects",
  "ExtraMuralFundedProjects": "Extra-Mural Funded Projects",
  "TotalExtramuralProjectFundReceived": "Total Extramural Project Fund Received",
  "TravelGrantSupportReceived": "Travel Grant Support Received",
  "AppliedOrGrantedPatents": "Applied Or Granted Patents",
  "IndustryConsultancyProjects": "Industry Consultancy Projects",
  "StaffID": "Staff ID",
  "Status update Date for Current Designation": "Status Update Date for Current Designation",
  "Date of Joining Teaching Profession": "Date of Joining Teaching Profession",
  "City of Permanent Residence": "City of Permanent Residence",
  "District of Permanent Residence": "District of Permanent Residence",
  "AvailTransport": "Avail Transport",
  "BusStop": "Bus Stop",
  "ShiftTimings": "Shift Timings",
  "RelievingDate": "Relieving Date",
  "UpdatedDate": "Updated Date"
};

let downloadFilterModal = null;

// Initialize download filter modal
function initializeDownloadModal() {
  downloadFilterModal = new bootstrap.Modal(document.getElementById('downloadFilterModal'));
  populateColumnCheckboxes();
  populateFilterDropdowns();
}

// Extract unique values from data for filter dropdowns
function getUniqueValues(fieldName) {
  if (!window.allStaff || window.allStaff.length === 0) return [];
  
  const values = new Set();
  window.allStaff.forEach(staff => {
    const value = staff[fieldName];
    if (value !== null && value !== undefined && value !== '') {
      // Handle comma-separated values (like Roles)
      if (typeof value === 'string' && value.includes(',')) {
        value.split(',').forEach(v => {
          const trimmed = v.trim();
          if (trimmed) values.add(trimmed);
        });
      } else {
        values.add(String(value).trim());
      }
    }
  });
  
  return Array.from(values).sort();
}

// Populate all filter dropdowns with unique values from data
function populateFilterDropdowns() {
  if (!window.allStaff || window.allStaff.length === 0) return;

  // Department
  const deptSelect = document.getElementById('filterDepartment');
  if (deptSelect) {
    // Clear existing options except "All"
    while (deptSelect.options.length > 1) {
      deptSelect.remove(1);
    }
    const deptValues = getUniqueValues('Department');
    deptValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      deptSelect.appendChild(option);
    });
  }

  // Active
  const activeSelect = document.getElementById('filterActive');
  if (activeSelect) {
    while (activeSelect.options.length > 1) {
      activeSelect.remove(1);
    }
    const activeValues = getUniqueValues('Active');
    activeValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      activeSelect.appendChild(option);
    });
  }

  // Additional Responsibility
  const addRespSelect = document.getElementById('filterAdditionalResponsibility');
  if (addRespSelect) {
    while (addRespSelect.options.length > 1) {
      addRespSelect.remove(1);
    }
    const addRespValues = getUniqueValues('Additional Responsibility');
    addRespValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      addRespSelect.appendChild(option);
    });
  }

  // Gender
  const genderSelect = document.getElementById('filterGender');
  if (genderSelect) {
    while (genderSelect.options.length > 1) {
      genderSelect.remove(1);
    }
    const genderValues = getUniqueValues('Gender');
    genderValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      genderSelect.appendChild(option);
    });
  }

  // Highest Qualification
  const qualSelect = document.getElementById('filterHighestQualification');
  if (qualSelect) {
    while (qualSelect.options.length > 1) {
      qualSelect.remove(1);
    }
    const qualValues = getUniqueValues('HighestQualification');
    qualValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      qualSelect.appendChild(option);
    });
  }

  // PhD Status
  const phdSelect = document.getElementById('filterPhDStatus');
  if (phdSelect) {
    while (phdSelect.options.length > 1) {
      phdSelect.remove(1);
    }
    const phdValues = getUniqueValues('Ph.D. Status');
    phdValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      phdSelect.appendChild(option);
    });
  }

  // Avail Transport
  const transportSelect = document.getElementById('filterAvailTransport');
  if (transportSelect) {
    while (transportSelect.options.length > 1) {
      transportSelect.remove(1);
    }
    const transportValues = getUniqueValues('AvailTransport');
    transportValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      transportSelect.appendChild(option);
    });
  }
}

// Clear all filters
function clearAllFilters() {
  document.getElementById('filterDepartment').value = '';
  document.getElementById('filterActive').value = '';
  document.getElementById('filterAdditionalResponsibility').value = '';
  document.getElementById('filterGender').value = '';
  document.getElementById('filterHighestQualification').value = '';
  document.getElementById('filterPhDStatus').value = '';
  document.getElementById('filterJoiningDateFrom').value = '';
  document.getElementById('filterJoiningDateTo').value = '';
}

// Apply filters to staff data
function applyFilters(data) {
  if (!data || data.length === 0) return [];

  let filtered = [...data];

  // Filter by Department
  const deptFilter = document.getElementById('filterDepartment').value;
  if (deptFilter) {
    filtered = filtered.filter(staff => String(staff.Department || '').trim() === deptFilter);
  }

  // Filter by Active
  const activeFilter = document.getElementById('filterActive').value;
  if (activeFilter) {
    filtered = filtered.filter(staff => String(staff.Active || '').trim() === activeFilter);
  }

  // Filter by Additional Responsibility
  const addRespFilter = document.getElementById('filterAdditionalResponsibility').value;
  if (addRespFilter) {
    filtered = filtered.filter(staff => 
      String(staff['Additional Responsibility (Dean, Principal, HOI, HOD, etc.)'] || '').trim() === addRespFilter
    );
  }

  // Filter by Gender
  const genderFilter = document.getElementById('filterGender').value;
  if (genderFilter) {
    filtered = filtered.filter(staff => String(staff.Gender || '').trim() === genderFilter);
  }

  // Filter by Highest Qualification
  const qualFilter = document.getElementById('filterHighestQualification').value;
  if (qualFilter) {
    filtered = filtered.filter(staff => String(staff.HighestQualification || '').trim() === qualFilter);
  }

  // Filter by PhD Status
  const phdFilter = document.getElementById('filterPhDStatus').value;
  if (phdFilter) {
    filtered = filtered.filter(staff => String(staff['Ph.D. Status'] || '').trim() === phdFilter);
  }


  // Filter by Joining Date Range
  const dateFrom = document.getElementById('filterJoiningDateFrom').value;
  const dateTo = document.getElementById('filterJoiningDateTo').value;
  
  if (dateFrom || dateTo) {
    filtered = filtered.filter(staff => {
      const joiningDate = staff.JoiningDate;
      if (!joiningDate) return false;
      
      // Parse the date (handle different formats)
      let dateValue;
      if (joiningDate.includes('T')) {
        dateValue = new Date(joiningDate.split('T')[0]);
      } else {
        dateValue = new Date(joiningDate);
      }
      
      if (isNaN(dateValue.getTime())) return false;
      
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (dateValue < fromDate) return false;
      }
      
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // Include the entire end date
        if (dateValue > toDate) return false;
      }
      
      return true;
    });
  }

  return filtered;
}

// Populate checkboxes for all columns
function populateColumnCheckboxes() {
  const container = document.getElementById('columnCheckboxesContainer');
  if (!container) return;

  container.innerHTML = '';
  
  // Get available columns from the first staff record if available
  let availableColumns = Object.keys(columnDefinitions);
  if (window.allStaff && window.allStaff.length > 0) {
    // Use actual columns from data, merge with definitions
    const dataColumns = Object.keys(window.allStaff[0]);
    // Combine: use data columns, but prefer order from definitions
    const definedCols = dataColumns.filter(col => columnDefinitions.hasOwnProperty(col));
    const undefinedCols = dataColumns.filter(col => !columnDefinitions.hasOwnProperty(col));
    availableColumns = [...definedCols, ...undefinedCols];
  }

  availableColumns.forEach((columnKey, index) => {
    const displayName = columnDefinitions[columnKey] || columnKey;
    const colDiv = document.createElement('div');
    colDiv.className = 'col-md-6 col-lg-4';
    
    const formCheckDiv = document.createElement('div');
    formCheckDiv.className = 'form-check';
    
    const checkbox = document.createElement('input');
    checkbox.className = 'form-check-input column-checkbox';
    checkbox.type = 'checkbox';
    checkbox.value = columnKey;
    checkbox.id = `col_${index}`;
    checkbox.checked = true;
    
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = `col_${index}`;
    label.style.cursor = 'pointer';
    label.textContent = displayName;
    
    formCheckDiv.appendChild(checkbox);
    formCheckDiv.appendChild(label);
    colDiv.appendChild(formCheckDiv);
    container.appendChild(colDiv);
  });

  // Add event listeners to update count
  const checkboxes = container.querySelectorAll('.column-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', updateSelectedCount);
  });

  updateSelectedCount();
}

// Update selected count display
function updateSelectedCount() {
  const checkboxes = document.querySelectorAll('.column-checkbox');
  const checked = document.querySelectorAll('.column-checkbox:checked');
  const countEl = document.getElementById('selectedCount');
  if (countEl) {
    countEl.textContent = `${checked.length} of ${checkboxes.length} columns selected`;
  }
}

// Select all columns
function selectAllColumns() {
  const checkboxes = document.querySelectorAll('.column-checkbox');
  checkboxes.forEach(cb => cb.checked = true);
  updateSelectedCount();
}

// Deselect all columns
function deselectAllColumns() {
  const checkboxes = document.querySelectorAll('.column-checkbox');
  checkboxes.forEach(cb => cb.checked = false);
  updateSelectedCount();
}

// Download Excel with selected columns
async function downloadSelectedColumns() {
  const selectedCheckboxes = document.querySelectorAll('.column-checkbox:checked');
  
  if (selectedCheckboxes.length === 0) {
    alert('Please select at least one column to download.');
    return;
  }

  const selectedColumns = Array.from(selectedCheckboxes).map(cb => cb.value);
  
  showLoader();
  let retries = 0;
  while ((!window.allStaff || window.allStaff.length === 0) && retries < 20) {
    await new Promise(resolve => setTimeout(resolve, 800));
    retries++;
  }

  if (!window.allStaff || window.allStaff.length === 0) {
    hideLoader();
    alert("Failed to fetch staff data. Please try again.");
    return;
  }

  try {
    // Apply filters to the data
    const filteredStaff = applyFilters(window.allStaff);
    
    if (filteredStaff.length === 0) {
      hideLoader();
      alert('No data matches the selected filters. Please adjust your filters and try again.');
    return;
  }

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Staff");
    
    // Use display names for headers
    const headers = selectedColumns.map(col => columnDefinitions[col] || col);
  worksheet.addRow(headers);
    
  // Bold header row
  worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows with only selected columns from filtered data
    filteredStaff.forEach(staff => {
      const rowValues = selectedColumns.map(col => staff[col] || '');
    worksheet.addRow(rowValues);
  });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

  // Generate Excel file
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), "StaffData.xlsx");

    // Close modal
    if (downloadFilterModal) {
      downloadFilterModal.hide();
    }
  } catch (error) {
    console.error('Error generating Excel:', error);
    alert('Error generating Excel file. Please try again.');
  }

  hideLoader();
}

// Open download modal instead of direct download
function openDownloadModal() {
  if (!window.allStaff || window.allStaff.length === 0) {
    alert("Please wait for data to load before downloading.");
    return;
  }
  
  // Refresh checkboxes and filters in case data structure changed
  populateColumnCheckboxes();
  populateFilterDropdowns();
  
  if (downloadFilterModal) {
    downloadFilterModal.show();
  }
}

// download.js (old function kept for backward compatibility, but not used)
async function downloadSheet() {
  openDownloadModal();
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("downloadBtn");
  if (btn) {
    btn.addEventListener("click", openDownloadModal);
  }
  initializeDownloadModal();
});
function createLoader() {
    if (!document.getElementById("loader")) {
        const loaderDiv = document.createElement("div");
        loaderDiv.id = "loader";
        loaderDiv.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            font-size: 20px;
            font-weight: bold;
            color: #333;
        `;
        loaderDiv.innerHTML = `
            Fetching data... Please wait.
            <div id="spinner" style="
                border: 8px solid #1e3c72;
                border-top: 8px solid #3498db;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 2s linear infinite;
                margin-top: 10px;
            "></div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(loaderDiv);
    }
}
function showLoader() {
    createLoader();
    document.getElementById("loader").style.display = "flex";
}

function hideLoader() {
    const loader = document.getElementById("loader");
    if (loader) {
        loader.style.display = "none";
    }
}
function createLoader() {
    if (!document.getElementById("loader")) {
        const loaderDiv = document.createElement("div");
        loaderDiv.id = "loader";
        loaderDiv.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            font-size: 20px;
            font-weight: bold;
            color: #333;
            z-index: 9999;
        `;
        loaderDiv.innerHTML = `
            Please wait.
            <div id="spinner" style="
                border: 8px solid #1e3c72;
                border-top: 8px solid #3498db;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 2s linear infinite;
                margin-top: 10px;
            "></div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(loaderDiv);
    }
}

function showLoader() {
    createLoader();
    document.getElementById("loader").style.display = "flex";
}

function hideLoader() {
    const loader = document.getElementById("loader");
    if (loader) {
        loader.style.display = "none";
    }
}