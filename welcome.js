const roleButtons = document.querySelectorAll(".intro-role-button");
const sheetOverlay = document.querySelector("#welcome-sheet-overlay");
const sheetPill = document.querySelector("#sheet-pill");
const sheetTitle = document.querySelector("#sheet-title");
const sheetCopy = document.querySelector("#sheet-copy");
const sheetBackButton = document.querySelector("#sheet-back-button");
const sheetContinueButton = document.querySelector("#sheet-continue-button");

const ROLE_FLOW = {
  clinician: {
    pill: "Clinician",
    title: "Clinician warning",
    copy: "Only create or edit plans that have been prescribed or approved for the patient. This app tracks assigned care and does not replace clinical judgment.",
    href: "./clinician-auth.html"
  },
  patient: {
    pill: "Patient",
    title: "Patient warning",
    copy: "Only complete the exercises and tasks given to you by your treating clinician. Stop and contact them if pain, numbness, swelling, or other symptoms worsen.",
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
    openSheet(button.dataset.role);
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
