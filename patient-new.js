const patientSignupForm = document.querySelector("#patient-signup-form");
const patientLinkForm = document.querySelector("#patient-link-form");
const patientFirstName = document.querySelector("#patient-first-name");
const patientLastName = document.querySelector("#patient-last-name");
const patientSignupEmail = document.querySelector("#patient-signup-email");
const patientSignupPassword = document.querySelector("#patient-signup-password");
const patientSignupConfirm = document.querySelector("#patient-signup-confirm");
const activationPatientId = document.querySelector("#activation-patient-id");
const activationRemember = document.querySelector("#activation-remember");
const patientLinkBack = document.querySelector("#patient-link-back");
const patientSignupSupportCopy = document.querySelector("#patient-signup-support-copy");
const patientAccessMessage = document.querySelector("#patient-access-message");

let pendingPatientSignup = null;

patientSignupEmail.value = getRememberedPatientEmail();

function showPatientSignupStep() {
  patientSignupSupportCopy.textContent = "Start with your account details, then link the patient ID from your clinician.";
  patientSignupForm.hidden = false;
  patientSignupForm.classList.remove("hidden");
  patientLinkForm.hidden = true;
  patientLinkForm.classList.add("hidden");
}

function showPatientLinkStep() {
  patientSignupSupportCopy.textContent = "Now enter the patient ID your clinician gave you to connect your plan.";
  patientSignupForm.hidden = true;
  patientSignupForm.classList.add("hidden");
  patientLinkForm.hidden = false;
  patientLinkForm.classList.remove("hidden");
}

patientSignupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const firstName = patientFirstName.value.trim();
  const lastName = patientLastName.value.trim();
  const email = patientSignupEmail.value.trim().toLowerCase();
  const password = patientSignupPassword.value;
  const confirmPassword = patientSignupConfirm.value;

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    patientAccessMessage.textContent = "Fill out every field to continue.";
    return;
  }

  if (password.length < 8) {
    patientAccessMessage.textContent = "Use at least 8 characters for your password.";
    return;
  }

  if (password !== confirmPassword) {
    patientAccessMessage.textContent = "The passwords do not match.";
    return;
  }

  pendingPatientSignup = {
    firstName,
    lastName,
    email,
    password
  };
  patientAccessMessage.textContent = "";
  showPatientLinkStep();
  activationPatientId.focus();
});

patientLinkBack.addEventListener("click", () => {
  patientAccessMessage.textContent = "";
  showPatientSignupStep();
});

patientLinkForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingPatientSignup) {
    patientAccessMessage.textContent = "Start by creating your account details first.";
    showPatientSignupStep();
    return;
  }

  const submitButton = patientLinkForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  patientAccessMessage.textContent = "Linking your patient ID…";
  try {
    await apiCreatePatientAccount({
      ...pendingPatientSignup,
      patientId: activationPatientId.value.trim().toUpperCase(),
      rememberOnDevice: activationRemember.checked
    });
    window.location.href = "./progress.html";
  } catch (error) {
    patientAccessMessage.textContent = error.message;
    submitButton.disabled = false;
  }
});

showPatientSignupStep();
