const streakCount = document.querySelector("#streak-count");
const completedCount = document.querySelector("#completed-count");
const clinicianNotesPanel = document.querySelector("#clinician-notes-panel");
const clinicianNotesText = document.querySelector("#clinician-notes-text");
const continueButton = document.querySelector("#continue-button");
const patientIntro = document.querySelector("#patient-intro");
const patientCode = document.querySelector("#patient-code");
const programWeek = document.querySelector("#program-week");
const completedWeeks = document.querySelector("#completed-weeks");
const patientSignOut = document.querySelector("#patient-sign-out");

patientSignOut.addEventListener("click", () => {
  signOutPatientSession();
  window.location.href = "./index.html";
});

async function renderProgress() {
  let activeRecord = getActivePatientRecord();
  if (!activeRecord && getActivePatientId()) {
    activeRecord = await refreshActivePatientRecord();
  }

  if (!hasAssignedPlan(activeRecord)) {
    patientIntro.textContent = "Enter a patient ID first so the assigned plan can load for this patient.";
    continueButton.textContent = "Enter patient ID";
    continueButton.href = "./patient-access.html";
    patientCode.textContent = "Not loaded";
    return;
  }

  const dashboard = getPatientDashboard(activeRecord);
  const completed = getCompletedSessions(activeRecord);
  patientCode.textContent = dashboard.patientId;
  streakCount.textContent = `${getStreakCount(activeRecord)} days`;
  completedCount.textContent = `${completed}`;
  programWeek.textContent = `Week ${getProgramWeek(activeRecord)}`;
  completedWeeks.textContent = `${getCompletedWeekCount(activeRecord)}`;

  if (dashboard.clinicianNotes) {
    clinicianNotesText.textContent = dashboard.clinicianNotes;
  } else {
    clinicianNotesPanel.classList.add("hidden");
  }
}

renderProgress().catch(() => {
  patientIntro.textContent = "Enter a patient ID first so the assigned plan can load for this patient.";
  continueButton.textContent = "Enter patient ID";
  continueButton.href = "./patient-access.html";
  patientCode.textContent = "Not loaded";
});
