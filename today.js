const planName = document.querySelector("#plan-name");
const dayLabel = document.querySelector("#day-label");
const exerciseList = document.querySelector("#exercise-list");
const exerciseTemplate = document.querySelector("#exercise-template");
const finishButton = document.querySelector("#finish-button");
const completionMessage = document.querySelector("#completion-message");
const completionOverlay = document.querySelector("#completion-overlay");
const overlayStreakMessage = document.querySelector("#overlay-streak-message");
const completionOverlayBadge = document.querySelector("#completion-overlay-badge");
const completionOverlayTitle = document.querySelector("#completion-overlay-title");
const completionReturnButton = document.querySelector("#completion-return-button");
const partialOverlay = document.querySelector("#partial-overlay");
const resumeButton = document.querySelector("#resume-button");
const laterButton = document.querySelector("#later-button");
const patientCode = document.querySelector("#patient-code");
const exerciseImageOverlay = document.querySelector("#exercise-image-overlay");
const exerciseImageClose = document.querySelector("#exercise-image-close");
const exerciseImageTitle = document.querySelector("#exercise-image-title");
const exerciseImageDose = document.querySelector("#exercise-image-dose");
const exerciseImage = document.querySelector("#exercise-image");
const exerciseHowToList = document.querySelector("#exercise-how-to-list");
const exerciseHowToTip = document.querySelector("#exercise-how-to-tip");
const painRatingOverlay = document.querySelector("#pain-rating-overlay");
const stiffnessRatingOverlay = document.querySelector("#stiffness-rating-overlay");
const painRatingScale = document.querySelector("#pain-rating-scale");
const stiffnessRatingScale = document.querySelector("#stiffness-rating-scale");
const painRatingContinue = document.querySelector("#pain-rating-continue");
const stiffnessRatingContinue = document.querySelector("#stiffness-rating-continue");
const exerciseSourceNote = document.querySelector("#exercise-source-note");
const patientSignOut = document.querySelector("#patient-sign-out");
const sessionCompletionCount = document.querySelector("#session-completion-count");
const sessionCompletionTrack = document.querySelector("#session-completion-track");
const sessionCompletionFill = document.querySelector("#session-completion-fill");
const resetDayButton = document.querySelector("#reset-day-button");
const resetDayOverlay = document.querySelector("#reset-day-overlay");
const cancelResetDay = document.querySelector("#cancel-reset-day");
const confirmResetDay = document.querySelector("#confirm-reset-day");
const resetDayMessage = document.querySelector("#reset-day-message");

patientSignOut.addEventListener("click", () => {
  signOutPatientSession();
  window.location.href = "./index.html";
});

let activeRecord = null;
let completionFlowActive = false;

function buildRatingScale(container, symptom) {
  container.replaceChildren();
  const spacerBefore = document.createElement("div");
  spacerBefore.className = "rating-wheel-spacer";
  spacerBefore.setAttribute("aria-hidden", "true");
  container.appendChild(spacerBefore);
  for (let rating = 0; rating <= 10; rating += 1) {
    const button = document.createElement("button");
    const number = document.createElement("span");
    const ratingLabels = {
      0: `No ${symptom}`,
      5: `Moderate ${symptom}`,
      10: `Severe ${symptom}`
    };
    button.className = "rating-number";
    button.type = "button";
    number.className = "rating-number-value";
    number.textContent = rating;
    button.appendChild(number);
    if (ratingLabels[rating]) {
      const label = document.createElement("span");
      label.className = "rating-number-description";
      label.textContent = ratingLabels[rating];
      button.appendChild(label);
    }
    button.setAttribute("aria-label", `${rating} out of 10, ${ratingLabels[rating] || symptom}`);
    button.dataset.rating = `${rating}`;
    button.addEventListener("click", () => button.scrollIntoView({ block: "center", behavior: "smooth" }));
    container.appendChild(button);
  }
  const spacerAfter = spacerBefore.cloneNode();
  container.appendChild(spacerAfter);
  container.scrollTop = 0;
}

function getWheelRating(container) {
  const center = container.getBoundingClientRect().top + container.clientHeight / 2;
  const options = [...container.querySelectorAll(".rating-number")];
  const selected = options.reduce((nearest, option) => {
    const rect = option.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height / 2 - center);
    return !nearest || distance < nearest.distance ? { option, distance } : nearest;
  }, null);
  return Number(selected?.option.dataset.rating || 0);
}

