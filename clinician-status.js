const statusSubtitle = document.querySelector("#status-subtitle");
const statusPatientId = document.querySelector("#status-patient-id");
const statusStreak = document.querySelector("#status-streak");
const statusCompleted = document.querySelector("#status-completed");
const completionChart = document.querySelector("#completion-chart");
const painChart = document.querySelector("#pain-chart");
const statusPlanList = document.querySelector("#status-plan-list");
const editPlanButton = document.querySelector("#edit-plan-button");

const activeRecord = getActivePatientRecord();

function renderChartRow(container, label, value, max, toneClass, suffix = "") {
  const row = document.createElement("div");
  row.className = "chart-row";
  row.innerHTML = `
    <span class="chart-label">${label}</span>
    <div class="chart-track"><div class="chart-fill ${toneClass}" style="width:${max ? (Number(value) / max) * 100 : 0}%"></div></div>
    <span class="chart-value">${value}${suffix}</span>
  `;
  container.appendChild(row);
}

if (!activeRecord) {
  statusSubtitle.textContent = "No patient is loaded right now. Go back to the clinician portal and enter a patient ID first.";
  editPlanButton.textContent = "Open clinician portal";
} else {
  const trendData = getPatientTrendData(activeRecord.patientId);
  const groupedItems = getAssignedItemsByCategory(activeRecord.patientId);

  statusPatientId.textContent = activeRecord.patientId;
  statusStreak.textContent = `${getStreakCount(activeRecord.patientId)} days`;
  statusCompleted.textContent = `${getCompletedSessions(activeRecord.patientId)}`;

  trendData.forEach((day) => {
    renderChartRow(completionChart, day.date.slice(5), day.completionPercent, 100, "completion-tone", "%");
    renderChartRow(painChart, `${day.date.slice(5)} before`, day.avgPainBefore || 0, 10, "pain-before-tone");
    renderChartRow(painChart, `${day.date.slice(5)} after`, day.avgPainAfter || 0, 10, "pain-after-tone");
  });

  groupedItems.forEach((group) => {
    const item = document.createElement("li");
    item.textContent = `${group.title}: ${group.assignedItems.length} assigned`;
    statusPlanList.appendChild(item);
  });
}
