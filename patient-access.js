const patientAccessForm = document.querySelector("#patient-access-form");
const patientIdInput = document.querySelector("#patient-id-input");
const patientAccessMessage = document.querySelector("#patient-access-message");

patientAccessForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const record = activatePatientById(patientIdInput.value);
  if (!record) {
    patientAccessMessage.textContent = "We couldn't find that patient ID on this device yet. Double-check the code from the clinician.";
    return;
  }

  patientAccessMessage.textContent = "";
  window.location.href = "./progress.html";
});
