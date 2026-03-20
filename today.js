const planName = document.querySelector("#plan-name");
const dayLabel = document.querySelector("#day-label");
const focusText = document.querySelector("#focus-text");
const exerciseList = document.querySelector("#exercise-list");
const exerciseTemplate = document.querySelector("#exercise-template");
const finishButton = document.querySelector("#finish-button");
const completionMessage = document.querySelector("#completion-message");

const currentUser = getUser();
const currentPlanData = getCurrentUserPlan();

planName.textContent = currentPlanData.name;
dayLabel.textContent = currentPlanData.todayLabel;
focusText.textContent = currentPlanData.todayFocus;

currentPlanData.exercises.forEach((exercise) => {
  const item = exerciseTemplate.content.firstElementChild.cloneNode(true);
  item.querySelector(".exercise-title").textContent = exercise.name;
  item.querySelector(".exercise-dose").textContent = exercise.dosage;
  item.querySelector(".exercise-tip").textContent = exercise.tip;
  exerciseList.appendChild(item);
});

if (hasCompletedToday()) {
  completionMessage.textContent = "Today's session is already saved for this account.";
  finishButton.textContent = "Already completed today";
}

finishButton.addEventListener("click", async () => {
  const checkedCount = exerciseList.querySelectorAll("input:checked").length;
  if (checkedCount === 0) {
    completionMessage.textContent = "Check off at least one exercise before finishing the session.";
    return;
  }

  if (!currentUser?.id) {
    window.location.href = "./index.html";
    return;
  }

  try {
    const response = await saveCompletedSession(currentUser.id);
    saveUser(response.user);
    completionMessage.textContent = "Nice work. Your progress is saved. Logging you out now.";
    finishButton.textContent = "Completed";
    clearUser();
    window.setTimeout(() => {
      window.location.href = "./index.html";
    }, 900);
  } catch (error) {
    completionMessage.textContent = error.message;
  }
});
