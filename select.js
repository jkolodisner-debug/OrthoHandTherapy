const newPatientLink = document.querySelector("#new-patient-link");
const trackPatientForm = document.querySelector("#track-patient-form");
const trackPatientId = document.querySelector("#track-patient-id");
const trackMessage = document.querySelector("#track-message");

newPatientLink.addEventListener("click", () => {
  clearActivePatientId();
  clearActivePatientRecord();
  clearClinicianDraft();
});

trackPatientForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await apiFetchPatientRecord(trackPatientId.value);
    syncDraftFromActivePatient();
    trackMessage.textContent = "";
    window.location.href = "./clinician-status.html";
  } catch (error) {
    trackMessage.textContent = error.message;
  }
});
