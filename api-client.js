const API_BASE_URL = "https://orthohandtherapy-aqavbrhucuh3hgcs.eastus2-01.azurewebsites.net/api";

const SESSION_STORAGE_KEYS = {
  clinicianSession: "orthoMotionClinicianSession",
  activePatientId: "orthoMotionActivePatientId",
  activePatientRecord: "orthoMotionActivePatientRecord"
};

function readSessionStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveSessionStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const message = payload.error || `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

function getClinicianSession() {
  return readSessionStorage(SESSION_STORAGE_KEYS.clinicianSession, null);
}

function saveClinicianSession(clinician) {
  saveSessionStorage(SESSION_STORAGE_KEYS.clinicianSession, clinician);
}

function clearClinicianSession() {
  localStorage.removeItem(SESSION_STORAGE_KEYS.clinicianSession);
}

function getCurrentClinicianId() {
  return getClinicianSession()?.clinicianId || "";
}

function setActivePatientId(patientId) {
  if (patientId) {
    localStorage.setItem(SESSION_STORAGE_KEYS.activePatientId, patientId);
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);
  }
}

function getActivePatientId() {
  return localStorage.getItem(SESSION_STORAGE_KEYS.activePatientId) || "";
}

function clearActivePatientId() {
  localStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);
}

function saveActivePatientRecord(record) {
  saveSessionStorage(SESSION_STORAGE_KEYS.activePatientRecord, record);
  setActivePatientId(record?.patientId || "");
}

function getActivePatientRecord() {
  const record = readSessionStorage(SESSION_STORAGE_KEYS.activePatientRecord, null);
  const activePatientId = getActivePatientId();
  if (!record || !activePatientId || record.patientId !== activePatientId) {
    return null;
  }

  return record;
}

function clearActivePatientRecord() {
  localStorage.removeItem(SESSION_STORAGE_KEYS.activePatientRecord);
}

async function apiCreateClinicianAccount({ firstName, lastName, email, password }) {
  const payload = await apiRequest("/clinician/signup", {
    method: "POST",
    body: JSON.stringify({ firstName, lastName, email, password })
  });
  saveClinicianSession(payload.clinician);
  return payload.clinician;
}

async function apiSignInClinician({ email, password }) {
  const payload = await apiRequest("/clinician/signin", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  saveClinicianSession(payload.clinician);
  return payload.clinician;
}

async function apiFetchClinicianDetails() {
  const clinicianId = getCurrentClinicianId();
  if (!clinicianId) {
    throw new Error("No clinician is signed in.");
  }

  const payload = await apiRequest(`/clinicians/${encodeURIComponent(clinicianId)}`);
  saveClinicianSession(payload.clinician);
  return payload.clinician;
}

async function apiResetClinicianPassword(newPassword) {
  const clinicianId = getCurrentClinicianId();
  if (!clinicianId) {
    throw new Error("No clinician is signed in.");
  }

  const payload = await apiRequest(`/clinicians/${encodeURIComponent(clinicianId)}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ newPassword })
  });
  saveClinicianSession(payload.clinician);
  return payload.clinician;
}

async function apiFetchClinicianPatients() {
  const clinicianId = getCurrentClinicianId();
  if (!clinicianId) {
    return [];
  }

  const payload = await apiRequest(`/clinicians/${encodeURIComponent(clinicianId)}/patients`);
  return payload.patients || [];
}

async function apiFetchPatientRecord(patientId) {
  const payload = await apiRequest(`/patients/${encodeURIComponent((patientId || "").trim().toUpperCase())}`);
  saveActivePatientRecord(payload.patient);
  return payload.patient;
}

async function refreshActivePatientRecord() {
  const patientId = getActivePatientId();
  if (!patientId) {
    return null;
  }

  return apiFetchPatientRecord(patientId);
}

async function apiSavePatientPlan({ patientId, selectedCategories, assignedItems, clinicianNotes }) {
  const clinicianId = getCurrentClinicianId();
  const payload = await apiRequest("/patients", {
    method: "POST",
    body: JSON.stringify({
      clinicianId,
      patientId,
      selectedCategories,
      assignedItems,
      clinicianNotes
    })
  });
  saveActivePatientRecord(payload.patient);
  return payload.patient;
}

async function apiUpdatePatientItemLog({ patientId, itemId, patch, date }) {
  return apiRequest(`/patients/${encodeURIComponent(patientId)}/progress/item`, {
    method: "POST",
    body: JSON.stringify({
      itemId,
      date: date || getTodayIsoDate(),
      patch
    })
  });
}

async function apiCompletePatientSession(patientId) {
  const payload = await apiRequest(`/patients/${encodeURIComponent(patientId)}/progress/complete`, {
    method: "POST",
    body: JSON.stringify({})
  });
  return payload.progress;
}

async function apiFetchPatientTrends(patientId) {
  const payload = await apiRequest(`/patients/${encodeURIComponent(patientId)}/trends`);
  return payload.trends || [];
}

function getPatientProgress(record = getActivePatientRecord()) {
  return record?.progress || defaultProgress();
}

function getCompletedSessions(record = getActivePatientRecord()) {
  return getPatientProgress(record).completedSessions || 0;
}

function getStreakCount(record = getActivePatientRecord()) {
  return getPatientProgress(record).streakCount || 0;
}

function hasCompletedToday(record = getActivePatientRecord()) {
  return getPatientProgress(record).lastCompletedOn === getTodayIsoDate();
}

function getCurrentDayLabel(record = getActivePatientRecord()) {
  return `Day ${getCompletedSessions(record) + 1}`;
}

function getAssignedCategories(record = getActivePatientRecord()) {
  const selectedIds = new Set(record?.selectedCategories || []);
  return CATEGORY_DEFINITIONS.filter((category) => selectedIds.has(category.id));
}

function getAssignedItems(record = getActivePatientRecord()) {
  return record?.assignedItems || [];
}

function getAssignedItemsByCategory(record = getActivePatientRecord()) {
  const assignedByCategory = new Map();

  getAssignedItems(record).forEach((item) => {
    const existing = assignedByCategory.get(item.categoryKey) || [];
    existing.push(item);
    assignedByCategory.set(item.categoryKey, existing);
  });

  return CATEGORY_DEFINITIONS.filter((category) => assignedByCategory.has(category.key)).map((category) => ({
    ...category,
    assignedItems: assignedByCategory.get(category.key)
  }));
}

function hasAssignedPlan(record = getActivePatientRecord()) {
  return getAssignedItems(record).length > 0;
}

function getDailyItemLog(record = getActivePatientRecord(), date = getTodayIsoDate()) {
  return getPatientProgress(record).dailyLogs?.[date] || {};
}

function getPatientDashboard(record = getActivePatientRecord()) {
  return {
    patientId: record?.patientId || "",
    title: "Assigned hand recovery plan",
    dayLabel: getCurrentDayLabel(record),
    categories: getAssignedCategories(record),
    groupedItems: getAssignedItemsByCategory(record),
    clinicianNotes: record?.clinicianNotes || ""
  };
}
