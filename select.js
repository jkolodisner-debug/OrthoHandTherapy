const userLabel = document.querySelector("#user-label");
const bodyOptions = document.querySelector("#body-options");
const optionTemplate = document.querySelector("#body-option-template");

const user = getUser();
if (user) {
  userLabel.textContent = user.name;
}

Object.entries(RECOVERY_PLANS).forEach(([planId, plan]) => {
  const option = optionTemplate.content.firstElementChild.cloneNode(true);
  option.querySelector(".body-card-image").innerHTML = plan.image;
  option.querySelector(".option-title").textContent = plan.name;
  option.querySelector(".option-subtitle").textContent = plan.subtitle;
  option.addEventListener("click", async () => {
    if (!user?.id) {
      window.location.href = "./index.html";
      return;
    }

    try {
      const response = await savePlanSelection(user.id, planId);
      saveUser(response.user);
      window.location.href = "./progress.html";
    } catch (error) {
      userLabel.textContent = error.message;
    }
  });
  bodyOptions.appendChild(option);
});
