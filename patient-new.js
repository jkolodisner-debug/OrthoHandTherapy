const patientActivationForm = document.querySelector("#patient-activation-form");
const activationPatientId = document.querySelector("#activation-patient-id");
const activationEmail = document.querySelector("#activation-email");
const activationPassword = document.querySelector("#activation-password");
const activationPasswordConfirm = document.querySelector("#activation-password-confirm");
const activationRemember = document.querySelector("#activation-remember");
const patientAccessMessage = document.querySelector("#patient-access-message");

activationEmail.value = getRememberedPatientEmail();

patientActivationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (activationPassword.value.length < 8) {
    patientAccessMessage.textContent = "Use at least 8 characters for your password.";
    return;
  }
  if (activationPassword.value !== activationPasswordConfirm.value) {
    patientAccessMessage.textContent = "The passwords do not match.";
    return;
  }

  const submitButton = patientActivationForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  patientAccessMessage.textContent = "Activating your assigned program…";
  try {
    await apiActivatePatient({
      patientId: activationPatientId.value.trim().toUpperCase(),
      email: activationEmail.value.trim().toLowerCase(),
      password: activationPassword.value,
      rememberOnDevice: activationRemember.checked
    });
    window.location.href = "./progress.html";
  } catch (error) {
    patientAccessMessage.textContent = error.message;
    submitButton.disabled = false;
  }
});
