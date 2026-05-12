const CATEGORY_DEFINITIONS = [
  {
    id: 1,
    key: "mobility-rom",
    title: "Mobility / Range of Motion",
    description: "Restore active motion through the wrist, forearm, fingers, and thumb.",
    lockedNotice: "Only use exercises prescribed or approved by the treating clinician.",
    items: [
      "Wrist flexion/extension AROM",
      "Wrist radial/ulnar deviation AROM",
      "Forearm pronation/supination",
      "Finger flexion/extension AROM",
      "Thumb opposition",
      "Thumb radial/palmar abduction",
      "Finger blocking: DIP",
      "Finger blocking: PIP",
      "Composite fist",
      "Tabletop/intrinsic plus position",
      "Finger abduction/adduction"
    ]
  },
  {
    id: 2,
    key: "tendon-gliding",
    title: "Tendon Gliding",
    description: "Improve tendon excursion and active hand movement patterns.",
    lockedNotice: "Only use tendon gliding patterns prescribed or approved by the treating clinician.",
    items: [
      "Straight hand",
      "Hook fist",
      "Straight fist",
      "Full fist",
      "Tabletop fist",
      "Isolated FDS glide",
      "Isolated FDP glide",
      "Thumb tendon glide",
      "Differential tendon gliding sequence"
    ]
  },
  {
    id: 3,
    key: "edema-pain",
    title: "Edema / Pain Control",
    description: "Track symptoms and reinforce swelling or irritability management tasks.",
    lockedNotice: "Use only clinician-approved symptom management tasks and devices.",
    items: [
      "Hand elevation reminder",
      "Active finger pumping",
      "Gentle wrist/hand AROM for swelling",
      "Compression glove/sleeve education",
      "Retrograde massage reminder, only if prescribed",
      "Ice/heat reminder, only if prescribed",
      "Pain score before exercise",
      "Pain score after exercise",
      "Swelling/tightness check"
    ]
  },
  {
    id: 4,
    key: "nerve-mobility",
    title: "Nerve Mobility",
    description: "Use prescribed neural mobility carefully and stop if symptoms worsen.",
    lockedNotice: "Nerve glides stay locked unless the clinician enables them.",
    items: [
      "Median nerve glide",
      "Ulnar nerve glide",
      "Radial nerve glide",
      "Cervical/shoulder positioning reminder if prescribed"
    ]
  },
  {
    id: 5,
    key: "strengthening",
    title: "Strengthening",
    description: "Rebuild grip, pinch, wrist control, and functional load tolerance.",
    lockedNotice: "Strengthening stays locked unless the clinician enables it.",
    items: [
      "Grip strengthening",
      "Pinch strengthening",
      "Wrist flexion strengthening",
      "Wrist extension strengthening",
      "Radial/ulnar deviation strengthening",
      "Pronation/supination strengthening",
      "Intrinsic hand strengthening",
      "Rubber band finger extension",
      "Putty squeeze",
      "Putty pinch",
      "Putty roll",
      "Putty finger spread"
    ]
  },
  {
    id: 6,
    key: "dexterity-fine-motor",
    title: "Dexterity / Fine Motor Function",
    description: "Practice fine motor control, coordination, and task-specific hand use.",
    lockedNotice: "Choose tasks that match the current healing stage and functional goals.",
    items: [
      "Coin pickup",
      "Pegboard task",
      "Buttoning practice",
      "Zipper practice",
      "Handwriting tolerance",
      "Typing tolerance",
      "Object translation palm-to-fingertips",
      "Small object manipulation",
      "Card flipping",
      "Key turning simulation"
    ]
  },
  {
    id: 7,
    key: "splint-brace",
    title: "Splint / Brace Adherence",
    description: "Support wear schedule, skin checks, and fit concerns.",
    lockedNotice: "Brace and splint instructions should come directly from the clinician.",
    items: [
      "Wear splint/brace as prescribed",
      "Remove only when instructed",
      "Skin check",
      "Strap pressure check",
      "Redness check",
      "Numbness/tingling check",
      "Clean splint/brace reminder",
      "Document wear time",
      "Report poor fit or new pressure areas"
    ]
  },
  {
    id: 8,
    key: "postoperative-protection",
    title: "Postoperative Protection / Precautions",
    description: "Reinforce restrictions, wound monitoring, and protocol-based progression.",
    lockedNotice: "Post-op precautions and progression stay locked unless clinician-enabled.",
    items: [
      "Weight-bearing restriction reminder",
      "Lifting restriction reminder",
      "No forceful gripping reminder",
      "No passive stretching unless prescribed",
      "Wound check reminder",
      "Keep incision dry reminder, if applicable",
      "Follow protocol phase reminder",
      "Surgeon/therapist-defined progression checkpoint",
      "Red flag symptom checklist"
    ]
  },
  {
    id: 9,
    key: "functional-goals",
    title: "Functional Goals",
    description: "Translate the plan into real daily tasks and priorities.",
    lockedNotice: "Functional tasks should reflect the clinician-approved phase and restrictions.",
    items: [
      "Dressing",
      "Bathing/grooming",
      "Cooking/meal preparation",
      "Driving tolerance",
      "Work task practice",
      "School/computer use",
      "Childcare task practice",
      "Sports/hobby-specific task",
      "Carrying light objects, if allowed",
      "Opening containers, if allowed"
    ]
  }
];

