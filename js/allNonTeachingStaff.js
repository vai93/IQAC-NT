const apiBase = (location.port === "5501" || location.port === "5500" || location.hostname === "127.0.0.1")
  ? "http://localhost:3000/api"
  : "/api";

const tableBody = document.getElementById("staffTableBody");
const searchInput = document.getElementById("staffSearchInput");

// Download modal filter controls
const dlFilterDepartment = document.getElementById("dlFilterDepartment");
const dlFilterGroup = document.getElementById("dlFilterGroup");
const dlFilterActive = document.getElementById("dlFilterActive");
const dlFilterGender = document.getElementById("dlFilterGender");
const dlFilterAssociation = document.getElementById("dlFilterAssociation");
const dlFilterHighestQualCat = document.getElementById("dlFilterHighestQualCat");
const dlFilterJoiningFrom = document.getElementById("dlFilterJoiningFrom");
const dlFilterJoiningTo = document.getElementById("dlFilterJoiningTo");

const viewModal = new bootstrap.Modal(document.getElementById("viewStaffModal"));
const editModal = new bootstrap.Modal(document.getElementById("editStaffModal"));
const downloadFilterModal = new bootstrap.Modal(document.getElementById("downloadFilterModal"));

let allStaff = [];
let currentEditMiscode = null;
let isCreateMode = false;

const dateKeys = ["DOB", "JoiningDate", "RelievingDate", "UpdatedDate"];

// Predefined dropdown choices
const dropdownOptions = {
  Department: [
    "Agricultural Engineering",
    "Applied Science and Humanities",
    "Automobile Engineering",
    "Biomedical Engineering",
    "Biotechnology",
    "Career Development Cell",
    "Chemical Engineering",
    "Civil Engineering",
    "Computer Science and Engineering",
    "Dairy Technology/Food Technology",
    "Electrical Engineering",
    "Library",
    "Mechatronic Engineering / Robotics and Automation",
    "Petroleum Engineering",
    "Principal Office",
    "Reception",
    "Zerox Operator",
    "Student Section"
  ],
  Designation: [
    "Admin Executive",
    "Clerk",
    "Lab Assistant",
    "Lab Attendant",
    "Lab Technician",
    "Librarian",
    "Office Assistant",
    "Peon",
    "Reading Room Supervior",
    "Reception",
    "Zerox Operator"
  ],
  "Group (Staff Category)": ["NA", "A", "B", "C", "D"],
  Gender: ["Male", "Female"],
  AssociationType: [], // populated from data fallback
  PGStatus: ["Pursuing", "Completed", "NA"],
  AvailTransport: ["Yes", "No"],
  HighestQualificationCategory: [
    "Below SSC",
    "SSC / Equivalent",
    "Diploma",
    "Undergraduate (UG)",
    "Postgraduate (PG)",
    "Doctoral (PhD)"
  ],
  Active: ["Yes", "No"]
};

const statesOfIndia = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"
];

function uniqueValuesFromData(key) {
  const set = new Set();
  allStaff.forEach(item => {
    const raw = item[key];
    if (!raw) return;
    if (typeof raw === "string" && raw.includes(",")) {
      raw.split(",").forEach(v => v && set.add(v.trim()));
    } else {
      set.add(String(raw).trim());
    }
  });
  return Array.from(set).sort();
}

function getOptionsForField(key) {
  const preset = dropdownOptions[key];
  if (preset && preset.length) return preset;
  return uniqueValuesFromData(key);
}

