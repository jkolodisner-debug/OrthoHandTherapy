const streakCount = document.querySelector("#streak-count");
const completedCount = document.querySelector("#completed-count");
const progressFill = document.querySelector("#progress-fill");
const dayLabel = document.querySelector("#day-label");
const selectedCategoryList = document.querySelector("#selected-category-list");
const assignedItemList = document.querySelector("#assigned-item-list");
const clinicianNotesPanel = document.querySelector("#clinician-notes-panel");
const clinicianNotesText = document.querySelector("#clinician-notes-text");
const continueButton = document.querySelector("#continue-button");
const patientSafetyList = document.querySelector("#patient-safety-list");
const patientIntro = document.querySelector("#patient-intro");
const patientCode = document.querySelector("#patient-code");

if (!hasAssignedPlan()) {
  patientIntro.textContent = "Enter a patient ID first so the assigned plan can load for this patient.";
  continueButton.textContent = "Enter patient ID";
  continueButton.href = "./patient-access.html";
} else {
  const dashboard = getPatientDashboard();
  const completed = getCompletedSessions();
  const percent = Math.min(100, Math.round((completed / 30) * 100));

  patientCode.textContent = dashboard.patientId;
  streakCount.textContent = `${getStreakCount()} days`;
  completedCount.textContent = `${completed}`;
  dayLabel.textContent = dashboard.dayLabel;
  progressFill.style.width = `${percent}%`;

  dashboard.categories.forEach((category) => {
    const item = document.createElement("li");
    item.textContent = `${category.id}. ${category.title}`;
    selectedCategoryList.appendChild(item);
  });

  dashboard.groupedItems.forEach((group) => {
    const item = document.createElement("li");
    item.textContent = `${group.title}: ${group.assignedItems.length} assigned`;
    assignedItemList.appendChild(item);
  });

  if (dashboard.clinicianNotes) {
    clinicianNotesText.textContent = dashboard.clinicianNotes;
  } else {
    clinicianNotesPanel.classList.add("hidden");
  }
} 

if (!getActivePatientId()) {
  patientCode.textContent = "Not loaded";
}

GLOBAL_SAFETY_RULES.forEach((rule) => {
  const item = document.createElement("li");
  item.textContent = rule;
  patientSafetyList.appendChild(item);
});