function activateExerciseWheel() {
  const cards = [...exerciseList.querySelectorAll(".exercise-card-shell")];
  if (!cards.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-wheel-active", entry.isIntersecting && entry.intersectionRatio >= 0.62);
    });
  }, { root: exerciseList, threshold: [0.35, 0.62, 0.85] });
  cards.forEach((card) => observer.observe(card));
  cards[0].classList.add("is-wheel-active");
}

function parseMinimumSetCount(dose) {
  const match = `${dose || ""}`.match(/(\d+)(?:\s*-\s*\d+)?\s+sets?/i);
  return match ? Math.max(1, Number(match[1])) : 1;
}

function collectCompletionRatings() {
  return new Promise((resolve) => {
    buildRatingScale(painRatingScale, "pain");
    buildRatingScale(stiffnessRatingScale, "stiffness");
    painRatingContinue.onclick = () => {
      const painRating = getWheelRating(painRatingScale);
      painRatingOverlay.classList.add("hidden");
      stiffnessRatingOverlay.classList.remove("hidden");
      stiffnessRatingScale.focus();
      stiffnessRatingContinue.onclick = () => {
        const stiffnessRating = getWheelRating(stiffnessRatingScale);
        stiffnessRatingOverlay.classList.add("hidden");
        resolve({ pain_after: painRating, stiffness_after: stiffnessRating });
      };
    };
    painRatingOverlay.classList.remove("hidden");
    painRatingScale.focus();
  });
}

