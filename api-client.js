const API_BASE_URL = window.__APP_CONFIG__?.apiBaseUrl || "/api";
const CLINICIAN_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const PATIENT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const SESSION_STORAGE_KEYS = {
  clinicianSession: "orthoHandRecoveryClinicianSession",
  activePatientId: "orthoHandRecoveryActivePatientId",
  activePatientRecord: "orthoHandRecoveryActivePatientRecord"
};

const PREFERENCE_STORAGE_KEYS = {
  rememberedClinicianEmail: "orthoHandRecoveryRememberedClinicianEmail",
  rememberedPatientEmail: "orthoHandRecoveryRememberedPatientEmail",
  patientSessionExpiresAt: "orthoHandRecoveryPatientSessionExpiresAt"
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
  const clinician = readSessionStorage(SESSION_STORAGE_KEYS.clinicianSession, null);
  if (!clinician) return null;

  const expiresAt = Number(clinician.sessionExpiresAt || 0);
  if (expiresAt && Date.now() >= expiresAt) {
    clearClinicianSession();
    return null;
  }

  if (!expiresAt) {
    const migratedSession = {
      ...clinician,
      sessionExpiresAt: Date.now() + CLINICIAN_SESSION_DURATION_MS
    };
    localStorage.setItem(SESSION_STORAGE_KEYS.clinicianSession, JSON.stringify(migratedSession));
    sessionStorage.removeItem(SESSION_STORAGE_KEYS.clinicianSession);
    return migratedSession;
  }

  return clinician;
}

function saveClinicianSession(clinician) {
  const existingSession = getClinicianSession();
  localStorage.removeItem(SESSION_STORAGE_KEYS.clinicianSession);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.clinicianSession);
  const sessionExpiresAt = existingSession?.clinicianId === clinician?.clinicianId
    ? existingSession.sessionExpiresAt
    : Date.now() + CLINICIAN_SESSION_DURATION_MS;
  saveSessionStorage(SESSION_STORAGE_KEYS.clinicianSession, { ...clinician, sessionExpiresAt }, localStorage);
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
  const existingPatientId = localStorage.getItem(SESSION_STORAGE_KEYS.activePatientId)
    || sessionStorage.getItem(SESSION_STORAGE_KEYS.activePatientId)
    || "";
  const existingExpiresAt = Number(localStorage.getItem(PREFERENCE_STORAGE_KEYS.patientSessionExpiresAt) || 0);
  localStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);

  if (patientId) {
    const expiresAt = rememberOnDevice === true
      ? -1
      : rememberOnDevice === null && existingPatientId === patientId && (existingExpiresAt === -1 || existingExpiresAt > Date.now())
        ? existingExpiresAt
        : Date.now() + PATIENT_SESSION_DURATION_MS;
    localStorage.setItem(SESSION_STORAGE_KEYS.activePatientId, patientId);
    localStorage.setItem(PREFERENCE_STORAGE_KEYS.patientSessionExpiresAt, `${expiresAt}`);
  }
}

function getActivePatientId() {
  const patientId = (
    sessionStorage.getItem(SESSION_STORAGE_KEYS.activePatientId) ||
    localStorage.getItem(SESSION_STORAGE_KEYS.activePatientId) ||
    ""
  );
  if (!patientId) return "";

  const expiresAt = Number(localStorage.getItem(PREFERENCE_STORAGE_KEYS.patientSessionExpiresAt) || 0);
  if (expiresAt !== -1 && expiresAt && Date.now() >= expiresAt) {
    signOutPatientSession();
    return "";
  }

  if (!expiresAt) {
    const legacyExpiration = getRememberedPatientEmail() === (getActivePatientRecord()?.email || "")
      ? -1
      : Date.now() + PATIENT_SESSION_DURATION_MS;
    localStorage.setItem(PREFERENCE_STORAGE_KEYS.patientSessionExpiresAt, `${legacyExpiration}`);
  }
  localStorage.setItem(SESSION_STORAGE_KEYS.activePatientId, patientId);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);
  return patientId;
}

