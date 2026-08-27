const patientList = document.querySelector("#patient-list");
const patientsMessage = document.querySelector("#patients-message");
const patientRowTemplate = document.querySelector("#patient-row-template");
const patientSearch = document.querySelector("#patient-search");
let clinicianPatients = [];
let patientWheelObserver = null;

function formatCreatedDate(value) {
  if (!value) return "Date created unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date created unavailable";
  return `Created ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date)}`;
}

function activatePatientWheel() {
  patientWheelObserver?.disconnect();
  const cards = [...patientList.querySelectorAll(".patient-row-card")];
  if (!cards.length) return;
  patientWheelObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-wheel-active", entry.isIntersecting && entry.intersectionRatio >= 0.62);
    });
  }, { root: patientList, threshold: [0.35, 0.62, 0.85] });
  cards.forEach((card) => patientWheelObserver.observe(card));
  cards[0].classList.add("is-wheel-active");
}

function renderPatientRows(patients) {
  patientList.replaceChildren();
  patientsMessage.textContent = "";

  if (!patients.length) {
    patientsMessage.textContent = patientSearch.value.trim()
      ? "No associated patient IDs match that search."
      : "No patient IDs have been created for this clinician yet.";
    return;
  }

  patients.forEach((patient) => {
    const row = patientRowTemplate.content.firstElementChild.cloneNode(true);
    const stats = row.querySelectorAll(".patient-row-stat");
    const statusButton = row.querySelector(".patient-status-button");

    row.querySelector(".patient-row-id").textContent = patient.patientId;
    row.querySelector(".patient-created-date").textContent = formatCreatedDate(patient.createdAt);
    stats[0].textContent = `${patient.completedSessions || 0} sessions`;
    stats[1].textContent = `${patient.streakCount || 0} day streak`;
    row.querySelector(".patient-activation-status").textContent = patient.accountActivated ? "Account active" : "Awaiting activation";
    statusButton.addEventListener("click", () => {
      setActivePatientId(patient.patientId);
      clearActivePatientRecord();
      window.location.href = "./clinician-status.html";
    });

    patientList.appendChild(row);
  });

  activatePatientWheel();
}

async function renderPatients() {
  clinicianPatients = await apiFetchClinicianPatients();
  renderPatientRows(clinicianPatients);
}

patientSearch.addEventListener("input", () => {
  const query = patientSearch.value.trim().toUpperCase();
  renderPatientRows(clinicianPatients.filter((patient) => patient.patientId.toUpperCase().includes(query)));
});

renderPatients().catch((error) => {
  patientsMessage.textContent = error.message;
});