const LOCKED_CATEGORY_KEYS = new Set([
  "nerve-mobility",
  "strengthening",
  "postoperative-protection"
]);

const GLOBAL_SAFETY_RULES = [
  "This app tracks exercises and precautions prescribed or approved by the treating clinician. It does not provide medical advice.",
  "Stop and contact the clinician for increasing pain, new numbness or tingling, color change, wound drainage, fever, sudden swelling, or loss of motion."
];

const STORAGE_KEYS = {
  patients: "orthoMotionPatients",
  activePatientId: "orthoMotionActivePatientId",
  clinicianProfile: "orthoMotionClinicianProfile",
  clinicianDraft: "orthoMotionClinicianDraft"
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDailyCount(value) {
  const text = `${value || ""}`.trim().toLowerCase();
  const match = text.match(/^(\d+)(?:\s*x)?(?:\s+daily)?$/);
  if (!match) {
    return null;
  }

  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function makeLibraryItem(category, name) {
  const lowerName = name.toLowerCase();
  const requiresPrescription =
    category.key === "nerve-mobility" ||
    category.key === "strengthening" ||
    lowerName.includes("only if prescribed") ||
    lowerName.includes("if applicable") ||
    lowerName.includes("if allowed") ||
    lowerName.includes("progression checkpoint");

  const contraindicationWarning =
    category.key === "nerve-mobility"
      ? "Stop if symptoms worsen, become sharp, or cause persistent numbness or tingling."
      : category.key === "postoperative-protection"
        ? "Do not progress beyond the prescribed phase or violate surgical precautions."
        : category.key === "strengthening"
          ? "Do not add resistance beyond the clinician-approved level."
          : "Use only within the clinician-approved plan and healing phase.";

  const painStopRule =
    category.key === "edema-pain"
      ? "Pause and notify the clinician if symptoms escalate instead of settling after the task."
      : "Stop if pain meaningfully increases, sharp symptoms appear, or motion quality worsens.";

  const defaultFrequency =
    category.key === "splint-brace" || category.key === "postoperative-protection"
      ? "Check daily"
      : category.key === "functional-goals"
        ? "1x daily practice"
        : "2x daily";

  const defaultDose =
    category.key === "edema-pain"
      ? "2-5 minutes"
      : category.key === "functional-goals"
        ? "5-10 minutes"
        : "1-2 sets of 5-10 reps";

  return {
    id: `${category.key}-${slugify(name)}`,
    category: category.title,
    categoryKey: category.key,
    name,
    patient_friendly_description: `${name} is included here as a clinician-selected tracking item for hand recovery.`,
    default_frequency: defaultFrequency,
    default_sets_reps_duration: defaultDose,
    daily_target_count: 1,
    requires_prescription: requiresPrescription,
    contraindication_warning: contraindicationWarning,
    pain_stop_rule: painStopRule,
    progression_notes: "Advance only when approved by the treating clinician.",
    therapist_notes: "",
    patient_checkoff: false,
    adherence_timestamp: "",
    pain_before: "",
    pain_after: "",
    swelling_response: "",
    symptom_notes: ""
  };
}

const EXERCISE_LIBRARY = CATEGORY_DEFINITIONS.flatMap((category) =>
  category.items.map((name) => makeLibraryItem(category, name))
);

function defaultClinicianProfile() {
  return {
    firstName: "",
    lastName: "",
    email: "",
    password: ""
  };
}

function defaultProgress() {
  return {
    completedSessions: 0,
    streakCount: 0,
    lastCompletedOn: "",
    dailyLogs: {}
  };
}

function defaultPatientRecord(patientId = "") {
  const now = new Date().toISOString();
  return {
    patientId,
    selectedCategories: [],
    assignedItems: [],
    clinicianNotes: "",
    createdAt: now,
    updatedAt: now,
    progress: defaultProgress()
  };
}

function defaultClinicianDraft() {
  return {
    patientId: "",
    selectedCategories: [],
    assignedItems: [],
    clinicianNotes: ""
  };
}

function readStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback();
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback();
  }
}

