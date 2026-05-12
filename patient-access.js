const patientAccessForm = document.querySelector("#patient-access-form");
const patientIdInput = document.querySelector("#patient-id-input");
const patientAccessMessage = document.querySelector("#patient-access-message");

patientAccessForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  patientAccessMessage.textContent = "Loading patient plan...";

  try {
    await apiFetchPatientRecord(patientIdInput.value);
    patientAccessMessage.textContent = "";
    window.location.href = "./progress.html";
  } catch (error) {
    patientAccessMessage.textContent = error.message;
  }
});
