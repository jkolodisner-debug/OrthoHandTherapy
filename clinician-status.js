const statusSubtitle = document.querySelector("#status-subtitle");
const statusPatientId = document.querySelector("#status-patient-id");
const statusStreak = document.querySelector("#status-streak");
const statusCompleted = document.querySelector("#status-completed");
const stiffnessChart = document.querySelector("#stiffness-chart");
const dailyPainChart = document.querySelector("#daily-pain-chart");
const monthlyPainChart = document.querySelector("#monthly-pain-chart");
const dailyPainEmpty = document.querySelector("#daily-pain-empty");
const monthlyPainEmpty = document.querySelector("#monthly-pain-empty");
const painTrendDirection = document.querySelector("#pain-trend-direction");
const painTrendCopy = document.querySelector("#pain-trend-copy");
const painSlope = document.querySelector("#pain-slope");
const painRSquared = document.querySelector("#pain-r-squared");
const painPValue = document.querySelector("#pain-p-value");
const painSampleSize = document.querySelector("#pain-sample-size");
const adherenceCurrentWeek = document.querySelector("#adherence-current-week");
const adherencePercent = document.querySelector("#adherence-percent");
const adherenceWeeksMet = document.querySelector("#adherence-weeks-met");
const adherenceWeeksBelow = document.querySelector("#adherence-weeks-below");
const adherenceExplanation = document.querySelector("#adherence-explanation");
const clinicianNoteForm = document.querySelector("#clinician-note-form");
const clinicianNoteText = document.querySelector("#clinician-note-text");
const clinicianNoteMessage = document.querySelector("#clinician-note-message");
const saveClinicianNote = document.querySelector("#save-clinician-note");
let loadedPatientRecord = null;

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

async function renderStatus() {
  let activeRecord = getActivePatientRecord();
  if (!activeRecord && getActivePatientId()) {
    activeRecord = await refreshActivePatientRecord();
  }

  if (!activeRecord) {
    statusSubtitle.textContent = "No patient is loaded right now. Go back to the clinician portal and enter a patient ID first.";
    return;
  }

  const trendData = await apiFetchPatientTrends(activeRecord.patientId);
  const analytics = await apiFetchPatientAnalytics(activeRecord.patientId);
  loadedPatientRecord = activeRecord;

  statusPatientId.textContent = activeRecord.patientId;
  statusStreak.textContent = `${getStreakCount(activeRecord)} days`;
  statusCompleted.textContent = `${getCompletedSessions(activeRecord)}`;
  clinicianNoteText.value = activeRecord.clinicianNotes || "";

  trendData.forEach((day) => {
    renderChartRow(stiffnessChart, day.date.slice(5), day.avgStiffness || 0, 10, "pain-after-tone");
  });

  const dailyPain = analytics.dailyPain || [];
  const monthlyPain = analytics.monthlyPain || [];
  const painTrend = analytics.painTrend || {};
  const adherence = analytics.adherence || {};

  dailyPain.forEach((day) => {
    renderChartRow(dailyPainChart, day.date.slice(5), day.pain, 10, "pain-after-tone");
  });
  monthlyPain.forEach((month) => {
    renderChartRow(monthlyPainChart, month.month, month.averagePain, 10, "monthly-pain-tone");
  });
  dailyPainEmpty.classList.toggle("hidden", dailyPain.length > 0);
  monthlyPainEmpty.classList.toggle("hidden", monthlyPain.length > 0);

  painSampleSize.textContent = `${painTrend.sampleSize || 0}`;
  if ((painTrend.sampleSize || 0) >= 2) {
    const directionText = painTrend.direction === "downward"
      ? "Pain is trending downward"
      : painTrend.direction === "upward"
        ? "Pain is trending upward"
        : "Pain is approximately stable";
    const isSignificant = painTrend.pValue !== "" && Number(painTrend.pValue) < 0.05;
    painTrendDirection.textContent = directionText;
    painTrendCopy.textContent = painTrend.pValue === ""
      ? "More daily reports are needed to assess statistical significance."
      : isSignificant
        ? "The linear trend is statistically significant at p < 0.05."
        : "The direction is visible, but the linear trend is not statistically significant at p < 0.05.";
    painSlope.textContent = `${painTrend.slope}`;
    painRSquared.textContent = `${painTrend.rSquared}`;
    painPValue.textContent = painTrend.pValue === "" ? "—" : `${painTrend.pValue}`;
  }

  adherenceCurrentWeek.textContent = `${adherence.currentWeekCompleted || 0} of ${adherence.weeklyTarget || 0} days`;
  adherencePercent.textContent = adherence.overallPercent === "" || adherence.overallPercent == null
    ? "—"
    : `${adherence.overallPercent}%`;
  adherenceWeeksMet.textContent = `${adherence.weeksMeetingGoal || 0}`;
  adherenceWeeksBelow.textContent = `${adherence.weeksBelowGoal || 0}`;
  if (!adherence.weeksEvaluated) {
    adherenceExplanation.textContent = "The first complete program week must finish before overall weekly adherence is calculated.";
  }
}

clinicianNoteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loadedPatientRecord?.patientId) {
    clinicianNoteMessage.textContent = "Load a patient before saving a note.";
    return;
  }

  saveClinicianNote.disabled = true;
  clinicianNoteMessage.textContent = "Saving note…";
  try {
    loadedPatientRecord = await apiSaveClinicianNote({
      patientId: loadedPatientRecord.patientId,
      clinicianNotes: clinicianNoteText.value.trim()
    });
    clinicianNoteText.value = loadedPatientRecord.clinicianNotes || "";
    clinicianNoteMessage.textContent = "Note saved. The patient will see it on their progress page.";
  } catch (error) {
    clinicianNoteMessage.textContent = error.message;
  } finally {
    saveClinicianNote.disabled = false;
  }
});

renderStatus().catch((error) => {
  statusSubtitle.textContent = error.message;
});
