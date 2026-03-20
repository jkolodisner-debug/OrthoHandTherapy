const RECOVERY_PLANS = {
  shoulder: {
    name: "Shoulder",
    subtitle: "Rotator cuff and post-op shoulder recovery",
    image:
      '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="shoulderGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1d7a63"/><stop offset="100%" stop-color="#ea9d52"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#shoulderGrad)"/><circle cx="60" cy="28" r="13" fill="#fff8ef"/><path d="M60 43c-10 0-18 8-18 18v11h10V61a8 8 0 0 1 16 0v11h10V61c0-10-8-18-18-18Z" fill="#fff8ef"/><path d="M42 62c-10 3-16 10-18 19" stroke="#f35f5f" stroke-width="6" stroke-linecap="round"/><path d="M78 62c10 3 16 10 18 19" stroke="#fff2df" stroke-width="6" stroke-linecap="round"/></svg>',
    streak: 6,
    completedSessions: 14,
    totalSessions: 21,
    todayLabel: "Day 7",
    todayFocus: "Regain comfortable overhead motion and shoulder control.",
    exercises: [
      {
        name: "Table slides",
        dosage: "3 sets x 8 reps",
        tip: "Slide only to a gentle stretch and pause for one breath."
      },
      {
        name: "Scapular squeezes",
        dosage: "2 sets x 10 reps",
        tip: "Keep the neck relaxed while the shoulder blades move."
      },
      {
        name: "Isometric external rotation",
        dosage: "3 sets x 5 holds",
        tip: "Press lightly into a towel without twisting."
      }
    ]
  },
  knee: {
    name: "Knee",
    subtitle: "ACL, meniscus, and total knee progression",
    image:
      '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="kneeGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1d7a63"/><stop offset="100%" stop-color="#ea9d52"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#kneeGrad)"/><circle cx="60" cy="22" r="12" fill="#fff8ef"/><rect x="51" y="35" width="18" height="28" rx="9" fill="#fff8ef"/><path d="M57 63 48 88" stroke="#fff8ef" stroke-width="8" stroke-linecap="round"/><path d="M64 63 76 87" stroke="#f35f5f" stroke-width="8" stroke-linecap="round"/><circle cx="67" cy="69" r="8" fill="#fff2df" stroke="#f35f5f" stroke-width="4"/></svg>',
    streak: 9,
    completedSessions: 18,
    totalSessions: 24,
    todayLabel: "Day 10",
    todayFocus: "Improve knee extension, walking rhythm, and quad activation.",
    exercises: [
      {
        name: "Heel prop extension hold",
        dosage: "3 sets x 45 sec",
        tip: "Let the leg relax fully so the knee can straighten."
      },
      {
        name: "Quad sets",
        dosage: "3 sets x 10 reps",
        tip: "Tighten the thigh and hold each rep for 3 seconds."
      },
      {
        name: "Mini sit-to-stands",
        dosage: "3 sets x 8 reps",
        tip: "Push evenly through both feet and stay controlled."
      }
    ]
  },
  hip: {
    name: "Hip",
    subtitle: "Hip replacement and hip repair support",
    image:
      '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="hipGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1d7a63"/><stop offset="100%" stop-color="#ea9d52"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#hipGrad)"/><circle cx="60" cy="23" r="12" fill="#fff8ef"/><rect x="50" y="36" width="20" height="30" rx="10" fill="#fff8ef"/><path d="M50 64 41 89" stroke="#fff8ef" stroke-width="8" stroke-linecap="round"/><path d="M70 64 79 89" stroke="#fff8ef" stroke-width="8" stroke-linecap="round"/><circle cx="48" cy="67" r="7" fill="#fff2df" stroke="#f35f5f" stroke-width="4"/></svg>',
    streak: 4,
    completedSessions: 11,
    totalSessions: 20,
    todayLabel: "Day 5",
    todayFocus: "Build confidence with transfers, glute activation, and walking.",
    exercises: [
      {
        name: "Glute sets",
        dosage: "3 sets x 10 reps",
        tip: "Squeeze the glutes without arching the low back."
      },
      {
        name: "Supported weight shifts",
        dosage: "2 sets x 12 reps",
        tip: "Use a counter and move side to side slowly."
      },
      {
        name: "Sit-to-stand practice",
        dosage: "3 sets x 6 reps",
        tip: "Bring your nose forward, then stand tall."
      }
    ]
  },
  ankle: {
    name: "Ankle & Foot",
    subtitle: "Ankle ORIF, Achilles, and foot recovery",
    image:
      '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="ankleGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1d7a63"/><stop offset="100%" stop-color="#ea9d52"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#ankleGrad)"/><circle cx="60" cy="20" r="11" fill="#fff8ef"/><rect x="51" y="32" width="18" height="26" rx="9" fill="#fff8ef"/><path d="M56 58 50 86" stroke="#fff8ef" stroke-width="8" stroke-linecap="round"/><path d="M66 58 64 83" stroke="#fff8ef" stroke-width="8" stroke-linecap="round"/><path d="M64 83c9 0 15 2 22 7" stroke="#f35f5f" stroke-width="6" stroke-linecap="round"/></svg>',
    streak: 7,
    completedSessions: 13,
    totalSessions: 18,
    todayLabel: "Day 8",
    todayFocus: "Reduce stiffness and improve calf strength and balance.",
    exercises: [
      {
        name: "Ankle pumps",
        dosage: "3 sets x 20 reps",
        tip: "Move slowly through up-and-down motion."
      },
      {
        name: "Heel raises",
        dosage: "2 sets x 10 reps",
        tip: "Use support and rise only as tolerated."
      },
      {
        name: "Weight-bearing shifts",
        dosage: "2 sets x 12 reps",
        tip: "Spread pressure evenly through the foot."
      }
    ]
  }
};

