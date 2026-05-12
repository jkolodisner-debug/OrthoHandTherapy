const planName = document.querySelector("#plan-name");
const dayLabel = document.querySelector("#day-label");
const focusText = document.querySelector("#focus-text");
const exerciseList = document.querySelector("#exercise-list");
const exerciseTemplate = document.querySelector("#exercise-template");
const finishButton = document.querySelector("#finish-button");
const completionMessage = document.querySelector("#completion-message");
const completionOverlay = document.querySelector("#completion-overlay");
const overlayStreakMessage = document.querySelector("#overlay-streak-message");
const partialOverlay = document.querySelector("#partial-overlay");
const resumeButton = document.querySelector("#resume-button");
const laterButton = document.querySelector("#later-button");
const todaySafetyList = document.querySelector("#today-safety-list");
const patientCode = document.querySelector("#patient-code");

let activeRecord = null;

GLOBAL_SAFETY_RULES.forEach((rule) => {
  const item = document.createElement("li");
  item.textContent = rule;
  todaySafetyList.appendChild(item);
});

async function renderToday() {
  activeRecord = getActivePatientRecord();
  if (!activeRecord && getActivePatientId()) {
    activeRecord = await refreshActivePatientRecord();
  }

  if (!hasAssignedPlan(activeRecord)) {
    window.location.href = "./patient-access.html";
    return;
  }

  const dashboard = getPatientDashboard(activeRecord);
  const todayLog = getDailyItemLog(activeRecord);

  planName.textContent = dashboard.title;
  patientCode.textContent = dashboard.patientId;
  dayLabel.textContent = dashboard.dayLabel;
  focusText.textContent =
    "Only complete the exercises and tasks assigned by the treating clinician. This checklist tracks adherence and symptom response, not medical advice.";

  getAssignedItems(activeRecord).forEach((assignedItem) => {
    const item = exerciseTemplate.content.firstElementChild.cloneNode(true);
    const toggle = item.querySelector(".exercise-toggle");
    const detailPanel = item.querySelector(".exercise-detail-panel");
    const chipRow = item.querySelector(".completion-chip-row");
    const progressText = item.querySelector(".exercise-progress-text");
    const painBeforeInput = item.querySelector(".pain-before-input");
    const painAfterInput = item.querySelector(".pain-after-input");
    const swellingInput = item.querySelector(".swelling-input");
    const symptomNotesInput = item.querySelector(".symptom-notes-input");
    const entry = todayLog[assignedItem.id] || {};
    const targetCount = Math.max(1, Number(assignedItem.daily_target_count) || 1);
    let completedCount = Math.max(0, Math.min(targetCount, Number(entry.completed_count) || 0));

    item.querySelector(".exercise-title").textContent = assignedItem.name;
    item.querySelector(".exercise-dose").textContent = `${assignedItem.default_frequency} • ${assignedItem.default_sets_reps_duration}`;
    progressText.textContent = `${completedCount} / ${targetCount} completions done today`;
    item.querySelector(".exercise-tip").textContent =
      `${assignedItem.patient_friendly_description} ${assignedItem.therapist_notes}`.trim();
    item.querySelector(".exercise-warning").textContent =
      `${assignedItem.contraindication_warning} ${assignedItem.pain_stop_rule}`.trim();

    painBeforeInput.value = entry.pain_before || "";
    painAfterInput.value = entry.pain_after || "";
    swellingInput.value = entry.swelling_response || "";
    symptomNotesInput.value = entry.symptom_notes || "";

    function updateLocalEntry(patch) {
      const currentLogs = activeRecord.progress.dailyLogs[getTodayIsoDate()] || {};
      activeRecord.progress.dailyLogs[getTodayIsoDate()] = {
        ...currentLogs,
        [assignedItem.id]: {
          ...(currentLogs[assignedItem.id] || {}),
          ...patch
        }
      };
      saveActivePatientRecord(activeRecord);
    }

    function renderChips() {
      chipRow.innerHTML = "";
      for (let index = 0; index < targetCount; index += 1) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `completion-chip ${index < completedCount ? "is-complete" : ""}`;
        chip.textContent = `Done ${index + 1}`;
        chip.addEventListener("click", async () => {
          if (index < completedCount) {
            completedCount = index;
          } else {
            completedCount = index + 1;
          }

          const patch = {
            completed_count: completedCount,
            patient_checkoff: completedCount >= targetCount,
            adherence_timestamp: completedCount >= targetCount ? new Date().toISOString() : ""
          };
          progressText.textContent = `${completedCount} / ${targetCount} completions done today`;
          updateLocalEntry(patch);
          await apiUpdatePatientItemLog({
            patientId: activeRecord.patientId,
            itemId: assignedItem.id,
            patch
          });
          renderChips();
        });
        chipRow.appendChild(chip);
      }
    }

    renderChips();

    toggle.addEventListener("click", () => {
      const isHidden = detailPanel.classList.contains("hidden");
      detailPanel.classList.toggle("hidden", !isHidden);
      toggle.textContent = isHidden ? "Hide details" : "View details";
    });

    painBeforeInput.addEventListener("input", async () => {
      const patch = { pain_before: painBeforeInput.value };
      updateLocalEntry(patch);
      await apiUpdatePatientItemLog({ patientId: activeRecord.patientId, itemId: assignedItem.id, patch });
    });

    painAfterInput.addEventListener("input", async () => {
      const patch = { pain_after: painAfterInput.value };
      updateLocalEntry(patch);
      await apiUpdatePatientItemLog({ patientId: activeRecord.patientId, itemId: assignedItem.id, patch });
    });

    swellingInput.addEventListener("change", async () => {
      const patch = { swelling_response: swellingInput.value };
      updateLocalEntry(patch);
      await apiUpdatePatientItemLog({ patientId: activeRecord.patientId, itemId: assignedItem.id, patch });
    });

    symptomNotesInput.addEventListener("input", async () => {
      const patch = { symptom_notes: symptomNotesInput.value };
      updateLocalEntry(patch);
      await apiUpdatePatientItemLog({ patientId: activeRecord.patientId, itemId: assignedItem.id, patch });
    });

    exerciseList.appendChild(item);
  });

  if (hasCompletedToday(activeRecord)) {
    completionMessage.textContent = "Today's session is already saved for this patient.";
    finishButton.textContent = "Already completed today";
    finishButton.disabled = true;
  }
}

