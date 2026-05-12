const patientAccessForm = document.querySelector("#patient-access-form");
const patientIdInput = document.querySelector("#patient-id-input");
const patientAccessMessage = document.querySelector("#patient-access-message");
const patientRemember = document.querySelector("#patient-remember");

const rememberedPatientId = getRememberedPatientId();

patientRemember.checked = Boolean(rememberedPatientId);
patientIdInput.value = rememberedPatientId || getActivePatientId();

patientAccessForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  patientAccessMessage.textContent = "Loading patient plan...";

  try {
    await apiFetchPatientRecordWithPreference(patientIdInput.value, patientRemember.checked);

    if (patientRemember.checked) {
      saveRememberedPatientId(patientIdInput.value.trim().toUpperCase());
    } else {
      saveRememberedPatientId("");
    }

    patientAccessMessage.textContent = "";
    window.location.href = "./progress.html";
  } catch (error) {
    patientAccessMessage.textContent = error.message;
  }
});
