const patientActivationForm = document.querySelector("#patient-activation-form");
const activationPatientId = document.querySelector("#activation-patient-id");
const activationEmail = document.querySelector("#activation-email");
const activationRemember = document.querySelector("#activation-remember");
const patientAccessMessage = document.querySelector("#patient-access-message");

activationEmail.value = getRememberedPatientEmail();

patientActivationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = patientActivationForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  patientAccessMessage.textContent = "Sending your password setup email…";
  try {
    const message = await apiActivatePatient({
      patientId: activationPatientId.value.trim().toUpperCase(),
      email: activationEmail.value.trim().toLowerCase(),
      rememberOnDevice: activationRemember.checked
    });
    patientAccessMessage.textContent = message;
    patientActivationForm.reset();
    activationEmail.value = getRememberedPatientEmail();
    window.setTimeout(() => {
      window.location.href = "./patient-returning.html";
    }, 1600);
  } catch (error) {
    patientAccessMessage.textContent = error.message;
    submitButton.disabled = false;
  }
});