function formatDateDDMMYYYY(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes("-") && value.split("-")[0].length === 2 && value.split("-")[1].length === 2) {
    return value; // already dd-mm-yyyy
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const yyyy = parsed.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function normalizeDateInput(value) {
  if (!value) return "";
  // accept dd/mm/yyyy or yyyy-mm-dd etc.
  const cleaned = value.replace(/\//g, "-");
  const parts = cleaned.split("-");
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // yyyy-mm-dd
      return formatDateDDMMYYYY(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    if (parts[0].length === 2 && parts[1].length === 2) {
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
  }
  return formatDateDDMMYYYY(cleaned);
}

function toDateInputValue(value) {
  if (!value) return "";
  const cleaned = normalizeDateInput(value);
  const parts = cleaned.split("-");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (dd.length === 2 && mm.length === 2 && yyyy.length === 4) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return "";
}

const columnDefinitions = {
  "Active": "Active",
  "MIScode": "MIS Code",
  "FullName": "Full Name",
  "Department": "Department",
  "ContactNumber": "Contact Number",
  "InstituteEmailId": "Institute Email ID",
  "Seating Room": "Seating Room",
  "Designation": "Designation",
  "Group (Staff Category)": "Staff Category",
  "DOB": "Date of Birth",
  "AgeInYears": "Age (Years)",
  "JoiningDate": "Joining Date",
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
  "HighestQualification": "Highest Qualification",
  "HighestQualificationCategory": "Highest Qualification Category",
  "PUExperienceInMonths": "PU Experience (Months)",
  "PGStatus": "PG Status",
  "StaffID": "Staff ID",
  "City of Permanent Residence": "City of Permanent Residence",
  "District of Permanent Residence": "District of Permanent Residence",
  "AvailTransport": "Avail Transport",
  "BusStop": "Bus Stop",
  "ShiftTimings": "Shift Timings",
  "RelievingDate": "Relieving Date",
  "UpdatedDate": "Updated Date"
};

document.addEventListener("DOMContentLoaded", () => {
  bindUIEvents();
  initializeDownloadModal();
  fetchStaffData();
});

function bindUIEvents() {
  searchInput?.addEventListener("input", renderStaffTable);
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) downloadBtn.addEventListener("click", openDownloadModal);
}

async function fetchStaffData() {
  showLoader("Fetching staff...");
  try {
    const response = await fetch(`${apiBase}/NonTeaching`, {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("authTokenNT") || ""}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Unable to fetch staff");
    }

    const data = await response.json();
    // keep only records with MIScode present
    allStaff = (data.results || []).filter(item => item.MIScode);
    populateDownloadFilters();
    populateColumnCheckboxes();
    renderStaffTable();
  } catch (error) {
    console.error(error);
    tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Error loading data. ${error.message}</td></tr>`;
  } finally {
    hideLoader();
  }
}

function refreshStaffData() {
  fetchStaffData();
}

function populateDownloadFilters() {
  const optionsBuilder = (selectEl, values) => {
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = '<option value="">All</option>';
    values.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
    if (selectEl === dlFilterActive) {
      selectEl.value = "Yes";
      if (!selectEl.value && selectEl.options.length > 1) selectEl.selectedIndex = 1;
    } else {
      selectEl.value = current;
    }
  };

  const uniqueValues = (key, splitComma = false) => {
    const set = new Set();
    allStaff.forEach(item => {
      const raw = item[key];
      if (!raw) return;
      if (splitComma && typeof raw === "string" && raw.includes(",")) {
        raw.split(",").forEach(v => v && set.add(v.trim()));
      } else {
        set.add(String(raw).trim());
      }
    });
    return Array.from(set).sort();
  };

  optionsBuilder(dlFilterDepartment, uniqueValues("Department"));
  optionsBuilder(dlFilterGroup, uniqueValues("Group (Staff Category)"));
  optionsBuilder(dlFilterActive, uniqueValues("Active"));
  optionsBuilder(dlFilterGender, uniqueValues("Gender"));
  optionsBuilder(dlFilterAssociation, uniqueValues("AssociationType"));
  optionsBuilder(dlFilterHighestQualCat, uniqueValues("HighestQualificationCategory"));
}

function clearDownloadFilters() {
  [dlFilterDepartment, dlFilterGroup, dlFilterActive, dlFilterGender, dlFilterAssociation]
    .forEach(el => { if (el) el.value = ""; });
  if (dlFilterHighestQualCat) dlFilterHighestQualCat.value = "";
  if (dlFilterActive) dlFilterActive.value = "Yes";
  if (dlFilterJoiningFrom) dlFilterJoiningFrom.value = "";
  if (dlFilterJoiningTo) dlFilterJoiningTo.value = "";
}

function getFilteredStaff() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  return allStaff.filter(staff => {
    const matchesQuery = !query || [
      staff.FullName,
      staff.MIScode,
      staff.InstituteEmailId,
      staff.ContactNumber,
      staff.Department
    ].some(field => String(field || "").toLowerCase().includes(query));
    const isActive = String(staff.Active || "").trim().toLowerCase() === "yes";
    return matchesQuery && isActive;
  });
}

function getDownloadFilteredStaff() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  const dept = dlFilterDepartment?.value || "";
  const group = dlFilterGroup?.value || "";
  const active = dlFilterActive?.value || "Yes";
  const gender = dlFilterGender?.value || "";
  const association = dlFilterAssociation?.value || "";
  const highQualCat = dlFilterHighestQualCat?.value || "";
  const joinFrom = dlFilterJoiningFrom?.value;
  const joinTo = dlFilterJoiningTo?.value;

  return allStaff.filter(staff => {
    const matchesQuery = !query || [
      staff.FullName,
      staff.MIScode,
      staff.InstituteEmailId,
      staff.ContactNumber,
      staff.Department
    ].some(field => String(field || "").toLowerCase().includes(query));

    if (!matchesQuery) return false;
    if (dept && String(staff.Department || "") !== dept) return false;
    if (group && String(staff["Group (Staff Category)"] || "") !== group) return false;
    if (active && String(staff.Active || "").toLowerCase() !== active.toLowerCase()) return false;
    if (gender && String(staff.Gender || "") !== gender) return false;
    if (association && String(staff.AssociationType || "") !== association) return false;
    if (highQualCat && String(staff.HighestQualificationCategory || "") !== highQualCat) return false;

    const joiningDate = staff.JoiningDate ? new Date(staff.JoiningDate) : null;
    if (joinFrom) {
      const from = new Date(joinFrom);
      if (!joiningDate || joiningDate < from) return false;
    }
    if (joinTo) {
      const to = new Date(joinTo);
      to.setHours(23, 59, 59, 999);
      if (!joiningDate || joiningDate > to) return false;
    }
    return true;
  });
}

function renderStaffTable() {
  const filtered = getFilteredStaff();
  tableBody.innerHTML = "";

  if (!filtered.length) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No staff found.</td></tr>`;
    return;
  }

  filtered.forEach((staff, idx) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${idx + 1}</td>
      <td class="text-start">${staff.FullName || "—"}</td>
      <td>${staff.MIScode || "—"}</td>
      <td class="text-start">${staff.Department || "—"}</td>
      <td class="text-start">${staff["Group (Staff Category)"] || "—"}</td>
      <td class="text-start">${staff.ContactNumber || "—"}</td>
      <td>
        <button class="btn btn-sm btn-outline-info me-1" onclick="openViewModal('${staff.MIScode}')">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${staff.MIScode}')">
          <i class="bi bi-pencil-square"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function openViewModal(miscode) {
  const staff = allStaff.find(item => String(item.MIScode) === String(miscode));
  if (!staff) return;
  const container = document.getElementById("viewDetailsContainer");
  container.innerHTML = "";

  Object.entries(columnDefinitions).forEach(([key, label]) => {
    const raw = staff[key] ?? "—";
    const value = dateKeys.includes(key) ? formatDateDDMMYYYY(raw) || "—" : raw;
    const row = document.createElement("div");
    row.className = "col-12";
    row.innerHTML = `
      <div class="border rounded p-2 bg-light">
        <span class="fw-semibold" style="color:#4a2a53;">${label}:</span>
        <span class="ms-2">${value || "—"}</span>
      </div>
    `;
    container.appendChild(row);
  });
  viewModal.show();
}

function openEditModal(miscode) {
  const staff = allStaff.find(item => String(item.MIScode) === String(miscode));
  if (!staff) return;
  currentEditMiscode = miscode;
  isCreateMode = false;
  renderEditForm(staff);
  editModal.show();
}

function openAddStaffModal() {
  currentEditMiscode = null;
  isCreateMode = true;
  const blank = { Active: "Yes" };
  renderEditForm(blank);
  editModal.show();
}

function renderEditForm(staff) {
  const container = document.getElementById("editFieldsContainer");
  container.innerHTML = "";

  Object.entries(columnDefinitions).forEach(([key, label]) => {
    if (key === "UpdatedDate" || key === "AgeInYears" || key === "PUExperienceInMonths") return; // auto/hidden fields
    if (isCreateMode && key === "Active") return; // hide Active on create (defaults to Yes)

    const col = document.createElement("div");
    col.className = "col-12";

    const group = document.createElement("div");
    group.className = "form-group";

    const lbl = document.createElement("label");
    lbl.className = "form-label small fw-semibold";
    lbl.htmlFor = `edit_${key}`;
    lbl.textContent = label;

    let options = null;
    const isDate = dateKeys.includes(key);
    const isReadOnlyField = (!isCreateMode && key === "MIScode") || key === "Active";

    if (key === "AssociationType") {
      options = ["Regular", "Temporary"];
    } else if (key === "PlaceOfBirth") {
      options = statesOfIndia;
    } else if (key === "Active") {
      options = getOptionsForField(key);
    } else if (
      key === "Designation" ||
      key === "Department" ||
      key === "Group (Staff Category)" ||
      key === "Gender" ||
      key === "PGStatus" ||
      key === "AvailTransport" ||
      key === "HighestQualificationCategory"
    ) {
      options = getOptionsForField(key);
    } else {
      options = null; // force input
    }

    const isRelieving = key === "RelievingDate";

    if (options && options.length && key !== "MIScode") {
      const select = document.createElement("select");
      select.className = "form-select";
      select.id = `edit_${key}`;
      select.name = key;
      select.required = !isRelieving;
      select.disabled = key === "Active"; // Active not editable
      const placeholderOpt = document.createElement("option");
      placeholderOpt.value = "";
      placeholderOpt.textContent = "Select";
      select.appendChild(placeholderOpt);
      options.forEach(optVal => {
        const opt = document.createElement("option");
        opt.value = optVal;
        opt.textContent = optVal;
        select.appendChild(opt);
      });
      select.value = staff[key] || (key === "Active" ? "Yes" : "");
      group.appendChild(lbl);
      group.appendChild(select);
    } else {
      const input = document.createElement("input");
      input.className = "form-control";
      input.id = `edit_${key}`;
      input.name = key;
      input.required = !isRelieving;
      input.readOnly = isReadOnlyField;
      input.type = key === "ContactNumber" || key === "AlternateContactNumber" ? "number" : "text";
      if (isDate) {
        input.type = "date";
        input.value = toDateInputValue(staff[key]);
      } else {
        input.value = staff[key] || (key === "Active" ? "Yes" : "");
      }
      group.appendChild(lbl);
      group.appendChild(input);

      if (key === "StaffID") {
        const note = document.createElement("small");
        note.className = "text-muted";
        note.textContent = "(Number that starts with letter)";
        group.appendChild(note);
      }
    }

    col.appendChild(group);
    container.appendChild(col);
  });
}

async function saveStaffEdits() {
  const form = document.getElementById("editStaffForm");
  if (!form) return;

  const payload = {};
  Object.keys(columnDefinitions).forEach(key => {
    if (key === "UpdatedDate") return;
    const field = form.querySelector(`[name="${key}"]`);
    if (!field) return;
    let value = field.value.trim();
    if (dateKeys.includes(key)) {
      value = normalizeDateInput(value);
    }
    payload[key] = value;
  });

  // auto set UpdatedDate to today
  payload.UpdatedDate = formatDateDDMMYYYY(new Date());

  // required check
  const requiredKeys = Object.keys(columnDefinitions).filter(k => !["UpdatedDate", "AgeInYears", "PUExperienceInMonths", "RelievingDate"].includes(k));
  for (const key of requiredKeys) {
    if (isCreateMode && key === "Active") continue; // Active defaulted on create
    if (!payload[key]) {
      alert(`${columnDefinitions[key]} is required.`);
      return;
    }
  }

  if (!payload.Active) payload.Active = "Yes"; // default Active when not present (create)

  // simple email validation for InstituteEmailId if present
  if (payload.InstituteEmailId) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.InstituteEmailId)) {
      alert("Please enter a valid Institute Email ID.");
      return;
    }
  }

  // phone validation for contact numbers (10 digits)
  const phoneRegex = /^\d{10}$/;
  if (payload.ContactNumber && !phoneRegex.test(payload.ContactNumber)) {
    alert("Contact Number must be 10 digits.");
    return;
  }
  if (payload.AlternateContactNumber && !phoneRegex.test(payload.AlternateContactNumber)) {
    alert("Alternate Contact Number must be 10 digits.");
    return;
  }

  if (!payload.MIScode) {
    alert("MIS Code is required.");
    return;
  }

  showLoader("Saving changes...");
  try {
    const method = isCreateMode ? "POST" : "PUT";
    const response = await fetch(`${apiBase}/NonTeaching`, {
      method,
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("authTokenNT") || ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Failed to update staff");
    }

    const updated = data.updated || payload;
    if (isCreateMode) {
      allStaff.unshift(updated);
    } else {
      const idx = allStaff.findIndex(item => String(item.MIScode) === String(payload.MIScode));
      if (idx !== -1) {
        allStaff[idx] = { ...allStaff[idx], ...updated };
      }
    }
    editModal.hide();
    renderStaffTable();
    alert(isCreateMode ? "Staff added successfully." : "Staff updated successfully.");
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    hideLoader();
    isCreateMode = false;
  }
}

function initializeDownloadModal() {
  populateColumnCheckboxes();
  updateSelectedCount();
}

function populateColumnCheckboxes() {
  const container = document.getElementById("columnCheckboxesContainer");
  if (!container) return;
  container.innerHTML = "";

  Object.keys(columnDefinitions).forEach((key, index) => {
    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4";

    const wrapper = document.createElement("div");
    wrapper.className = "form-check";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "form-check-input column-checkbox";
    checkbox.id = `col_${index}`;
    checkbox.value = key;
    checkbox.checked = true;
    checkbox.addEventListener("change", updateSelectedCount);
    
    const label = document.createElement("label");
    label.className = "form-check-label";
    label.htmlFor = `col_${index}`;
    label.textContent = columnDefinitions[key];

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    col.appendChild(wrapper);
    container.appendChild(col);
  });
}

function updateSelectedCount() {
  const checkboxes = document.querySelectorAll(".column-checkbox");
  const checked = document.querySelectorAll(".column-checkbox:checked");
  const countEl = document.getElementById("selectedCount");
  if (countEl) countEl.textContent = `${checked.length} of ${checkboxes.length} columns selected`;
}

function selectAllColumns() {
  document.querySelectorAll(".column-checkbox").forEach(cb => { cb.checked = true; });
  updateSelectedCount();
}

function deselectAllColumns() {
  document.querySelectorAll(".column-checkbox").forEach(cb => { cb.checked = false; });
  updateSelectedCount();
}

function openDownloadModal() {
  if (!allStaff.length) {
    alert("Please wait for data to load first.");
    return;
  }
  populateColumnCheckboxes();
  populateDownloadFilters();
  updateSelectedCount();
  downloadFilterModal.show();
}

async function downloadSelectedColumns() {
  const selected = Array.from(document.querySelectorAll(".column-checkbox:checked")).map(cb => cb.value);
  if (!selected.length) {
    alert("Please select at least one column.");
    return;
  }

  const data = getDownloadFilteredStaff();
  if (!data.length) {
    alert("No data available for the current filters.");
    return;
  }

  showLoader("Preparing download...");
  try {
  const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("NonTeachingStaff");

    sheet.addRow(selected.map(col => columnDefinitions[col] || col));
    sheet.getRow(1).font = { bold: true };

    data.forEach(item => {
      sheet.addRow(selected.map(col => item[col] || ""));
    });

    sheet.columns.forEach(col => {
      let max = 10;
      col.eachCell({ includeEmpty: true }, cell => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > max) max = len;
      });
      col.width = Math.min(Math.max(max + 2, 10), 80);
    });

  const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "NonTeachingStaff.xlsx");
      downloadFilterModal.hide();
  } catch (error) {
    console.error(error);
    alert("Failed to generate file. Please try again.");
  } finally {
  hideLoader();
  }
}

function createLoader() {
  if (document.getElementById("loader")) return;
  const loader = document.createElement("div");
  loader.id = "loader";
  loader.style.cssText = `
            display: none;
            position: fixed;
    inset: 0;
    background: rgba(255,255,255,0.8);
    z-index: 1055;
    align-items: center;
            justify-content: center;
            flex-direction: column;
    font-size: 18px;
    font-weight: 600;
            color: #333;
        `;
  loader.innerHTML = `
    <div id="loaderText">Please wait...</div>
    <div class="mt-2 spinner-border text-primary" role="status"></div>
  `;
  loader.style.display = "flex";
  document.body.appendChild(loader);
}

function showLoader(text = "Please wait...") {
  createLoader();
    const loader = document.getElementById("loader");
  const textEl = document.getElementById("loaderText");
  if (textEl) textEl.textContent = text;
  loader.style.display = "flex";
}

function hideLoader() {
    const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
}