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

if (!hasAssignedPlan()) {
  window.location.href = "./patient-access.html";
}

const dashboard = getPatientDashboard();
const todayLog = getDailyItemLog();

planName.textContent = dashboard.title;
patientCode.textContent = dashboard.patientId;
dayLabel.textContent = dashboard.dayLabel;
focusText.textContent =
  "Only complete the exercises and tasks assigned by the treating clinician. This checklist tracks adherence and symptom response, not medical advice.";

GLOBAL_SAFETY_RULES.forEach((rule) => {
  const item = document.createElement("li");
  item.textContent = rule;
  todaySafetyList.appendChild(item);
});

getAssignedItems().forEach((assignedItem) => {
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

  function renderChips() {
    chipRow.innerHTML = "";
    for (let index = 0; index < targetCount; index += 1) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `completion-chip ${index < completedCount ? "is-complete" : ""}`;
      chip.textContent = `Done ${index + 1}`;
      chip.addEventListener("click", () => {
        if (index < completedCount) {
          completedCount = index;
        } else {
          completedCount = index + 1;
        }

        progressText.textContent = `${completedCount} / ${targetCount} completions done today`;
        updateDailyItemLog(assignedItem.id, {
          completed_count: completedCount,
          patient_checkoff: completedCount >= targetCount,
          adherence_timestamp: completedCount >= targetCount ? new Date().toISOString() : ""
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

  painBeforeInput.addEventListener("input", () => {
    updateDailyItemLog(assignedItem.id, { pain_before: painBeforeInput.value });
  });

  painAfterInput.addEventListener("input", () => {
    updateDailyItemLog(assignedItem.id, { pain_after: painAfterInput.value });
  });

  swellingInput.addEventListener("change", () => {
    updateDailyItemLog(assignedItem.id, { swelling_response: swellingInput.value });
  });

  symptomNotesInput.addEventListener("input", () => {
    updateDailyItemLog(assignedItem.id, { symptom_notes: symptomNotesInput.value });
  });

  exerciseList.appendChild(item);
});

if (hasCompletedToday()) {
  completionMessage.textContent = "Today's session is already saved on this device.";
  finishButton.textContent = "Already completed today";
  finishButton.disabled = true;
}

finishButton.addEventListener("click", () => {
  const assignedItems = getAssignedItems();
  const allLogs = getDailyItemLog();
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

  const progress = completeTodaySession();
  completionMessage.textContent = "Nice work. Your progress is saved on this device.";
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
