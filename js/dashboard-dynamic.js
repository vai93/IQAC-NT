// dashboard-dynamic.js (Non-Teaching)
// Builds the NT dashboard cards, tables, and modals using NonTeaching API data.

const apiBaseStaff = (location.port === '5500' || location.port === '5501' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api/NonTeaching'
  : '/api/NonTeaching';

const authToken = localStorage.getItem('authTokenNT');

const activeStaffElem = document.getElementById('activeStaff');
const departmentCountElem = document.getElementById('staffDepartments');
const designationCountElem = document.getElementById('staffDesignations');

let staffProfiles = [];
let departmentCounts = {};
let designationCounts = {};
let groupCounts = {};
let groupDeptCounts = {};
let qualCatCounts = {};
let qualCatDeptCounts = {};
let qualificationDeptCounts = {};
let experienceDeptStats = {};
let experienceBucketTotals = {};
let experienceTotalOverall = 0;
let experienceCustomDeptStats = null;
let experienceCustomTotal = 0;
let experienceCustomLabel = '';
let experienceFilterInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();

  const deptModal = document.getElementById('departmentFacultyModal');
  deptModal?.addEventListener('show.bs.modal', populateDepartmentModal);

  const desigListModal = document.getElementById('designationListModal');
  desigListModal?.addEventListener('show.bs.modal', populateDesignationListModal);
});

function setCardPlaceholders(val = '...') {
  if (activeStaffElem) activeStaffElem.textContent = val;
  if (departmentCountElem) departmentCountElem.textContent = val;
  if (designationCountElem) designationCountElem.textContent = val;
}

async function initDashboard() {
  if (!authToken) {
    setCardPlaceholders('-');
    return;
  }

  try {
    await fetchStaffData();
    updateSummaryCards();
    renderGroupStats();
    renderQualificationStats();
    renderQualCategoryStats();
    renderExperienceStats();
    setupExperienceFilter();
  } catch (err) {
    console.error('Error initializing dashboard:', err);
    setCardPlaceholders('-');
  }
}