function clearActivePatientId() {
  localStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.activePatientId);
  localStorage.removeItem(PREFERENCE_STORAGE_KEYS.patientSessionExpiresAt);
}

function saveActivePatientRecord(record, rememberOnDevice = null) {
  localStorage.removeItem(SESSION_STORAGE_KEYS.activePatientRecord);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.activePatientRecord);
  saveSessionStorage(SESSION_STORAGE_KEYS.activePatientRecord, record, localStorage);
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

function signOutPatientSession() {
  clearActivePatientId();
  clearActivePatientRecord();
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

function saveRememberedPatientEmail(email) {
  if (email) {
    localStorage.setItem(PREFERENCE_STORAGE_KEYS.rememberedPatientEmail, email);
  } else {
    localStorage.removeItem(PREFERENCE_STORAGE_KEYS.rememberedPatientEmail);
  }
}

function getRememberedPatientEmail() {
  return localStorage.getItem(PREFERENCE_STORAGE_KEYS.rememberedPatientEmail) || "";
}

async function apiCreateClinicianAccount({ inviteCode, firstName, lastName, email, password }) {
  const payload = await apiRequest("/clinician/signup", {
    method: "POST",
    body: JSON.stringify({ inviteCode, firstName, lastName, email, password })
  });
  saveClinicianSession(payload.clinician, true);
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

async function apiRequestClinicianPasswordReset(email) {
  const payload = await apiRequest("/clinician/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
  return payload.message || "If that email matches a clinician account, a reset link has been sent.";
}

async function apiResetClinicianPasswordWithToken({ token, newPassword }) {
  const payload = await apiRequest("/clinician/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword })
  });
  return payload.clinician;
}

async function apiRequestPatientPasswordReset(email) {
  const payload = await apiRequest("/patient/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
  return payload.message || "If that email matches a patient account, a reset link has been sent.";
}

async function apiResetPatientPasswordWithToken({ token, newPassword }) {
  const payload = await apiRequest("/patient/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword })
  });
  return payload.patient;
}

async function apiFetchClinicianPatients() {
  const clinicianId = getCurrentClinicianId();
  if (!clinicianId) {
    return [];
  }

  const payload = await apiRequest(`/clinicians/${encodeURIComponent(clinicianId)}/patients`);
  return payload.patients || [];
}

async function apiFetchClinicians() {
  const payload = await apiRequest("/clinicians");
  return payload.clinicians || [];
}

async function apiCreatePatientInvitation({ selectedCategories, assignedItems }) {
  const clinicianId = getCurrentClinicianId();
  if (!clinicianId) throw new Error("Sign in as a clinician first.");
  const payload = await apiRequest(`/clinicians/${encodeURIComponent(clinicianId)}/patients/invite`, {
    method: "POST",
    body: JSON.stringify({ selectedCategories, assignedItems })
  });
  return payload.patient;
}

async function apiCreatePatientAccount({ email, password, clinicianId, rememberOnDevice = false }) {
  const payload = await apiRequest("/patients/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, clinicianId, date: getTodayIsoDate() })
  });
  saveActivePatientRecord(payload.patient, rememberOnDevice);
  saveRememberedPatientEmail(rememberOnDevice ? payload.patient.email : "");
  return payload.patient;
}

async function apiSignInPatient({ email, password, rememberOnDevice = false }) {
  const payload = await apiRequest("/patients/signin", {
    method: "POST",
    body: JSON.stringify({ email, password, date: getTodayIsoDate() })
  });
  saveActivePatientRecord(payload.patient, rememberOnDevice);
  saveRememberedPatientEmail(rememberOnDevice ? payload.patient.email : "");
  return payload.patient;
}

async function apiFetchClinicianPatientRecord(patientId) {
  const clinicianId = getCurrentClinicianId();
  if (!clinicianId) {
    throw new Error("No clinician is signed in.");
  }
  const normalized = (patientId || "").trim().toUpperCase();
  const payload = await apiRequest(`/clinicians/${encodeURIComponent(clinicianId)}/patients/${encodeURIComponent(normalized)}`);
  saveActivePatientRecord(payload.patient);
  return payload.patient;
}

async function apiFetchPatientRecord(patientId) {
  const payload = await apiRequest(`/patients/${encodeURIComponent((patientId || "").trim().toUpperCase())}?date=${encodeURIComponent(getTodayIsoDate())}`);
  saveActivePatientRecord(payload.patient);
  return payload.patient;
}

async function apiFetchPatientRecordWithPreference(patientId, rememberOnDevice) {
  const payload = await apiRequest(`/patients/${encodeURIComponent((patientId || "").trim().toUpperCase())}?date=${encodeURIComponent(getTodayIsoDate())}`);
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

async function apiSaveClinicianNote({ patientId, clinicianNotes }) {
  const clinicianId = getCurrentClinicianId();
  const payload = await apiRequest(
    `/clinicians/${encodeURIComponent(clinicianId)}/patients/${encodeURIComponent(patientId)}/notes`,
    {
      method: "POST",
      body: JSON.stringify({ clinicianNotes })
    }
  );
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
    body: JSON.stringify({ date: getTodayIsoDate() })
  });
  return payload.progress;
}

