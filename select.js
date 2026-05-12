const newPatientLink = document.querySelector("#new-patient-link");
const trackPatientForm = document.querySelector("#track-patient-form");
const trackPatientId = document.querySelector("#track-patient-id");
const trackMessage = document.querySelector("#track-message");

newPatientLink.addEventListener("click", () => {
  clearActivePatientId();
  clearClinicianDraft();
});

trackPatientForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const record = activatePatientById(trackPatientId.value);

  if (!record) {
    trackMessage.textContent = "That patient ID was not found on this device.";
    return;
  }

  syncDraftFromActivePatient();
  trackMessage.textContent = "";
  window.location.href = "./clinician-status.html";
});
