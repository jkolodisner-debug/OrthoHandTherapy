const patientList = document.querySelector("#patient-list");
const patientsMessage = document.querySelector("#patients-message");
const patientRowTemplate = document.querySelector("#patient-row-template");

async function renderPatients() {
  const patients = await apiFetchClinicianPatients();

  if (!patients.length) {
    patientsMessage.textContent = "No patient IDs have been created for this clinician yet.";
    return;
  }

  patients.forEach((patient) => {
    const row = patientRowTemplate.content.firstElementChild.cloneNode(true);
    const stats = row.querySelectorAll(".patient-row-stat");
    const statusButton = row.querySelector(".patient-status-button");
    const editButton = row.querySelector(".patient-edit-button");

    row.querySelector(".patient-row-id").textContent = patient.patientId;
    stats[0].textContent = `${patient.completedSessions || 0} sessions`;
    stats[1].textContent = `${patient.streakCount || 0} day streak`;

    statusButton.addEventListener("click", () => {
      setActivePatientId(patient.patientId);
      clearActivePatientRecord();
      window.location.href = "./clinician-status.html";
    });

    editButton.addEventListener("click", () => {
      setActivePatientId(patient.patientId);
      clearActivePatientRecord();
      clearClinicianDraft();
      window.location.href = "./category-select.html";
    });

    patientList.appendChild(row);
  });
}

renderPatients().catch((error) => {
  patientsMessage.textContent = error.message;
});
