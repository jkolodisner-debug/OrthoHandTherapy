const patientAccessForm = document.querySelector("#patient-access-form");
const patientEmailInput = document.querySelector("#patient-email-input");
const patientPasswordInput = document.querySelector("#patient-password-input");
const patientAccessMessage = document.querySelector("#patient-access-message");
const patientRemember = document.querySelector("#patient-remember");

const rememberedPatientEmail = getRememberedPatientEmail();
patientRemember.checked = Boolean(rememberedPatientEmail);
patientEmailInput.value = rememberedPatientEmail;

if (getActivePatientId()) {
  window.location.replace("./patient-portal.html");
}

patientAccessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = patientAccessForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  patientAccessMessage.textContent = "Signing in…";
  try {
    await apiSignInPatient({
      email: patientEmailInput.value.trim().toLowerCase(),
      password: patientPasswordInput.value,
      rememberOnDevice: patientRemember.checked
    });
    window.location.href = "./patient-portal.html";
  } catch (error) {
    patientAccessMessage.textContent = error.message;
    submitButton.disabled = false;
  }
});