function getClinicianProfile() {
  return { ...defaultClinicianProfile(), ...readStorage(STORAGE_KEYS.clinicianProfile, defaultClinicianProfile) };
}

function saveClinicianProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.clinicianProfile, JSON.stringify({
    ...defaultClinicianProfile(),
    ...profile
  }));
}

function getClinicianDraft() {
  return { ...defaultClinicianDraft(), ...readStorage(STORAGE_KEYS.clinicianDraft, defaultClinicianDraft) };
}

function saveClinicianDraft(draft) {
  localStorage.setItem(STORAGE_KEYS.clinicianDraft, JSON.stringify({
    ...defaultClinicianDraft(),
    ...draft
  }));
}

function clearClinicianDraft() {
  localStorage.removeItem(STORAGE_KEYS.clinicianDraft);
}

function getPatientsStore() {
  return readStorage(STORAGE_KEYS.patients, () => ({}));
}

function savePatientsStore(store) {
  localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(store));
}

function getAllPatientRecords() {
  return Object.values(getPatientsStore()).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function getPatientRecord(patientId) {
  if (!patientId) {
    return null;
  }

  const store = getPatientsStore();
  const record = store[patientId];
  if (!record) {
    return null;
  }

  return {
    ...defaultPatientRecord(patientId),
    ...record,
    progress: {
      ...defaultProgress(),
      ...(record.progress || {})
    }
  };
}

function savePatientRecord(record) {
  const store = getPatientsStore();
  store[record.patientId] = record;
  savePatientsStore(store);
}

function setActivePatientId(patientId) {
  if (patientId) {
    localStorage.setItem(STORAGE_KEYS.activePatientId, patientId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.activePatientId);
  }
}

function getActivePatientId() {
  return localStorage.getItem(STORAGE_KEYS.activePatientId) || "";
}

function clearActivePatientId() {
  localStorage.removeItem(STORAGE_KEYS.activePatientId);
}

function getActivePatientRecord() {
  return getPatientRecord(getActivePatientId());
}

function syncDraftFromActivePatient() {
  const activeRecord = getActivePatientRecord();
  if (activeRecord) {
    saveClinicianDraft({
      patientId: activeRecord.patientId,
      selectedCategories: activeRecord.selectedCategories,
      assignedItems: activeRecord.assignedItems,
      clinicianNotes: activeRecord.clinicianNotes
    });
    return;
  }

  clearClinicianDraft();
}

function normalizePatientId(value) {
  return value.trim().toUpperCase();
}

function generatePatientId() {
  const store = getPatientsStore();
  let patientId = "";

  do {
    patientId = `HND-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.random()
      .toString(36)
      .slice(2, 4)
      .toUpperCase()}`;
  } while (store[patientId]);

  return patientId;
}

function activatePatientById(patientId) {
  const normalizedId = normalizePatientId(patientId);
  const record = getPatientRecord(normalizedId);

  if (!record) {
    return null;
  }

  setActivePatientId(normalizedId);
  return record;
}

function getCategoryById(id) {
  return CATEGORY_DEFINITIONS.find((category) => category.id === id);
}

function getItemsForCategory(categoryId) {
  const category = getCategoryById(categoryId);
  if (!category) {
    return [];
  }

  return EXERCISE_LIBRARY.filter((item) => item.categoryKey === category.key);
}

function getAssignedCategories(patientId = getActivePatientId()) {
  const record = getPatientRecord(patientId);
  if (!record) {
    return [];
  }

  const selectedIds = new Set(record.selectedCategories);
  return CATEGORY_DEFINITIONS.filter((category) => selectedIds.has(category.id));
}

function getAssignedItems(patientId = getActivePatientId()) {
  const record = getPatientRecord(patientId);
  return record ? record.assignedItems : [];
}

function getAssignedItemsByCategory(patientId = getActivePatientId()) {
  const assignedByCategory = new Map();

  getAssignedItems(patientId).forEach((item) => {
    const existing = assignedByCategory.get(item.categoryKey) || [];
    existing.push(item);
    assignedByCategory.set(item.categoryKey, existing);
  });

  return CATEGORY_DEFINITIONS.filter((category) => assignedByCategory.has(category.key)).map((category) => ({
    ...category,
    assignedItems: assignedByCategory.get(category.key)
  }));
}

function hasAssignedPlan(patientId = getActivePatientId()) {
  return getAssignedItems(patientId).length > 0;
}

function saveClinicianPlan({ patientId, selectedCategories, assignedItems, clinicianNotes }) {
  const selectedCategorySet = new Set(selectedCategories);
  const normalizedItems = assignedItems.map((item) => ({
    ...item,
    daily_target_count: Math.max(1, Number(item.daily_target_count) || 1),
    patient_checkoff: false,
    adherence_timestamp: "",
    pain_before: item.pain_before || "",
    pain_after: item.pain_after || "",
    swelling_response: item.swelling_response || "",
    symptom_notes: item.symptom_notes || ""
  }));

  const recordId = patientId || generatePatientId();
  const existingRecord = getPatientRecord(recordId);
  const now = new Date().toISOString();

  const nextRecord = {
    ...(existingRecord || defaultPatientRecord(recordId)),
    patientId: recordId,
    selectedCategories: [...selectedCategorySet].sort((a, b) => a - b),
    assignedItems: normalizedItems,
    clinicianNotes: clinicianNotes || "",
    updatedAt: now,
    createdAt: existingRecord?.createdAt || now,
    progress: existingRecord?.progress || defaultProgress()
  };

  savePatientRecord(nextRecord);
  setActivePatientId(recordId);
  saveClinicianDraft({
    patientId: recordId,
    selectedCategories: nextRecord.selectedCategories,
    assignedItems: nextRecord.assignedItems,
    clinicianNotes: nextRecord.clinicianNotes
  });
  return nextRecord;
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayIsoDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPatientProgress(patientId = getActivePatientId()) {
  return getPatientRecord(patientId)?.progress || defaultProgress();
}

function getCompletedSessions(patientId = getActivePatientId()) {
  return getPatientProgress(patientId).completedSessions || 0;
}

function getStreakCount(patientId = getActivePatientId()) {
  return getPatientProgress(patientId).streakCount || 0;
}

function hasCompletedToday(patientId = getActivePatientId()) {
  return getPatientProgress(patientId).lastCompletedOn === getTodayIsoDate();
}

function getCurrentDayLabel(patientId = getActivePatientId()) {
  return `Day ${getCompletedSessions(patientId) + 1}`;
}

function getDailyItemLog(patientId = getActivePatientId(), date = getTodayIsoDate()) {
  const progress = getPatientProgress(patientId);
  return progress.dailyLogs[date] || {};
}

function updateDailyItemLog(itemId, patch, patientId = getActivePatientId(), date = getTodayIsoDate()) {
  const record = getPatientRecord(patientId);
  if (!record) {
    return;
  }

  const currentDay = record.progress.dailyLogs[date] || {};
  const currentItem = currentDay[itemId] || {};

  record.progress.dailyLogs[date] = {
    ...currentDay,
    [itemId]: {
      ...currentItem,
      ...patch
    }
  };

  record.updatedAt = new Date().toISOString();
  savePatientRecord(record);
}

function completeTodaySession(patientId = getActivePatientId()) {
  const record = getPatientRecord(patientId);
  if (!record) {
    return defaultProgress();
  }

  const today = getTodayIsoDate();

  if (record.progress.lastCompletedOn === today) {
    return record.progress;
  }

  const nextStreak =
    record.progress.lastCompletedOn === getYesterdayIsoDate() ? (record.progress.streakCount || 0) + 1 : 1;

  record.progress = {
    ...record.progress,
    completedSessions: (record.progress.completedSessions || 0) + 1,
    streakCount: nextStreak,
    lastCompletedOn: today,
    dailyLogs: {
      ...record.progress.dailyLogs,
      [today]: {
        ...(record.progress.dailyLogs[today] || {}),
        sessionCompletedAt: new Date().toISOString()
      }
    }
  };

  record.updatedAt = new Date().toISOString();
  savePatientRecord(record);
  return record.progress;
}

function getPatientDashboard(patientId = getActivePatientId()) {
  const record = getPatientRecord(patientId);
  return {
    patientId,
    title: "Assigned hand recovery plan",
    dayLabel: getCurrentDayLabel(patientId),
    categories: getAssignedCategories(patientId),
    groupedItems: getAssignedItemsByCategory(patientId),
    clinicianNotes: record?.clinicianNotes || ""
  };
}

function getHomeScreenState() {
  const activePatientId = getActivePatientId();
  const activePatient = getPatientRecord(activePatientId);

  if (!activePatient) {
    return {
      statusLabel: "No patient loaded",
      dayLabel: "Waiting for patient ID",
      patientButtonLabel: "Enter patient ID",
      patientButtonHref: "./patient-access.html",
      patientButtonDisabled: false
    };
  }

  if (hasCompletedToday(activePatientId)) {
    return {
      statusLabel: `${activePatient.patientId} is all done for the day`,
      dayLabel: getCurrentDayLabel(activePatientId),
      patientButtonLabel: "Enter patient ID",
      patientButtonHref: "./patient-access.html",
      patientButtonDisabled: false
    };
  }

  return {
    statusLabel: `${activePatient.patientId}: ${getCompletedSessions(activePatientId)} sessions completed`,
    dayLabel: getCurrentDayLabel(activePatientId),
    patientButtonLabel: "Enter patient ID",
    patientButtonHref: "./patient-access.html",
    patientButtonDisabled: false
  };
}

function getRecentDates(days = 7) {
  const dates = [];
  const now = new Date();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

function summarizeDayMetrics(dayLog, totalItems) {
  const entries = Object.entries(dayLog).filter(([key]) => key !== "sessionCompletedAt");
  const checkedCount = entries.filter(([, value]) => value.patient_checkoff).length;
  const painBeforeValues = entries.map(([, value]) => Number(value.pain_before)).filter((value) => !Number.isNaN(value));
  const painAfterValues = entries.map(([, value]) => Number(value.pain_after)).filter((value) => !Number.isNaN(value));

  return {
    completionPercent: totalItems ? Math.round((checkedCount / totalItems) * 100) : 0,
    avgPainBefore: painBeforeValues.length
      ? (painBeforeValues.reduce((sum, value) => sum + value, 0) / painBeforeValues.length).toFixed(1)
      : "",
    avgPainAfter: painAfterValues.length
      ? (painAfterValues.reduce((sum, value) => sum + value, 0) / painAfterValues.length).toFixed(1)
      : "",
    checkedCount
  };
}

function getPatientTrendData(patientId = getActivePatientId()) {
  const record = getPatientRecord(patientId);
  if (!record) {
    return [];
  }

  const totalItems = record.assignedItems.length;
  const dates = getRecentDates(7);

  return dates.map((date) => {
    const dayLog = record.progress.dailyLogs[date] || {};
    return {
      date,
      ...summarizeDayMetrics(dayLog, totalItems)
    };
  });
}

function resetAllData() {
  localStorage.removeItem(STORAGE_KEYS.patients);
  localStorage.removeItem(STORAGE_KEYS.activePatientId);
  localStorage.removeItem(STORAGE_KEYS.clinicianProfile);
  localStorage.removeItem(STORAGE_KEYS.clinicianDraft);
}