const STORAGE_KEYS = {
  user: "orthoMotionUser",
  selectedPlan: "orthoMotionSelectedPlan"
};

const API_BASE = "";

function saveUser(user) {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  if (user?.selectedPlan) {
    localStorage.setItem(STORAGE_KEYS.selectedPlan, user.selectedPlan);
  }
}

function getUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSelectedPlan(planId) {
  localStorage.setItem(STORAGE_KEYS.selectedPlan, planId);
}

function clearUser() {
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.selectedPlan);
}

function getSelectedPlan() {
  return localStorage.getItem(STORAGE_KEYS.selectedPlan) || "knee";
}

function markTodayComplete(isComplete) {
  const user = getUser();
  if (!user) {
    return;
  }

  saveUser({
    ...user,
    completedToday: isComplete
  });
}

function getCurrentPlan() {
  return RECOVERY_PLANS[getSelectedPlan()] || RECOVERY_PLANS.knee;
}

function getUserName() {
  return getUser()?.name || "";
}

function goHome() {
  window.location.href = "./index.html";
}

function goBack(fallback = "./index.html") {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = fallback;
}

function getUserPlan() {
  return getUser()?.selectedPlan || getSelectedPlan();
}

function getCurrentUserPlan() {
  const basePlan = RECOVERY_PLANS[getUserPlan()] || RECOVERY_PLANS.knee;
  return {
    ...basePlan,
    todayLabel: `Day ${getCompletedSessions() + 1}`
  };
}

function getCompletedSessions() {
  return getUser()?.completedSessions || 0;
}

function getStreakCount() {
  return getUser()?.streakCount || 0;
}

function hasCompletedToday() {
  return Boolean(getUser()?.completedToday);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

async function signUpUser(payload) {
  return apiRequest("/api/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function signInUser(payload) {
  return apiRequest("/api/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function savePlanSelection(userId, planId) {
  return apiRequest("/api/select-plan", {
    method: "POST",
    body: JSON.stringify({ userId, planId })
  });
}

async function saveCompletedSession(userId) {
  return apiRequest("/api/complete-session", {
    method: "POST",
    body: JSON.stringify({ userId })
  });
}