async function renderToday() {
  const activePatientId = getActivePatientId();
  activeRecord = activePatientId ? await apiFetchPatientRecord(activePatientId) : null;

  if (!hasAssignedPlan(activeRecord)) {
    window.location.href = "./patient-access.html";
    return;
  }

  const dashboard = getPatientDashboard(activeRecord);
  const todayLog = getDailyItemLog(activeRecord);

  planName.textContent = dashboard.title;
  patientCode.textContent = dashboard.patientId;
  const sourceLink = document.createElement("a");
  sourceLink.href = "https://www.orthoinfo.org/en/recovery/carpal-tunnel-therapeutic-exercise-program/";
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  sourceLink.textContent = "AAOS therapeutic exercise program for carpal tunnel syndrome";
  exerciseSourceNote.replaceChildren("Adapted from ", sourceLink);
  dayLabel.textContent = `Week ${getProgramWeek(activeRecord)} · ${dashboard.dayLabel}`;

  const assignedItems = getAssignedItems(activeRecord);
  function updateSessionCompletionProgress() {
    const currentLogs = getDailyItemLog(activeRecord);
    const completedExercises = assignedItems.filter((exercise) => Boolean(currentLogs[exercise.id]?.patient_checkoff)).length;
    const totalExercises = assignedItems.length;
    const percent = totalExercises ? Math.round((completedExercises / totalExercises) * 100) : 0;
    sessionCompletionCount.textContent = `${completedExercises} of ${totalExercises} exercises completed`;
    sessionCompletionFill.style.setProperty("--session-progress", `${percent}%`);
    sessionCompletionTrack.setAttribute("aria-valuenow", `${completedExercises}`);
    sessionCompletionTrack.setAttribute("aria-valuemax", `${totalExercises}`);
    sessionCompletionTrack.classList.toggle("is-complete", totalExercises > 0 && completedExercises === totalExercises);
  }

  assignedItems.forEach((assignedItem) => {
    const item = exerciseTemplate.content.firstElementChild.cloneNode(true);
    const previewButton = item.querySelector(".exercise-preview-button");
    const completedButton = item.querySelector(".exercise-completed-button");
    const setProgressLabel = item.querySelector(".set-progress-label");
    const progressText = item.querySelector(".exercise-progress-text");
    const progressTrack = item.querySelector(".weekly-progress-track");
    const progressFill = item.querySelector(".weekly-progress-fill");
    const bonusStep = item.querySelector(".weekly-bonus-step");
    const bonusLabel = item.querySelector(".weekly-bonus-label");
    const entry = todayLog[assignedItem.id] || {};
    const libraryItem = EXERCISE_LIBRARY.find((exercise) => exercise.id === assignedItem.id);
    const weeklyTarget = parseWeeklyFrequency(assignedItem.default_frequency);
    const minimumSets = parseMinimumSetCount(assignedItem.default_sets_reps_duration);
    let completedSetCount = Boolean(entry.patient_checkoff)
      ? minimumSets
      : Math.min(minimumSets, Math.max(0, Number(entry.completed_count) || 0));
    let completedToday = completedSetCount >= minimumSets;

    item.querySelector(".exercise-title").textContent = assignedItem.name;
    item.querySelector(".exercise-dose").textContent = `${assignedItem.default_frequency} • ${assignedItem.default_sets_reps_duration}`;
    previewButton.setAttribute("aria-label", `View how-to for ${assignedItem.name}`);
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

    function renderWeeklyProgress() {
      const weeklyCount = getWeeklyExerciseCompletion(activeRecord, assignedItem.id);
      const minimum = weeklyTarget.minimum;
      const maximum = weeklyTarget.maximum;
      const hasBonusDay = maximum > minimum;
      const minimumProgress = Math.min(100, Math.round((weeklyCount / minimum) * 100));

      progressText.textContent = `${Math.min(weeklyCount, minimum)} of ${minimum} suggested days this week`;
      progressFill.style.setProperty("--progress", `${minimumProgress}%`);
      progressTrack.setAttribute("aria-valuenow", `${Math.min(weeklyCount, minimum)}`);
      progressTrack.setAttribute("aria-valuemax", `${minimum}`);
      bonusStep.classList.toggle("hidden", !hasBonusDay);
      bonusStep.classList.toggle("is-complete", hasBonusDay && weeklyCount >= maximum);
      bonusLabel.textContent = hasBonusDay
        ? weeklyCount >= maximum
          ? "Extra day complete"
          : `Optional ${maximum}th day`
        : "";
      completedButton.classList.toggle("is-complete", completedToday);
      completedButton.classList.toggle("has-set-progress", completedSetCount > 0 && !completedToday);
      completedButton.setAttribute("aria-pressed", `${completedToday}`);
      completedButton.style.setProperty("--set-progress", `${Math.round((completedSetCount / minimumSets) * 100)}%`);
      setProgressLabel.textContent = completedToday
        ? "✓ Completed"
        : minimumSets === 1
          ? "Complete set"
          : `Complete set ${completedSetCount + 1} · ${completedSetCount} of ${minimumSets} done`;
      completedButton.disabled = completedToday || weeklyCount >= maximum;
    }

    renderWeeklyProgress();

    completedButton.addEventListener("click", async () => {
      if (completedToday) {
        return;
      }
      completedSetCount = Math.min(minimumSets, completedSetCount + 1);
      completedToday = completedSetCount >= minimumSets;
      if (completedToday) {
        completedButton.classList.add("just-completed");
        window.setTimeout(() => completedButton.classList.remove("just-completed"), 1400);
      }
      const patch = {
        completed_count: completedSetCount,
        patient_checkoff: completedToday,
        adherence_timestamp: completedToday ? new Date().toISOString() : ""
      };
      updateLocalEntry(patch);
      renderWeeklyProgress();
      updateSessionCompletionProgress();
      try {
        await apiUpdatePatientItemLog({
          patientId: activeRecord.patientId,
          itemId: assignedItem.id,
          patch
        });
      } catch (error) {
        completionMessage.textContent = error.message;
      }
    });

    previewButton.addEventListener("click", () => {
      const howToSteps = assignedItem.how_to_steps?.length
        ? assignedItem.how_to_steps
        : libraryItem?.how_to_steps || [];
      const howToTip = assignedItem.how_to_tip || libraryItem?.how_to_tip || "";
      const imageSource = assignedItem.image_path || libraryItem?.image_path || "";
      exerciseImageTitle.textContent = assignedItem.name;
      exerciseImageDose.textContent = `${assignedItem.default_frequency} • ${assignedItem.default_sets_reps_duration}`;
      if (imageSource) {
        exerciseImage.src = imageSource;
        exerciseImage.alt = `${assignedItem.name} exercise illustration`;
        exerciseImage.classList.remove("hidden");
      } else {
        exerciseImage.removeAttribute("src");
        exerciseImage.alt = "";
        exerciseImage.classList.add("hidden");
      }
      exerciseHowToList.replaceChildren(...howToSteps.map((step) => {
        const listItem = document.createElement("li");
        listItem.textContent = step;
        return listItem;
      }));
      exerciseHowToTip.textContent = howToTip ? `Tip: ${howToTip}` : "";
      exerciseHowToTip.classList.toggle("hidden", !howToTip);
      exerciseImageOverlay.classList.remove("hidden");
      requestAnimationFrame(() => exerciseImageOverlay.classList.add("is-visible"));
      exerciseImageClose.focus();
    });

    exerciseList.appendChild(item);
  });

  updateSessionCompletionProgress();
  activateExerciseWheel();

  if (hasCompletedToday(activeRecord)) {
    completionMessage.textContent = "Today's session is already saved for this patient.";
    finishButton.textContent = "Already completed today";
    finishButton.disabled = true;
  }
}

