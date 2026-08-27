const patientCode = document.querySelector("#patient-code");
const openDailyChecklist = document.querySelector("#open-daily-checklist");
const openCurrentProgress = document.querySelector("#open-current-progress");
const patientSignOut = document.querySelector("#patient-sign-out");

patientSignOut.addEventListener("click", () => {
  signOutPatientSession();
  window.location.href = "./index.html";
});

async function renderPatientPortal() {
  let activeRecord = getActivePatientRecord();
  if (!activeRecord && getActivePatientId()) {
    activeRecord = await refreshActivePatientRecord();
  }

  if (!hasAssignedPlan(activeRecord)) {
    patientCode.textContent = "Not loaded";
    openDailyChecklist.textContent = "Enter patient ID";
    openDailyChecklist.href = "./patient-access.html";
    openCurrentProgress.classList.add("is-disabled");
    return;
  }

  patientCode.textContent = activeRecord.patientId;
}

renderPatientPortal().catch(() => {
  window.location.href = "./patient-access.html";
});
