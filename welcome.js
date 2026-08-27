const roleButtons = document.querySelectorAll("[data-role]");
const sheetOverlay = document.querySelector("#welcome-sheet-overlay");
const sheetPill = document.querySelector("#sheet-pill");
const sheetTitle = document.querySelector("#sheet-title");
const sheetCopy = document.querySelector("#sheet-copy");
const sheetBackButton = document.querySelector("#sheet-back-button");
const sheetContinueButton = document.querySelector("#sheet-continue-button");

const ROLE_FLOW = {
  clinician: {
    pill: "Clinician",
    title: "Clinician access",
    copy: "Create patient IDs, assign hand recovery exercises, and review adherence and symptom trends.",
    href: "./clinician-signin.html"
  },
  patient: {
    pill: "Patient",
    title: "Patient access",
    copy: "Use the patient ID provided by your clinician to activate or sign in to your assigned hand recovery program.",
    href: "./patient-access.html"
  }
};

let selectedRole = "";

function openSheet(role) {
  const config = ROLE_FLOW[role];
  if (!config) {
    return;
  }

  selectedRole = role;
  sheetPill.classList.toggle("sheet-pill-patient", role === "patient");
  sheetPill.textContent = config.pill;
  sheetTitle.textContent = config.title;
  sheetCopy.textContent = config.copy;
  sheetContinueButton.textContent = role === "clinician" ? "Go to clinician access" : "Go to patient access";
  sheetOverlay.classList.remove("hidden");
  window.requestAnimationFrame(() => {
    sheetOverlay.classList.add("is-visible");
  });
}

function closeSheet() {
  sheetOverlay.classList.remove("is-visible");
  window.setTimeout(() => {
    sheetOverlay.classList.add("hidden");
  }, 240);
}

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const role = button.dataset.role;
    if (role === "patient" && getActivePatientId()) {
      window.location.href = "./progress.html";
      return;
    }
    if (role === "clinician" && getCurrentClinicianId()) {
      window.location.href = "./select.html";
      return;
    }
    openSheet(role);
  });
});

sheetBackButton.addEventListener("click", () => {
  closeSheet();
});

sheetOverlay.addEventListener("click", (event) => {
  if (event.target === sheetOverlay) {
    closeSheet();
  }
});

sheetContinueButton.addEventListener("click", () => {
  const config = ROLE_FLOW[selectedRole];
  if (!config) {
    return;
  }

  window.location.href = config.href;
});