async function fetchStaffData() {
  const response = await fetch(apiBaseStaff, {
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Unable to fetch staff data');
  }

  const data = await response.json();
  staffProfiles = (data.results || []).filter(staff => {
    const active = staff.Active || staff.active;
    return active && active.toString().trim().toLowerCase() === 'yes';
  });
}

function updateSummaryCards() {
  departmentCounts = {};
  designationCounts = {};

  staffProfiles.forEach(staff => {
    const dept = getDepartmentLabel(staff);
    if (dept) departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;

    const desig = normalizeDesignation(staff.Designation || staff.designation);
    if (desig) designationCounts[desig] = (designationCounts[desig] || 0) + 1;
  });

  const deptTotal = Object.values(departmentCounts).reduce((sum, c) => sum + c, 0);
  if (activeStaffElem) activeStaffElem.textContent = deptTotal;
  if (departmentCountElem) departmentCountElem.textContent = Object.keys(departmentCounts).length || 0;
  if (designationCountElem) designationCountElem.textContent = Object.keys(designationCounts).length || 0;
}

function normalizeDesignation(value) {
  const raw = (value || '').toString().trim();
  return raw ? toTitleCaseWords(raw) : '';
}

function normalizeGroup(value) {
  const raw = (value || '').toString().trim();
  return raw ? raw.toUpperCase() : '';
}

function toNumber(val) {
  const num = parseFloat(String(val || '').replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function toTitleCaseWords(str) {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getDepartmentLabel(staff) {
  let dept = (staff.Department || staff.department || "").trim();
  if (!dept) return null;
  const deptLower = dept.toLowerCase();
  if (deptLower === 'na' || dept === '-') return null;

  const subDept = (staff.SubDepartment || staff.subDepartment || staff['Sub Department'] || staff.subDept || staff.SubDept || "").trim();
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

function classifyQualification(staff) {
  const highestQualRaw = (
    staff.HighestQualification ||
    staff.highestQualification ||
    staff['Highest Qualification'] ||
    staff.Qualification ||
    staff.qualification ||
    staff['Educational Qualification'] ||
    staff.educationalQualification ||
    staff.qual ||
    staff.Qual ||
    ""
  ).toString();

  const highestQual = highestQualRaw.trim().toLowerCase().replace(/^[^a-z]+/g, '');
  if (highestQual.includes('ph.d') || highestQual.includes('phd')) return 'Ph.D';
  if (highestQual.startsWith('m')) return 'M.Tech/PG';

  const bKeywords = ['b.tech', 'btech', 'b. tech', 'b.e', 'b e', 'ug', 'under graduate', 'undergraduate', 'bachelor'];
  if (bKeywords.some(k => highestQual.includes(k))) return 'B.Tech/UG';
  return null;
}

function isPhdPursuing(staff) {
  const phdStatus = (staff['Ph.D. Status'] || staff['Ph.D Status'] || staff.phdStatus || "").trim().toLowerCase();
  const phdPursuingRaw = (staff['Ph.D Pursuing'] || staff['Phd Pursuing'] || staff['PhdPursuing'] || staff.phdPursuing || staff.pursuingPhd || staff.pursuingphd || "").toString().trim().toLowerCase();
  const pursuingTokens = ['pursuing', 'ongoing', 'registered'];
  const pursueFlagTokens = ['yes', 'true', '1', 'y', ...pursuingTokens];
  return pursuingTokens.some(t => phdStatus.includes(t)) || pursueFlagTokens.includes(phdPursuingRaw);
}

function isPgPursuing(staff) {
  const pgStatus = (staff.PGStatus || staff.pgStatus || staff['PG Status'] || "").toString().trim().toLowerCase();
  return ['pursuing', 'ongoing', 'registered', 'yes', 'true', '1', 'y'].includes(pgStatus);
}

function getExperienceYearsFromSource(staff, source) {
  const monthsToYears = months => months / 12;
  const sourceKey = (source || '').toString();

  const puMonths = toNumber(
    staff.PUExperienceInMonths ??
    staff.puExperienceInMonths ??
    staff.PUExperience ??
    staff.puExperience
  );
  const puYears = toNumber(staff.PUExperienceInYears ?? staff.puExperienceInYears);
  if (puMonths !== null) return monthsToYears(puMonths);
  if (puYears !== null) return puYears;

  return null;
}

function renderGroupStats() {
  const loading = document.getElementById('groupStatsLoading');
  const content = document.getElementById('groupStatsContent');
  const body = document.getElementById('groupStatsBody');
  const totalEl = document.getElementById('groupTotal');

  if (!loading || !content || !body || !totalEl) return;
  loading.style.display = 'block';
  content.style.display = 'none';

  groupCounts = {};
  groupDeptCounts = {};

  staffProfiles.forEach(staff => {
    const group = normalizeGroup(staff['Group (Staff Category)'] || staff.group || staff.Group);
    if (!group) return;
    groupCounts[group] = (groupCounts[group] || 0) + 1;

    const dept = getDepartmentLabel(staff);
    if (dept) {
      if (!groupDeptCounts[group]) groupDeptCounts[group] = {};
      groupDeptCounts[group][dept] = (groupDeptCounts[group][dept] || 0) + 1;
    }
  });

  const order = ['A', 'B', 'C', 'D', 'NA'];
  const sorted = order
    .filter(key => groupCounts[key])
    .map(key => [key, groupCounts[key]]);
  const total = sorted.reduce((sum, [, c]) => sum + c, 0);

  body.innerHTML = '';
  sorted.forEach(([group, count]) => {
    const row = document.createElement('tr');
    const badge = document.createElement('span');
    badge.className = 'badge bg-primary';
    badge.role = 'button';
    badge.textContent = count;
    badge.addEventListener('click', () => showGroupDeptBreakdown(group));

    const tdGroup = document.createElement('td');
    tdGroup.textContent = group;
    const tdCount = document.createElement('td');
    tdCount.className = 'text-center';
    tdCount.appendChild(badge);

    row.appendChild(tdGroup);
    row.appendChild(tdCount);
    body.appendChild(row);
  });

  totalEl.textContent = total;
  loading.style.display = 'none';
  content.style.display = 'block';
}

function renderQualificationStats() {
  const loading = document.getElementById('qualificationStatsLoading');
  const content = document.getElementById('qualificationStatsContent');
  const body = document.getElementById('qualificationStatsBody');
  const totalEl = document.getElementById('qualificationTotal');

  if (!loading || !content || !body || !totalEl) return;
  loading.style.display = 'block';
  content.style.display = 'none';

  const qualificationCounts = {
    'Ph.D': 0,
    'M.Tech/PG': 0,
    'B.Tech/UG': 0
  };
  qualificationDeptCounts = {};
  let phdPursuing = 0;
  let pgPursuing = 0;

  staffProfiles.forEach(staff => {
    if (isPhdPursuing(staff)) phdPursuing++;
    if (isPgPursuing(staff)) pgPursuing++;

    const bucket = classifyQualification(staff);
    if (!bucket) return;
    qualificationCounts[bucket] = (qualificationCounts[bucket] || 0) + 1;

    const dept = getDepartmentLabel(staff);
    if (dept) {
      if (!qualificationDeptCounts[dept]) {
        qualificationDeptCounts[dept] = { 'Ph.D': 0, 'M.Tech/PG': 0, 'B.Tech/UG': 0, 'Ph.D Pursuing (status)': 0, 'PG Pursuing (status)': 0, total: 0 };
      }
      qualificationDeptCounts[dept][bucket]++;
      qualificationDeptCounts[dept].total++;
      if (isPhdPursuing(staff)) qualificationDeptCounts[dept]['Ph.D Pursuing (status)']++;
      if (isPgPursuing(staff)) qualificationDeptCounts[dept]['PG Pursuing (status)']++;
    }
  });

  const total = Object.values(qualificationCounts).reduce((a, b) => a + b, 0);
  body.innerHTML = '';

  ['Ph.D', 'M.Tech/PG', 'B.Tech/UG'].forEach(label => {
    const count = qualificationCounts[label] || 0;
    const row = document.createElement('tr');
    const badge = document.createElement('span');
    badge.className = 'badge bg-success';
    badge.role = 'button';
    badge.textContent = count;
    badge.addEventListener('click', () => showQualificationDeptBreakdown(label));

    const tdLabel = document.createElement('td');
    tdLabel.textContent = label;
    const tdCount = document.createElement('td');
    tdCount.className = 'text-center';
    tdCount.appendChild(badge);

    row.appendChild(tdLabel);
    row.appendChild(tdCount);
    body.appendChild(row);
  });

  const phdRow = document.createElement('tr');
  phdRow.innerHTML = `
    <td>Ph.D Pursuing (status)</td>
    <td class="text-center"><span class="badge bg-secondary" role="button">${phdPursuing}</span></td>
  `;
  phdRow.querySelector('span')?.addEventListener('click', () => showQualificationDeptBreakdown('Ph.D Pursuing (status)'));
  body.appendChild(phdRow);

  const pgRow = document.createElement('tr');
  pgRow.innerHTML = `
    <td>PG Pursuing (status)</td>
    <td class="text-center"><span class="badge bg-secondary" role="button">${pgPursuing}</span></td>
  `;
  pgRow.querySelector('span')?.addEventListener('click', () => showQualificationDeptBreakdown('PG Pursuing (status)'));
  body.appendChild(pgRow);

  totalEl.textContent = total;
  loading.style.display = 'none';
  content.style.display = 'block';
}

// existing Qualification section is reused for categories; rename heading in DOM if needed
function renderQualCategoryStats() {
  const loading = document.getElementById('qualificationStatsLoading');
  const content = document.getElementById('qualificationStatsContent');
  const body = document.getElementById('qualificationStatsBody');
  const totalEl = document.getElementById('qualificationTotal');

  if (!loading || !content || !body || !totalEl) return;
  loading.style.display = 'block';
  content.style.display = 'none';

  const orderedCats = [
    "Below SSC",
    "SSC / Equivalent",
    "Diploma",
    "Undergraduate (UG)",
    "Postgraduate (PG)",
    "Doctoral (PhD)"
  ];

  qualCatCounts = {};
  qualCatDeptCounts = {};

  staffProfiles.forEach(staff => {
    const cat = (staff.HighestQualificationCategory || staff.highestQualificationCategory || "").trim();
    if (!cat) return;
    qualCatCounts[cat] = (qualCatCounts[cat] || 0) + 1;
    const dept = getDepartmentLabel(staff);
    if (dept) {
      if (!qualCatDeptCounts[cat]) qualCatDeptCounts[cat] = {};
      qualCatDeptCounts[cat][dept] = (qualCatDeptCounts[cat][dept] || 0) + 1;
    }
  });

  // PG Pursuing using PGStatus
  const pgPursuing = staffProfiles.filter(isPgPursuing).length;

  const total = Object.values(qualCatCounts).reduce((a, b) => a + b, 0);
  body.innerHTML = '';

  orderedCats.forEach(label => {
    const count = qualCatCounts[label] || 0;
    const row = document.createElement('tr');
    const badge = document.createElement('span');
    badge.className = 'badge bg-primary';
    badge.role = 'button';
    badge.textContent = count;
    badge.addEventListener('click', () => showQualCatDeptBreakdown(label));

    const tdLabel = document.createElement('td');
    tdLabel.textContent = label;
    const tdCount = document.createElement('td');
    tdCount.className = 'text-center';
    tdCount.appendChild(badge);

    row.appendChild(tdLabel);
    row.appendChild(tdCount);
    body.appendChild(row);
  });

  // Append PG Pursuing row (status from PGStatus)
  const pgRow = document.createElement('tr');
  pgRow.innerHTML = `
    <td>PG Pursuing (status)</td>
    <td class="text-center"><span class="badge bg-secondary" role="button">${pgPursuing}</span></td>
  `;
  pgRow.querySelector('span')?.addEventListener('click', () => showQualificationDeptBreakdown('PG Pursuing (status)'));
  body.appendChild(pgRow);

  totalEl.textContent = total;
  loading.style.display = 'none';
  content.style.display = 'block';
}

function renderExperienceStats() {
  const loading = document.getElementById('experienceStatsLoading');
  const content = document.getElementById('experienceStatsContent');
  const body = document.getElementById('experienceStatsBody');
  const totalEl = document.getElementById('experienceTotal');
  const countEl = document.getElementById('experienceFilterCount');
  const deptBtn = document.getElementById('experienceFilterDeptBtn');

  if (!loading || !content || !body || !totalEl) return;
  loading.style.display = 'block';
  content.style.display = 'none';

  const sourceSelect = document.getElementById('experienceSourceSelect');
  const selectedSource = sourceSelect?.value || 'PUExperienceInMonths';

  const buckets = { '0-5 Years (A)': 0, '5-10 Years (B)': 0, '10+ Years (C)': 0 };
  const deptCounts = {};

  staffProfiles.forEach(staff => {
    const expYears = getExperienceYearsFromSource(staff, selectedSource);
    if (expYears === null || expYears < 0) return;

    let bucketKey = null;
    if (expYears <= 5) bucketKey = '0-5 Years (A)';
    else if (expYears > 5 && expYears <= 10) bucketKey = '5-10 Years (B)';
    else if (expYears > 10) bucketKey = '10+ Years (C)';

    if (!bucketKey) return;
    buckets[bucketKey]++;

    const dept = getDepartmentLabel(staff);
    if (dept) {
      if (!deptCounts[dept]) {
        deptCounts[dept] = { '0-5 Years (A)': 0, '5-10 Years (B)': 0, '10+ Years (C)': 0, total: 0 };
      }
      deptCounts[dept][bucketKey]++;
      deptCounts[dept].total++;
    }
  });

  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  body.innerHTML = '';
  ['0-5 Years (A)', '5-10 Years (B)', '10+ Years (C)'].forEach(bucket => {
    const count = buckets[bucket] || 0;
    const row = document.createElement('tr');
    const badge = document.createElement('span');
    badge.className = 'badge bg-info';
    badge.role = 'button';
    badge.textContent = count;
    badge.addEventListener('click', () => showExperienceDeptBreakdown(bucket));

    const tdLabel = document.createElement('td');
    tdLabel.textContent = bucket;
    const tdCount = document.createElement('td');
    tdCount.className = 'text-center';
    tdCount.appendChild(badge);

    row.appendChild(tdLabel);
    row.appendChild(tdCount);
    body.appendChild(row);
  });

  totalEl.textContent = total;
  experienceDeptStats = deptCounts;
  experienceBucketTotals = buckets;
  experienceTotalOverall = total;
  experienceCustomDeptStats = null;
  experienceCustomTotal = 0;
  experienceCustomLabel = '';
  if (deptBtn) deptBtn.disabled = true;
  if (countEl) countEl.textContent = total;

  updateExperienceHint();
  loading.style.display = 'none';
  content.style.display = 'block';
}

function setupExperienceFilter() {
  if (experienceFilterInitialized) return;
  experienceFilterInitialized = true;

  const opSelect = document.getElementById('experienceFilterOp');
  const val1 = document.getElementById('experienceFilterVal1');
  const val2 = document.getElementById('experienceFilterVal2');
  const applyBtn = document.getElementById('experienceFilterApply');
  const countEl = document.getElementById('experienceFilterCount');
  const deptBtn = document.getElementById('experienceFilterDeptBtn');
  const sourceSelect = document.getElementById('experienceSourceSelect');

  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
      renderExperienceStats();
    });
  }

  const toggleSecond = () => {
    if (!opSelect || !val2) return;
    const op = opSelect.value;
    if (op === 'between') {
      val2.style.display = '';
    } else {
      val2.style.display = 'none';
      val2.value = '';
    }
  };
  opSelect?.addEventListener('change', toggleSecond);
  toggleSecond();

  deptBtn?.addEventListener('click', showExperienceCustomDeptBreakdown);

  applyBtn?.addEventListener('click', () => {
    if (!opSelect || !val1 || !countEl || !deptBtn) return;
    const opRaw = (opSelect.value || '').trim();
    const op = opRaw === '≤' ? '<=' : opRaw === '≥' ? '>=' : opRaw;
    const source = sourceSelect?.value || 'PUExperienceYears';
    const v1 = parseFloat(val1.value);
    const v2 = parseFloat(val2?.value);
    const needsSecond = op === 'between';

    if (!['<', '<=', '=', '>=', '>', 'between'].includes(op) || !Number.isFinite(v1) || (needsSecond && !Number.isFinite(v2))) {
      countEl.textContent = '0';
      deptBtn.disabled = true;
      experienceCustomDeptStats = null;
      experienceCustomTotal = 0;
      experienceCustomLabel = '';
      return;
    }

    const minVal = needsSecond ? Math.min(v1, v2) : v1;
    const maxVal = needsSecond ? Math.max(v1, v2) : v1;
    const deptCounts = {};
    let total = 0;

    staffProfiles.forEach(staff => {
      const expYears = getExperienceYearsFromSource(staff, source);
      if (expYears === null || expYears < 0) return;

      let match = false;
      switch (op) {
        case '<': match = expYears < v1; break;
        case '<=': match = expYears <= v1; break;
        case '=': match = expYears === v1; break;
        case '>=': match = expYears >= v1; break;
        case '>': match = expYears > v1; break;
        case 'between': match = expYears >= minVal && expYears <= maxVal; break;
      }
      if (!match) return;

      total++;
      const dept = getDepartmentLabel(staff);
      if (dept) deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    countEl.textContent = total;
    experienceCustomDeptStats = deptCounts;
    experienceCustomTotal = total;
    experienceCustomLabel = `Source: ${(sourceSelect?.selectedOptions?.[0]?.textContent || source)} | ${
      op === 'between' ? `Between ${minVal} and ${maxVal} years` : `${op} ${v1} years`
    }`;
    deptBtn.disabled = total === 0;
  });
}

function populateDepartmentModal() {
  const loading = document.getElementById('departmentFacultyLoading');
  const content = document.getElementById('departmentFacultyContent');
  const error = document.getElementById('departmentFacultyError');
  const body = document.getElementById('departmentFacultyTableBody');
  const totalEl = document.getElementById('totalFacultyCount');

  if (!loading || !content || !error || !body || !totalEl) return;
  loading.style.display = 'block';
  content.style.display = 'none';
  error.style.display = 'none';

  try {
    const sorted = Object.entries(departmentCounts)
      .sort(([, a], [, b]) => b - a || 0);

    body.innerHTML = '';
    sorted.forEach(([dept, count], idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${dept}</strong></td>
        <td class="text-center"><span class="badge bg-primary">${count}</span></td>
      `;
      body.appendChild(row);
    });

    const totalSum = sorted.reduce((sum, [, count]) => sum + count, 0);
    totalEl.textContent = totalSum;
    loading.style.display = 'none';
    content.style.display = 'block';
  } catch (err) {
    console.error('Error populating department modal:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

function populateDesignationListModal() {
  const loading = document.getElementById('designationListLoading');
  const content = document.getElementById('designationListContent');
  const error = document.getElementById('designationListError');
  const body = document.getElementById('designationListBody');
  const uniqueEl = document.getElementById('designationListUnique');
  const totalEl = document.getElementById('designationListTotal');

  if (!loading || !content || !error || !body || !uniqueEl || !totalEl) return;
  loading.style.display = 'block';
  content.style.display = 'none';
  error.style.display = 'none';

  try {
    body.innerHTML = '';
    const sorted = Object.entries(designationCounts).sort(([, a], [, b]) => b - a || 0);
    const totalActiveByDesignation = sorted.reduce((sum, [, c]) => sum + c, 0);
    sorted.forEach(([desig, count], idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td>${desig}</td>
        <td class="text-center"><span class="badge bg-primary" role="button">${count}</span></td>
      `;
      row.querySelector('span')?.addEventListener('click', () => showDesignationDeptBreakdown(desig));
      body.appendChild(row);
    });

    uniqueEl.textContent = sorted.length;
    totalEl.textContent = totalActiveByDesignation;

    loading.style.display = 'none';
    content.style.display = 'block';
  } catch (err) {
    console.error('Error populating designation list:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

function showDesignationDeptBreakdown(designation) {
  const modal = document.getElementById('designationDeptModal');
  const title = document.getElementById('designationDeptModalTitle');
  const loading = document.getElementById('designationDeptLoading');
  const content = document.getElementById('designationDeptContent');
  const error = document.getElementById('designationDeptError');
  const body = document.getElementById('designationDeptTableBody');
  const totalEl = document.getElementById('designationDeptTotal');

  if (!modal || !title || !loading || !content || !error || !body || !totalEl) return;
  title.textContent = designation || 'Designation';
  loading.style.display = 'block';
  content.style.display = 'none';
  error.style.display = 'none';

  try {
    const deptCounts = {};
    staffProfiles
      .filter(staff => normalizeDesignation(staff.Designation || staff.designation) === designation)
      .forEach(staff => {
        const dept = getDepartmentLabel(staff);
        if (dept) deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });

    const sorted = Object.entries(deptCounts).sort(([, a], [, b]) => b - a || 0);
    body.innerHTML = '';
    sorted.forEach(([dept, count], idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${dept}</strong></td>
        <td class="text-center"><span class="badge bg-primary">${count}</span></td>
      `;
      body.appendChild(row);
    });

    totalEl.textContent = sorted.reduce((sum, [, c]) => sum + c, 0);
    loading.style.display = 'none';
    content.style.display = 'block';
    bootstrap.Modal.getOrCreateInstance(modal).show();
  } catch (err) {
    console.error('Error showing designation breakdown:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

function showGroupDeptBreakdown(groupLabel) {
  const modal = document.getElementById('groupDeptModal');
  const title = document.getElementById('groupDeptModalTitle');
  const loading = document.getElementById('groupDeptLoading');
  const content = document.getElementById('groupDeptContent');
  const error = document.getElementById('groupDeptError');
  const body = document.getElementById('groupDeptTableBody');
  const totalEl = document.getElementById('groupDeptTotal');

  if (!modal || !title || !loading || !content || !error || !body || !totalEl) return;
  title.textContent = `Group ${groupLabel}`;
  loading.style.display = 'block';
  content.style.display = 'none';
  error.style.display = 'none';

  try {
    const deptCounts = groupDeptCounts[groupLabel] || {};
    const sorted = Object.entries(deptCounts).sort(([, a], [, b]) => b - a || 0);
    body.innerHTML = '';
    sorted.forEach(([dept, count], idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${dept}</strong></td>
        <td class="text-center"><span class="badge bg-primary">${count}</span></td>
      `;
      body.appendChild(row);
    });

    totalEl.textContent = Object.values(deptCounts).reduce((a, b) => a + b, 0);
    loading.style.display = 'none';
    content.style.display = 'block';
    bootstrap.Modal.getOrCreateInstance(modal).show();
  } catch (err) {
    console.error('Error showing group breakdown:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

function showQualificationDeptBreakdown(qualification) {
  const modal = document.getElementById('qualificationDeptModal');
  const title = document.getElementById('qualificationDeptModalTitle');
  const loading = document.getElementById('qualificationDeptLoading');
  const content = document.getElementById('qualificationDeptContent');
  const error = document.getElementById('qualificationDeptError');
  const body = document.getElementById('qualificationDeptTableBody');
  const totalEl = document.getElementById('qualificationDeptTotal');

  if (!modal || !title || !loading || !content || !error || !body || !totalEl) return;
  title.textContent = qualification;
  loading.style.display = 'block';
  content.style.display = 'none';
  error.style.display = 'none';

  try {
    const filtered = staffProfiles.filter(staff => {
      if (qualification === 'Ph.D Pursuing (status)') return isPhdPursuing(staff);
      if (qualification === 'PG Pursuing (status)') return isPgPursuing(staff);
      return classifyQualification(staff) === qualification;
    });

    const deptCounts = {};
    filtered.forEach(staff => {
      const dept = getDepartmentLabel(staff);
      if (dept) deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    const sorted = Object.entries(deptCounts).sort(([, a], [, b]) => b - a || 0);
    body.innerHTML = '';
    sorted.forEach(([dept, count], idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${dept}</strong></td>
        <td class="text-center"><span class="badge bg-success">${count}</span></td>
      `;
      body.appendChild(row);
    });

    totalEl.textContent = filtered.length;
    loading.style.display = 'none';
    content.style.display = 'block';
    bootstrap.Modal.getOrCreateInstance(modal).show();
  } catch (err) {
    console.error('Error showing qualification breakdown:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

function showQualCatDeptBreakdown(category) {
  const modal = document.getElementById('qualificationDeptModal');
  const title = document.getElementById('qualificationDeptModalTitle');
  const loading = document.getElementById('qualificationDeptLoading');
  const content = document.getElementById('qualificationDeptContent');
  const error = document.getElementById('qualificationDeptError');
  const body = document.getElementById('qualificationDeptTableBody');
  const totalEl = document.getElementById('qualificationDeptTotal');

  if (!modal || !title || !loading || !content || !error || !body || !totalEl) return;
  title.textContent = category || 'Qualification Category';
  loading.style.display = 'block';
  content.style.display = 'none';
  error.style.display = 'none';

  try {
    const deptCounts = qualCatDeptCounts[category] || {};
    const sorted = Object.entries(deptCounts).sort(([, a], [, b]) => b - a || 0);
    body.innerHTML = '';
    sorted.forEach(([dept, count], idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${dept}</strong></td>
        <td class="text-center"><span class="badge bg-success">${count}</span></td>
      `;
      body.appendChild(row);
    });

    totalEl.textContent = sorted.reduce((sum, [, c]) => sum + c, 0);
    loading.style.display = 'none';
    content.style.display = 'block';
    bootstrap.Modal.getOrCreateInstance(modal).show();
  } catch (err) {
    console.error('Error showing qualification category breakdown:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

function showExperienceDeptBreakdown(bucketLabel) {
  const modal = document.getElementById('experienceDeptModal');
  const title = document.getElementById('experienceDeptModalTitle');
  const loading = document.getElementById('experienceDeptLoading');
  const content = document.getElementById('experienceDeptContent');
  const error = document.getElementById('experienceDeptError');
  const body = document.getElementById('experienceDeptTableBody');
  const totalEl = document.getElementById('experienceDeptTotal');

  if (!modal || !title || !loading || !content || !error || !body || !totalEl) return;
  title.textContent = bucketLabel;
  loading.style.display = 'block';
  content.style.display = 'none';
  error.style.display = 'none';

  try {
    const rows = Object.entries(experienceDeptStats)
      .map(([dept, counts]) => ({ dept, count: counts[bucketLabel] || 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count || a.dept.localeCompare(b.dept));

    body.innerHTML = '';
    rows.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${row.dept}</strong></td>
        <td class="text-center"><span class="badge bg-info">${row.count}</span></td>
      `;
      body.appendChild(tr);
    });

    totalEl.textContent = rows.reduce((sum, r) => sum + r.count, 0);
    loading.style.display = 'none';
    content.style.display = 'block';
    bootstrap.Modal.getOrCreateInstance(modal).show();
  } catch (err) {
    console.error('Error showing experience breakdown:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

function showExperienceCustomDeptBreakdown() {
  const modal = document.getElementById('experienceDeptModal');
  const title = document.getElementById('experienceDeptModalTitle');
  const loading = document.getElementById('experienceDeptLoading');
  const content = document.getElementById('experienceDeptContent');
  const error = document.getElementById('experienceDeptError');
  const body = document.getElementById('experienceDeptTableBody');
  const totalEl = document.getElementById('experienceDeptTotal');

  if (!experienceCustomDeptStats || !modal || !title || !loading || !content || !error || !body || !totalEl) return;
  title.textContent = experienceCustomLabel || 'Experience (Custom)';
  loading.style.display = 'block';
  content.style.display = 'none';
  error.style.display = 'none';

  try {
    const rows = Object.entries(experienceCustomDeptStats)
      .map(([dept, count]) => ({ dept, count }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count || a.dept.localeCompare(b.dept));

    body.innerHTML = '';
    rows.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${row.dept}</strong></td>
        <td class="text-center"><span class="badge bg-info">${row.count}</span></td>
      `;
      body.appendChild(tr);
    });

    totalEl.textContent = experienceCustomTotal || rows.reduce((sum, r) => sum + r.count, 0);
    loading.style.display = 'none';
    content.style.display = 'block';
    bootstrap.Modal.getOrCreateInstance(modal).show();
  } catch (err) {
    console.error('Error showing custom experience breakdown:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

function updateExperienceHint() {
  const hint = document.getElementById('experienceFilterHint');
  const sourceSelect = document.getElementById('experienceSourceSelect');
  if (!hint || !sourceSelect) return;
  const label = sourceSelect.selectedOptions?.[0]?.textContent || 'Experience';
  hint.textContent = `${label} is used for buckets and filters (months are converted to years).`;
}
