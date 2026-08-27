const CATEGORY_DEFINITIONS = [
  {
    id: 1,
    key: "wrist-stretches",
    title: "Wrist Stretches",
    description: "AAOS carpal tunnel stretches used to reduce wrist and forearm tightness before activity and throughout the day.",
    lockedNotice: "Assign only exercises selected or approved by the treating clinician or physical therapist.",
    items: [
      { name: "Wrist Extension Stretch", frequency: "5 to 7 days per week", dose: "5 reps, 4x a day • hold 15 seconds" },
      { name: "Wrist Flexion Stretch", frequency: "5 to 7 days per week", dose: "5 reps, 4x a day • hold 15 seconds" }
    ]
  },
  {
    id: 2,
    key: "median-nerve-glides",
    title: "Median Nerve Glides",
    description: "Median nerve mobility drills from the AAOS carpal tunnel guide.",
    lockedNotice: "Use these only as prescribed and stop if numbness or tingling becomes uncomfortable.",
    items: [
      { name: "Median Nerve Glides", frequency: "6 to 7 days per week", dose: "10 to 15 reps a day • hold each position 3 to 7 seconds" }
    ]
  },
  {
    id: 3,
    key: "tendon-glides",
    title: "Tendon Glides",
    description: "Tendon glide sequences that support joint motion and hand function in carpal tunnel recovery.",
    lockedNotice: "Progress repetitions only as tolerated and only within the clinician-approved plan.",
    items: [
      { name: "Tendon Glides Series A", frequency: "5 to 7 days per week", dose: "5 to 10 reps, 2 to 3x a day • hold each position 3 seconds" },
      { name: "Tendon Glides Series B", frequency: "5 to 7 days per week", dose: "5 to 10 reps, 2 to 3x a day • hold each position 3 seconds" }
    ]
  }
];

const LOCKED_CATEGORY_KEYS = new Set([]);

const STORAGE_KEYS = {
  patients: "orthoHandRecoveryPatients",
  activePatientId: "orthoHandRecoveryActivePatientId",
  clinicianProfile: "orthoHandRecoveryClinicianProfile",
  clinicianDraft: "orthoHandRecoveryClinicianDraft"
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

function parseWeeklyFrequency(value) {
  const text = `${value || ""}`.trim().toLowerCase();
  if (text === "daily") {
    return { minimum: 7, maximum: 7 };
  }

  const range = text.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*days?\s*per\s*week/);
  if (range) {
    return { minimum: Number(range[1]), maximum: Number(range[2]) };
  }

  const exact = text.match(/(\d+)\s*days?\s*per\s*week/);
  if (exact) {
    const days = Number(exact[1]);
    return { minimum: days, maximum: days };
  }

  return { minimum: 1, maximum: 1 };
}

const HOW_TO_BY_EXERCISE_ID = {
  "wrist-stretches-wrist-extension-stretch": {
    steps: [
      "Straighten your arm and bend your wrist back as if signaling someone to stop.",
      "Use your opposite hand to apply gentle pressure across the palm and pull it toward you until you feel a stretch on the inside of your forearm.",
      "Hold the stretch for 15 seconds.",
      "Repeat 5 times, then perform the stretch on the other arm."
    ],
    tip: "Do not lock your elbow."
  },
  "wrist-stretches-wrist-flexion-stretch": {
    steps: [
      "Straighten your arm with your palm facing down and bend your wrist so your fingers point down.",
      "Gently pull your hand toward your body until you feel a stretch on the outside of your forearm.",
      "Hold the stretch for 15 seconds.",
      "Repeat 5 times, then perform the stretch on the other arm."
    ],
    tip: "Do not lock your elbow. Stop if numbness becomes uncomfortable."
  },
  "median-nerve-glides-median-nerve-glides": {
    steps: [
      "Make a fist with your thumb outside your fingers.",
      "Extend your fingers while keeping your thumb close to the side of your hand.",
      "Keep your fingers straight and extend your wrist backward.",
      "Keep your fingers and wrist in position and extend your thumb.",
      "Keep your fingers, wrist, and thumb extended and turn your forearm palm up.",
      "Keep everything extended and use your other hand to gently stretch the thumb."
    ],
    tip: "Do not put too much pressure on your thumb in the final position."
  },
  "tendon-glides-tendon-glides-series-a": {
    steps: [
      "With your hand in front of you and your wrist straight, fully straighten all of your fingers.",
      "Bend the tips of your fingers into the hook position with your knuckles pointing up.",
      "Make a tight fist with your thumb over your fingers."
    ],
    tip: "Proceed through the sequence in order and hold each position for 3 seconds."
  },
  "tendon-glides-tendon-glides-series-b": {
    steps: [
      "With your hand in front of you and your wrist straight, fully straighten all of your fingers.",
      "Make a tabletop with your fingers by bending at your bottom knuckle while keeping the fingers straight.",
      "Bend your fingers at the middle joint, touching your fingers to your palm."
    ],
    tip: "These movements may cause a gentle pulling sensation, but should not increase pain."
  }
};

