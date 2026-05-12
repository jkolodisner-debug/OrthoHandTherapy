const homeSafetyList = document.querySelector("#home-safety-list");

GLOBAL_SAFETY_RULES.forEach((rule) => {
  const item = document.createElement("li");
  item.textContent = rule;
  homeSafetyList.appendChild(item);
});
