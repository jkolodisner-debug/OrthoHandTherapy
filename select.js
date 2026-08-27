const trackPatientForm = document.querySelector("#track-patient-form");
const trackPatientId = document.querySelector("#track-patient-id");
const trackMessage = document.querySelector("#track-message");
const clinicianSignOut = document.querySelector("#clinician-sign-out");
const createPatientForm = document.querySelector("#create-patient-form");
const createPatientMessage = document.querySelector("#create-patient-message");
const createdPatientAccess = document.querySelector("#created-patient-access");
const createdPatientId = document.querySelector("#created-patient-id");
const createdPatientProgram = document.querySelector("#created-patient-program");

if (!getCurrentClinicianId()) {
  window.location.replace("./clinician-signin.html");
}

clinicianSignOut.addEventListener("click", () => {
  clearClinicianSession();
  clearActivePatientId();
  clearActivePatientRecord();
  window.location.href = "./index.html";
});

function defaultHandPlan() {
  const categories = CATEGORY_DEFINITIONS;
  return {
    selectedCategories: categories.map((category) => category.id),
    assignedItems: categories.flatMap((category) => getItemsForCategory(category.id))
  };
}

createPatientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = createPatientForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  createPatientMessage.textContent = "Creating patient ID…";
  createdPatientAccess.classList.add("hidden");
  try {
    const patient = await apiCreatePatientInvitation(defaultHandPlan());
    createdPatientId.textContent = patient.patientId;
    createdPatientProgram.textContent = "Hand recovery program assigned. The patient will create a password during first sign-in.";
    createdPatientAccess.classList.remove("hidden");
    createPatientMessage.textContent = "";
    createPatientForm.reset();
  } catch (error) {
    createPatientMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
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
