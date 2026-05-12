const API_BASE_URL = "https://orthohandtherapy-aqavbrhucuh3hgcs.eastus2-01.azurewebsites.net/api";

const SESSION_STORAGE_KEYS = {
  clinicianSession: "orthoMotionClinicianSession",
  activePatientId: "orthoMotionActivePatientId",
  activePatientRecord: "orthoMotionActivePatientRecord"
};

const PREFERENCE_STORAGE_KEYS = {
  rememberedClinicianEmail: "orthoMotionRememberedClinicianEmail",
  rememberedPatientId: "orthoMotionRememberedPatientId"
};

function readStorageValue(storage, key, fallback) {
  const raw = storage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readSessionStorage(key, fallback) {
  const sessionValue = readStorageValue(sessionStorage, key, undefined);
  if (sessionValue !== undefined) {
    return sessionValue;
  }

  return readStorageValue(localStorage, key, fallback);
}

function getClinicianSessionStorage() {
  if (sessionStorage.getItem(SESSION_STORAGE_KEYS.clinicianSession)) {
    return sessionStorage;
  }

  return localStorage;
}

function saveSessionStorage(key, value, storage = localStorage) {
  storage.setItem(key, JSON.stringify(value));
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

function saveClinicianSession(clinician, rememberOnDevice = null) {
  const existingStorage = getClinicianSessionStorage();
  localStorage.removeItem(SESSION_STORAGE_KEYS.clinicianSession);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.clinicianSession);

  const targetStorage =
    rememberOnDevice === null
      ? existingStorage
      : rememberOnDevice
        ? localStorage
        : sessionStorage;

  saveSessionStorage(SESSION_STORAGE_KEYS.clinicianSession, clinician, targetStorage);
}

function clearClinicianSession() {
  localStorage.removeItem(SESSION_STORAGE_KEYS.clinicianSession);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.clinicianSession);
}

function getCurrentClinicianId() {
  return getClinicianSession()?.clinicianId || "";
}

function getPatientSessionStorage() {
  if (sessionStorage.getItem(SESSION_STORAGE_KEYS.activePatientId)) {
    return sessionStorage;
  }

  return localStorage;
}

function setActivePatientId(patientId, rememberOnDevice = null) {
  const existingStorage = getPatientSessionStorage();
  localStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);

  if (patientId) {
    const targetStorage =
      rememberOnDevice === null
        ? existingStorage
        : rememberOnDevice
          ? localStorage
          : sessionStorage;

    targetStorage.setItem(SESSION_STORAGE_KEYS.activePatientId, patientId);
  }
}

function getActivePatientId() {
  return (
    sessionStorage.getItem(SESSION_STORAGE_KEYS.activePatientId) ||
    localStorage.getItem(SESSION_STORAGE_KEYS.activePatientId) ||
    ""
  );
}

function clearActivePatientId() {
  localStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);
}

function saveActivePatientRecord(record, rememberOnDevice = null) {
  const existingStorage = getPatientSessionStorage();
  localStorage.removeItem(SESSION_STORAGE_KEYS.activePatientRecord);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.activePatientRecord);

  const targetStorage =
    rememberOnDevice === null
      ? existingStorage
      : rememberOnDevice
        ? localStorage
        : sessionStorage;

  saveSessionStorage(SESSION_STORAGE_KEYS.activePatientRecord, record, targetStorage);
  setActivePatientId(record?.patientId || "", rememberOnDevice);
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
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.activePatientRecord);
}

function saveRememberedClinicianEmail(email) {
  if (email) {
    localStorage.setItem(PREFERENCE_STORAGE_KEYS.rememberedClinicianEmail, email);
  } else {
    localStorage.removeItem(PREFERENCE_STORAGE_KEYS.rememberedClinicianEmail);
  }
}

function getRememberedClinicianEmail() {
  return localStorage.getItem(PREFERENCE_STORAGE_KEYS.rememberedClinicianEmail) || "";
}

function saveRememberedPatientId(patientId) {
  if (patientId) {
    localStorage.setItem(PREFERENCE_STORAGE_KEYS.rememberedPatientId, patientId);
  } else {
    localStorage.removeItem(PREFERENCE_STORAGE_KEYS.rememberedPatientId);
  }
}

function getRememberedPatientId() {
  return localStorage.getItem(PREFERENCE_STORAGE_KEYS.rememberedPatientId) || "";
}

async function apiCreateClinicianAccount({ inviteCode, firstName, lastName, email, password }) {
  const payload = await apiRequest("/clinician/signup", {
    method: "POST",
    body: JSON.stringify({ inviteCode, firstName, lastName, email, password })
  });
  saveClinicianSession(payload.clinician, true);
  return payload.clinician;
}

async function apiSignInClinician({ email, password, rememberOnDevice = false }) {
  const payload = await apiRequest("/clinician/signin", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  saveClinicianSession(payload.clinician, rememberOnDevice);
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

async function apiFetchPatientRecordWithPreference(patientId, rememberOnDevice) {
  const payload = await apiRequest(`/patients/${encodeURIComponent((patientId || "").trim().toUpperCase())}`);
  saveActivePatientRecord(payload.patient, rememberOnDevice);
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