function getWeekDates(referenceDate = new Date()) {
  const date = new Date(referenceDate);
  const dayFromMonday = (date.getDay() + 6) % 7;
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - dayFromMonday);

  return Array.from({ length: 7 }, (_, offset) => {
    const current = new Date(date);
    current.setDate(date.getDate() + offset);
    const year = current.getFullYear();
    const month = `${current.getMonth() + 1}`.padStart(2, "0");
    const day = `${current.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
}

function getWeeklyExerciseCompletion(record, itemId) {
  const logs = record?.progress?.dailyLogs || {};
  return getWeekDates().filter((date) => {
    const entry = logs[date]?.[itemId] || {};
    return Boolean(entry.patient_checkoff);
  }).length;
}

function makeLibraryItem(category, name) {
  const definition = typeof name === "string" ? { name } : name;
  name = definition.name;
  const lowerName = name.toLowerCase();
  const requiresPrescription =
    category.key === "median-nerve-glides" ||
    lowerName.includes("nerve glide");

  const contraindicationWarning =
    category.key === "median-nerve-glides"
      ? "Stop if symptoms worsen, become sharp, or create persistent numbness or tingling."
      : "Use only within the clinician-approved hand recovery plan.";

  const painStopRule =
    "Stop and contact the doctor or physical therapist if pain or numbness increases while exercising.";

  const defaultFrequency = definition.frequency || "As assigned";
  const defaultDose = definition.dose || "As assigned";
  const itemId = `${category.key}-${slugify(name)}`;
  const howTo = HOW_TO_BY_EXERCISE_ID[itemId] || { steps: [], tip: "" };
  const imagePathById = {
    "wrist-stretches-wrist-extension-stretch": "./assets/exercises/wrist-extension-stretch.png",
    "wrist-stretches-wrist-flexion-stretch": "./assets/exercises/wrist-flexion-stretch.png",
    "median-nerve-glides-median-nerve-glides": "./assets/exercises/median-nerve-glides.png",
    "tendon-glides-tendon-glides-series-a": "./assets/exercises/tendon-glides-series-a.png",
    "tendon-glides-tendon-glides-series-b": "./assets/exercises/tendon-glides-series-b.png"
  };

  return {
    id: itemId,
    category: category.title,
    categoryKey: category.key,
    name,
    patient_friendly_description: `${name} is an AAOS carpal tunnel exercise selected by your clinician or physical therapist.`,
    default_frequency: defaultFrequency,
    default_sets_reps_duration: defaultDose,
    image_path: imagePathById[itemId] || "",
    how_to_steps: howTo.steps,
    how_to_tip: howTo.tip,
    daily_target_count: 1,
    requires_prescription: requiresPrescription,
    contraindication_warning: contraindicationWarning,
    pain_stop_rule: painStopRule,
    progression_notes: "Continue only for the duration and frequency approved by the treating clinician or physical therapist.",
    therapist_notes: "",
    patient_checkoff: false,
    adherence_timestamp: "",
    pain_before: "",
    pain_after: "",
    stiffness_after: "",
    swelling_response: "",
    symptom_notes: ""
  };
}

const EXERCISE_LIBRARY = CATEGORY_DEFINITIONS.flatMap((category) =>
  category.items.map((name) => makeLibraryItem(category, name))
);

function findLibraryItemForAssignedItem(item) {
  if (!item) {
    return null;
  }

  const normalizedId = `${item.id || ""}`.trim();
  if (normalizedId) {
    const idMatch = EXERCISE_LIBRARY.find((exercise) => exercise.id === normalizedId);
    if (idMatch) {
      return idMatch;
    }
  }

  const normalizedName = `${item.name || ""}`.trim().toLowerCase();
  const normalizedCategoryKey = `${item.categoryKey || ""}`.trim().toLowerCase();
  const normalizedCategory = `${item.category || ""}`.trim().toLowerCase();

  return EXERCISE_LIBRARY.find((exercise) => {
    const exerciseName = `${exercise.name || ""}`.trim().toLowerCase();
    const exerciseCategoryKey = `${exercise.categoryKey || ""}`.trim().toLowerCase();
    const exerciseCategory = `${exercise.category || ""}`.trim().toLowerCase();
    return (
      normalizedName &&
      exerciseName === normalizedName &&
      (
        (normalizedCategoryKey && exerciseCategoryKey === normalizedCategoryKey) ||
        (normalizedCategory && exerciseCategory === normalizedCategory) ||
        (!normalizedCategoryKey && !normalizedCategory)
      )
    );
  }) || null;
}

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
  const prefix = "HND";

  do {
    patientId = `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase().padEnd(5, "X")}`;
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
    stiffness_after: item.stiffness_after || "",
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
  const stiffnessValues = entries.map(([, value]) => Number(value.stiffness_after)).filter((value) => !Number.isNaN(value));

  return {
    completionPercent: totalItems ? Math.round((checkedCount / totalItems) * 100) : 0,
    avgPainBefore: painBeforeValues.length
      ? (painBeforeValues.reduce((sum, value) => sum + value, 0) / painBeforeValues.length).toFixed(1)
      : "",
    avgPainAfter: painAfterValues.length
      ? (painAfterValues.reduce((sum, value) => sum + value, 0) / painAfterValues.length).toFixed(1)
      : "",
    avgStiffness: stiffnessValues.length
      ? (stiffnessValues.reduce((sum, value) => sum + value, 0) / stiffnessValues.length).toFixed(1)
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
