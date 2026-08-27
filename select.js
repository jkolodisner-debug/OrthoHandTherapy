const trackPatientForm = document.querySelector("#track-patient-form");
const trackPatientId = document.querySelector("#track-patient-id");
const trackMessage = document.querySelector("#track-message");
const clinicianSignOut = document.querySelector("#clinician-sign-out");

if (!getCurrentClinicianId()) {
  window.location.replace("./clinician-signin.html");
}

clinicianSignOut.addEventListener("click", () => {
  clearClinicianSession();
  clearActivePatientId();
  clearActivePatientRecord();
  window.location.href = "./index.html";
});

trackPatientForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await apiFetchClinicianPatientRecord(trackPatientId.value);
    trackMessage.textContent = "";
    window.location.href = "./clinician-status.html";
  } catch (error) {
    trackMessage.textContent = error.message;
  }
});
