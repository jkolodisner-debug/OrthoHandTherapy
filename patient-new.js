const patientSignupForm = document.querySelector("#patient-signup-form");
const patientClinicianForm = document.querySelector("#patient-clinician-form");
const patientSignupEmail = document.querySelector("#patient-signup-email");
const patientSignupPassword = document.querySelector("#patient-signup-password");
const patientSignupConfirm = document.querySelector("#patient-signup-confirm");
const patientClinicianSelect = document.querySelector("#patient-clinician-select");
const patientGeneratedId = document.querySelector("#patient-generated-id");
const activationRemember = document.querySelector("#activation-remember");
const patientClinicianBack = document.querySelector("#patient-clinician-back");
const patientSignupSupportCopy = document.querySelector("#patient-signup-support-copy");
const patientAccessMessage = document.querySelector("#patient-access-message");

let pendingPatientSignup = null;
let clinicianOptionsLoaded = false;

patientSignupEmail.value = getRememberedPatientEmail();

function showPatientSignupStep() {
  patientSignupSupportCopy.textContent = "Start with your email and password, then choose your physician.";
  patientSignupForm.hidden = false;
  patientSignupForm.classList.remove("hidden");
  patientClinicianForm.hidden = true;
  patientClinicianForm.classList.add("hidden");
}

async function showPatientClinicianStep() {
  patientSignupSupportCopy.textContent = "Choose your physician and we will assign your patient ID automatically.";
  patientSignupForm.hidden = true;
  patientSignupForm.classList.add("hidden");
  patientClinicianForm.hidden = false;
  patientClinicianForm.classList.remove("hidden");
  patientGeneratedId.value = "Will be assigned after you choose your physician";

  if (!clinicianOptionsLoaded) {
    const clinicians = await apiFetchClinicians();
    clinicianOptionsLoaded = true;
    patientClinicianSelect.length = 1;
    clinicians.forEach((clinician) => {
      const option = document.createElement("option");
      option.value = clinician.clinicianId;
      const fullName = `${clinician.firstName || ""} ${clinician.lastName || ""}`.trim();
      option.textContent = fullName || clinician.clinicianId;
      patientClinicianSelect.appendChild(option);
    });
  }
}

patientSignupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = patientSignupEmail.value.trim().toLowerCase();
  const password = patientSignupPassword.value;
  const confirmPassword = patientSignupConfirm.value;

  if (!email || !password || !confirmPassword) {
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
    email,
    password
  };
  patientAccessMessage.textContent = "";
  showPatientClinicianStep().catch((error) => {
    patientAccessMessage.textContent = error.message;
    showPatientSignupStep();
  });
});

patientClinicianBack.addEventListener("click", () => {
  patientAccessMessage.textContent = "";
  showPatientSignupStep();
});

patientClinicianForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingPatientSignup) {
    patientAccessMessage.textContent = "Start by creating your account first.";
    showPatientSignupStep();
    return;
  }
  if (!patientClinicianSelect.value) {
    patientAccessMessage.textContent = "Choose your physician to continue.";
    return;
  }

  const submitButton = patientClinicianForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  patientAccessMessage.textContent = "Creating your account…";
  try {
    const patient = await apiCreatePatientAccount({
      ...pendingPatientSignup,
      clinicianId: patientClinicianSelect.value,
      rememberOnDevice: activationRemember.checked
    });
    patientGeneratedId.value = patient.patientId || "";
    patientAccessMessage.textContent = `Your patient ID is ${patient.patientId}. Opening your program...`;
    window.location.href = "./progress.html";
  } catch (error) {
    patientAccessMessage.textContent = error.message;
    submitButton.disabled = false;
  }
});

showPatientSignupStep();
