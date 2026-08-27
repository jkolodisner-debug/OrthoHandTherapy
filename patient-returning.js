const patientAccessForm = document.querySelector("#patient-access-form");
const patientIdInput = document.querySelector("#patient-id-input");
const patientPasswordInput = document.querySelector("#patient-password-input");
const patientAccessMessage = document.querySelector("#patient-access-message");
const patientRemember = document.querySelector("#patient-remember");

const rememberedPatientId = getRememberedPatientId();
patientRemember.checked = Boolean(rememberedPatientId);
patientIdInput.value = rememberedPatientId;

if (getActivePatientId()) {
  window.location.replace("./progress.html");
}

patientAccessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = patientAccessForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  patientAccessMessage.textContent = "Signing in…";
  try {
    await apiSignInPatient({
      patientId: patientIdInput.value.trim().toUpperCase(),
      password: patientPasswordInput.value,
      rememberOnDevice: patientRemember.checked
    });
    window.location.href = "./progress.html";
  } catch (error) {
    patientAccessMessage.textContent = error.message;
    submitButton.disabled = false;
  }
});