async function apiResetPatientDailyProgress(patientId) {
  const payload = await apiRequest(`/patients/${encodeURIComponent(patientId)}/progress/reset`, {
    method: "POST",
    body: JSON.stringify({ date: getTodayIsoDate() })
  });
  return payload.progress;
}

async function apiFetchPatientTrends(patientId) {
  const clinicianId = getCurrentClinicianId();
  const path = clinicianId
    ? `/clinicians/${encodeURIComponent(clinicianId)}/patients/${encodeURIComponent(patientId)}/trends`
    : `/patients/${encodeURIComponent(patientId)}/trends`;
  const payload = await apiRequest(path);
  return payload.trends || [];
}

async function apiFetchPatientAnalytics(patientId) {
  const clinicianId = getCurrentClinicianId();
  if (!clinicianId) {
    throw new Error("Physician sign-in is required to view patient analytics.");
  }
  const payload = await apiRequest(
    `/clinicians/${encodeURIComponent(clinicianId)}/patients/${encodeURIComponent(patientId)}/analytics`
  );
  return payload.analytics || {};
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
  const progress = getPatientProgress(record);
  const today = getTodayIsoDate();
  const todayLog = progress.dailyLogs?.[today] || {};
  const hasExerciseEntries = Object.keys(todayLog).some((key) => key !== "sessionCompletedAt");
  return Boolean(todayLog.sessionCompletedAt && hasExerciseEntries);
}

function getCurrentDayLabel(record = getActivePatientRecord()) {
  return `Day ${getCompletedSessions(record) + 1}`;
}

function getProgramWeek(record = getActivePatientRecord()) {
  if (!record) {
    return 1;
  }
  const logDates = Object.keys(getPatientProgress(record).dailyLogs || {}).sort();
  const startValue = record.createdAt || (logDates[0] ? `${logDates[0]}T12:00:00` : new Date().toISOString());
  const startDate = new Date(startValue);
  if (Number.isNaN(startDate.getTime())) {
    return 1;
  }
  const elapsedDays = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 86400000));
  return Math.floor(elapsedDays / 7) + 1;
}

function getCompletedWeekCount(record = getActivePatientRecord()) {
  const completedWeeks = new Set();
  Object.entries(getPatientProgress(record).dailyLogs || {}).forEach(([date, dayLog]) => {
    if (!dayLog?.sessionCompletedAt) {
      return;
    }
    const completedDate = new Date(`${date}T12:00:00`);
    if (Number.isNaN(completedDate.getTime())) {
      return;
    }
    const dayFromMonday = (completedDate.getDay() + 6) % 7;
    completedDate.setDate(completedDate.getDate() - dayFromMonday);
    completedWeeks.add(completedDate.toISOString().slice(0, 10));
  });
  return completedWeeks.size;
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
    title: "Hand recovery",
    dayLabel: getCurrentDayLabel(record),
    categories: getAssignedCategories(record),
    groupedItems: getAssignedItemsByCategory(record),
    clinicianNotes: record?.clinicianNotes || ""
  };
}
