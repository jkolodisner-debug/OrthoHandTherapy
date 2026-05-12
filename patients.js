const patientList = document.querySelector("#patient-list");
const patientsMessage = document.querySelector("#patients-message");
const patientRowTemplate = document.querySelector("#patient-row-template");

const patients = getAllPatientRecords();

if (!patients.length) {
  patientsMessage.textContent = "No patient IDs have been created on this device yet.";
} else {
  patients.forEach((patient) => {
    const row = patientRowTemplate.content.firstElementChild.cloneNode(true);
    const stats = row.querySelectorAll(".patient-row-stat");
    const statusButton = row.querySelector(".patient-status-button");
    const editButton = row.querySelector(".patient-edit-button");

    row.querySelector(".patient-row-id").textContent = patient.patientId;
    stats[0].textContent = `${patient.progress.completedSessions || 0} sessions`;
    stats[1].textContent = `${patient.progress.streakCount || 0} day streak`;

    statusButton.addEventListener("click", () => {
      setActivePatientId(patient.patientId);
      window.location.href = "./clinician-status.html";
    });

    editButton.addEventListener("click", () => {
      setActivePatientId(patient.patientId);
      syncDraftFromActivePatient();
      window.location.href = "./select.html";
    });

    patientList.appendChild(row);
  });
}