finishButton.addEventListener("click", async () => {
  const assignedItems = getAssignedItems(activeRecord);
  const allLogs = getDailyItemLog(activeRecord);
  const completedCount = assignedItems.filter((item) => {
    const itemLog = allLogs[item.id] || {};
    const targetCount = Math.max(1, Number(item.daily_target_count) || 1);
    return (Number(itemLog.completed_count) || 0) >= targetCount;
  }).length;
  const totalCount = assignedItems.length;

  if (completedCount === 0) {
    completionMessage.textContent = "Mark at least one assigned exercise or task as completed before finishing the session.";
    return;
  }

  if (completedCount < totalCount) {
    partialOverlay.classList.remove("hidden");
    return;
  }

  const progress = await apiCompletePatientSession(activeRecord.patientId);
  activeRecord.progress = {
    ...activeRecord.progress,
    completedSessions: progress.completedSessions,
    streakCount: progress.streakCount,
    lastCompletedOn: progress.lastCompletedOn
  };
  saveActivePatientRecord(activeRecord);
  completionMessage.textContent = "Nice work. Your progress is saved for this patient.";
  finishButton.textContent = "Completed";
  finishButton.disabled = true;
  overlayStreakMessage.textContent = `You have an ${progress.streakCount} day streak!`;
  completionOverlay.classList.remove("hidden");
  window.setTimeout(() => {
    window.location.href = "./index.html";
  }, 2600);
});

resumeButton.addEventListener("click", () => {
  partialOverlay.classList.add("hidden");
});

laterButton.addEventListener("click", () => {
  partialOverlay.classList.add("hidden");
  window.location.href = "./index.html";
});

renderToday().catch(() => {
  window.location.href = "./patient-access.html";
});