finishButton.addEventListener("click", async () => {
  if (completionFlowActive || hasCompletedToday(activeRecord)) {
    completionMessage.textContent = "Today's pain and stiffness ratings have already been submitted.";
    finishButton.textContent = "Already completed today";
    finishButton.disabled = true;
    return;
  }

  const assignedItems = getAssignedItems(activeRecord);
  const allLogs = getDailyItemLog(activeRecord);
  const completedCount = assignedItems.filter((item) => {
    const itemLog = allLogs[item.id] || {};
    return Boolean(itemLog.patient_checkoff);
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

  completionFlowActive = true;
  finishButton.disabled = true;
  try {
    activeRecord = await apiFetchPatientRecord(activeRecord.patientId);
  } catch (error) {
    completionFlowActive = false;
    finishButton.disabled = false;
    completionMessage.textContent = error.message;
    return;
  }
  if (hasCompletedToday(activeRecord)) {
    completionMessage.textContent = "Today's pain and stiffness ratings have already been submitted.";
    finishButton.textContent = "Already completed today";
    return;
  }
  const ratings = await collectCompletionRatings();
  const ratingUpdates = assignedItems.map((item) => {
    const currentLogs = activeRecord.progress.dailyLogs[getTodayIsoDate()] || {};
    activeRecord.progress.dailyLogs[getTodayIsoDate()] = {
      ...currentLogs,
      [item.id]: {
        ...(currentLogs[item.id] || {}),
        ...ratings
      }
    };
    return apiUpdatePatientItemLog({
      patientId: activeRecord.patientId,
      itemId: item.id,
      patch: ratings
    });
  });
  saveActivePatientRecord(activeRecord);
  completionOverlayBadge.textContent = "Saving progress";
  completionOverlayTitle.textContent = "Saving today’s session…";
  overlayStreakMessage.textContent = "Please wait while your ratings and exercise progress are saved.";
  completionReturnButton.classList.add("hidden");
  completionOverlay.classList.remove("hidden");

  try {
    await Promise.all(ratingUpdates);
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
    completionOverlayBadge.textContent = "Session complete";
    completionOverlayTitle.textContent = "Great work!";
    overlayStreakMessage.textContent = `You have a ${progress.streakCount} day streak!`;
    completionReturnButton.classList.remove("hidden");
  } catch (error) {
    completionOverlay.classList.add("hidden");
    completionMessage.textContent = error.message;
    completionFlowActive = false;
    finishButton.disabled = hasCompletedToday(activeRecord);
  }
});

resumeButton.addEventListener("click", () => {
  partialOverlay.classList.add("hidden");
});

laterButton.addEventListener("click", () => {
  partialOverlay.classList.add("hidden");
  window.location.href = "./index.html";
});

resetDayButton.addEventListener("click", () => {
  resetDayMessage.textContent = "";
  resetDayOverlay.classList.remove("hidden");
  cancelResetDay.focus();
});

cancelResetDay.addEventListener("click", () => {
  resetDayOverlay.classList.add("hidden");
});

confirmResetDay.addEventListener("click", async () => {
  confirmResetDay.disabled = true;
  resetDayMessage.textContent = "Resetting today’s progress…";
  try {
    const progress = await apiResetPatientDailyProgress(activeRecord.patientId);
    delete activeRecord.progress.dailyLogs[getTodayIsoDate()];
    activeRecord.progress = {
      ...activeRecord.progress,
      completedSessions: progress.completedSessions,
      streakCount: progress.streakCount,
      lastCompletedOn: progress.lastCompletedOn,
      dailyLogs: activeRecord.progress.dailyLogs
    };
    saveActivePatientRecord(activeRecord);
    window.location.reload();
  } catch (error) {
    resetDayMessage.textContent = error.message;
    confirmResetDay.disabled = false;
  }
});

function closeExerciseImage() {
  exerciseImageOverlay.classList.remove("is-visible");
  exerciseImageOverlay.classList.add("hidden");
}

exerciseImageClose.addEventListener("click", closeExerciseImage);
exerciseImageOverlay.addEventListener("click", (event) => {
  if (event.target === exerciseImageOverlay) {
    closeExerciseImage();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !exerciseImageOverlay.classList.contains("hidden")) {
    closeExerciseImage();
  }
});

renderToday().catch(() => {
  window.location.href = "./patient-access.html";
});
