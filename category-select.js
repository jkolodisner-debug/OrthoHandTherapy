const categoryOptions = document.querySelector("#category-options");
const categoryOptionTemplate = document.querySelector("#category-option-template");
const safetyList = document.querySelector("#safety-list");
const activePatientLabel = document.querySelector("#active-patient-label");
const builderMessage = document.querySelector("#builder-message");
const continueButton = document.querySelector("#continue-button");

let activeRecord = getActivePatientRecord();
const draft = getClinicianDraft();
const selectedCategoryIds = new Set(draft.selectedCategories || activeRecord?.selectedCategories || []);

activePatientLabel.textContent = activeRecord?.patientId || "New patient plan";

function updateContinueState() {
  const enabled = selectedCategoryIds.size > 0;
  continueButton.classList.toggle("is-disabled", !enabled);
  continueButton.setAttribute("aria-disabled", String(!enabled));
}

function persistDraft() {
  saveClinicianDraft({
    ...getClinicianDraft(),
    patientId: activeRecord?.patientId || "",
    selectedCategories: [...selectedCategoryIds].sort((a, b) => a - b)
  });
}

function renderCategoryOptions() {
  categoryOptions.innerHTML = "";

  CATEGORY_DEFINITIONS.forEach((category) => {
    const option = categoryOptionTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = option.querySelector(".category-checkbox");

    option.querySelector(".option-title").textContent = `${category.id}. ${category.title}`;
    option.querySelector(".option-subtitle").textContent = category.description;
    checkbox.checked = selectedCategoryIds.has(category.id);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedCategoryIds.add(category.id);
      } else {
        selectedCategoryIds.delete(category.id);
      }

      persistDraft();
      updateContinueState();
    });

    categoryOptions.appendChild(option);
  });
}

GLOBAL_SAFETY_RULES.forEach((rule) => {
  const item = document.createElement("li");
  item.textContent = rule;
  safetyList.appendChild(item);
});

continueButton.addEventListener("click", (event) => {
  if (selectedCategoryIds.size === 0) {
    event.preventDefault();
    builderMessage.textContent = "Choose at least one category before continuing to Step 2.";
    return;
  }

  persistDraft();
});

async function initializeCategoryStep() {
  if (!activeRecord && getActivePatientId()) {
    activeRecord = await refreshActivePatientRecord();
    activePatientLabel.textContent = activeRecord?.patientId || "New patient plan";
  }

  if (selectedCategoryIds.size === 0 && activeRecord?.selectedCategories?.length) {
    activeRecord.selectedCategories.forEach((id) => selectedCategoryIds.add(id));
  }

  renderCategoryOptions();
  updateContinueState();
}

initializeCategoryStep().catch(() => {
  renderCategoryOptions();
  updateContinueState();
});
