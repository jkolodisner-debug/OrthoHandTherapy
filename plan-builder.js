const categoryEditors = document.querySelector("#category-editors");
const categoryEditorTemplate = document.querySelector("#category-editor-template");
const assignedItemTemplate = document.querySelector("#assigned-item-template");
const savePlanButton = document.querySelector("#save-plan-button");
const builderMessage = document.querySelector("#builder-message");
const clinicianPlanNotes = document.querySelector("#clinician-plan-notes");
const activePatientLabel = document.querySelector("#active-patient-label");
const patientIdOverlay = document.querySelector("#patient-id-overlay");
const createdPatientId = document.querySelector("#created-patient-id");
const returnPortalButton = document.querySelector("#return-portal-button");

const activeRecord = getActivePatientRecord();
const draft = getClinicianDraft();
const selectedCategoryIds = new Set(draft.selectedCategories || activeRecord?.selectedCategories || []);
const assignedItemIds = new Set((draft.assignedItems || activeRecord?.assignedItems || []).map((item) => item.id));
const assignedOverrides = new Map((draft.assignedItems || activeRecord?.assignedItems || []).map((item) => [item.id, item]));

if (selectedCategoryIds.size === 0) {
  window.location.href = "./select.html";
}

activePatientLabel.textContent = activeRecord?.patientId || "New patient plan";
clinicianPlanNotes.value = draft.clinicianNotes || activeRecord?.clinicianNotes || "";

function updateSaveState() {
  savePlanButton.disabled = assignedItemIds.size === 0;
}

function syncAssignedItem(card, isChecked) {
  card.classList.toggle("is-active", isChecked);
  card.querySelectorAll("textarea, input[type='text'], input[type='number']").forEach((field) => {
    field.disabled = !isChecked;
  });
  const detailsToggle = card.querySelector(".assigned-item-details-toggle");
  if (detailsToggle) {
    detailsToggle.disabled = !isChecked;
  }
}

function renderCategoryEditors() {
  categoryEditors.innerHTML = "";

  CATEGORY_DEFINITIONS.filter((category) => selectedCategoryIds.has(category.id)).forEach((category) => {
    const editor = categoryEditorTemplate.content.firstElementChild.cloneNode(true);
    const itemList = editor.querySelector(".assigned-item-list");
    const editorToggle = editor.querySelector(".category-editor-toggle");
    const editorBody = editor.querySelector(".category-editor-body");
    const chevron = editor.querySelector(".toggle-chevron");

    editor.querySelector(".category-step-label").textContent = `Category ${category.id}`;
    editor.querySelector(".category-editor-title").textContent = category.title;
    editor.querySelector(".category-editor-description").textContent = category.description;
    editor.querySelector(".category-editor-warning").textContent = category.lockedNotice;

    editorToggle.addEventListener("click", () => {
      const shouldShow = editorBody.classList.contains("hidden");
      editorBody.classList.toggle("hidden", !shouldShow);
      chevron.textContent = shouldShow ? "−" : "+";
    });

    getItemsForCategory(category.id).forEach((item) => {
      const card = assignedItemTemplate.content.firstElementChild.cloneNode(true);
      const checkbox = card.querySelector(".assigned-item-checkbox");
      const descriptionInput = card.querySelector(".description-input");
      const frequencyInput = card.querySelector(".frequency-input");
      const doseInput = card.querySelector(".dose-input");
      const targetInput = card.querySelector(".target-input");
      const warningInput = card.querySelector(".warning-input");
      const painStopInput = card.querySelector(".pain-stop-input");
      const progressionInput = card.querySelector(".progression-input");
      const therapistNotesInput = card.querySelector(".therapist-notes-input");
      const detailsToggle = card.querySelector(".assigned-item-details-toggle");
      const detailsToggleText = card.querySelector(".assigned-item-toggle-text");
      const detailsToggleChevron = card.querySelector(".assigned-item-toggle-chevron");
      const fieldsPanel = card.querySelector(".assigned-item-fields");
      const saved = assignedOverrides.get(item.id) || item;
      const isChecked = assignedItemIds.has(item.id);

      card.querySelector(".assigned-item-title").textContent = item.name;
      card.querySelector(".assigned-item-meta").textContent = item.requires_prescription
        ? "Requires clinician prescription or approval"
        : "Standard tracked item";

      checkbox.checked = isChecked;
      descriptionInput.value = saved.patient_friendly_description;
      frequencyInput.value = saved.default_frequency;
      doseInput.value = saved.default_sets_reps_duration;
      targetInput.value = saved.daily_target_count || 1;
      warningInput.value = saved.contraindication_warning;
      painStopInput.value = saved.pain_stop_rule;
      progressionInput.value = saved.progression_notes;
      therapistNotesInput.value = saved.therapist_notes;

      syncAssignedItem(card, isChecked);

      detailsToggle.addEventListener("click", () => {
        const shouldShow = fieldsPanel.classList.contains("hidden");
        fieldsPanel.classList.toggle("hidden", !shouldShow);
        detailsToggleText.textContent = shouldShow ? "Hide item settings" : "Show item settings";
        detailsToggleChevron.textContent = shouldShow ? "−" : "+";
      });

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          assignedItemIds.add(item.id);
        } else {
          assignedItemIds.delete(item.id);
        }

        syncAssignedItem(card, checkbox.checked);
        updateSaveState();
      });

      itemList.appendChild(card);
    });

    categoryEditors.appendChild(editor);
  });
}

function collectAssignedItems() {
  const items = [];

  categoryEditors.querySelectorAll(".category-editor").forEach((editor) => {
    editor.querySelectorAll(".assigned-item-card").forEach((card) => {
      const checkbox = card.querySelector(".assigned-item-checkbox");
      if (!checkbox.checked) {
        return;
      }

      const title = card.querySelector(".assigned-item-title").textContent;
      const item = EXERCISE_LIBRARY.find((entry) => entry.name === title);
      if (!item) {
        return;
      }

      items.push({
        ...item,
        patient_friendly_description: card.querySelector(".description-input").value.trim() || item.patient_friendly_description,
        default_frequency: card.querySelector(".frequency-input").value.trim() || item.default_frequency,
        default_sets_reps_duration: card.querySelector(".dose-input").value.trim() || item.default_sets_reps_duration,
        daily_target_count: Math.max(1, Number(card.querySelector(".target-input").value) || 1),
        contraindication_warning: card.querySelector(".warning-input").value.trim() || item.contraindication_warning,
        pain_stop_rule: card.querySelector(".pain-stop-input").value.trim() || item.pain_stop_rule,
        progression_notes: card.querySelector(".progression-input").value.trim() || item.progression_notes,
        therapist_notes: card.querySelector(".therapist-notes-input").value.trim()
      });
    });
  });

  return items;
}

savePlanButton.addEventListener("click", () => {
  const assignedItems = collectAssignedItems();

  if (assignedItems.length === 0) {
    builderMessage.textContent = "Select at least one exercise or task before saving the assigned plan.";
    return;
  }

  const savedRecord = saveClinicianPlan({
    patientId: activeRecord?.patientId || draft.patientId || "",
    selectedCategories: [...selectedCategoryIds],
    assignedItems,
    clinicianNotes: clinicianPlanNotes.value.trim()
  });

  builderMessage.textContent = "Assigned plan saved on this device.";
  createdPatientId.textContent = savedRecord.patientId;
  patientIdOverlay.classList.remove("hidden");
});

returnPortalButton.addEventListener("click", () => {
  patientIdOverlay.classList.add("hidden");
  window.location.href = "./select.html";
});

renderCategoryEditors();
updateSaveState();
