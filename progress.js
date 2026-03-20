const progressName = document.querySelector("#progress-name");
const progressBodyPart = document.querySelector("#progress-body-part");
const streakCount = document.querySelector("#streak-count");
const completedCount = document.querySelector("#completed-count");
const progressFill = document.querySelector("#progress-fill");
const progressPercent = document.querySelector("#progress-percent");

const user = getUser();
const userName = user?.name || "Patient";
const currentPlan = getCurrentUserPlan();
const completed = getCompletedSessions();
const total = currentPlan.totalSessions;
const percent = Math.min(100, Math.round((completed / total) * 100));

progressName.textContent = userName || "Patient";
progressBodyPart.textContent = currentPlan.name;
streakCount.textContent = `${getStreakCount()} days`;
completedCount.textContent = `${completed} / ${total}`;
progressPercent.textContent = `${percent}% complete`;
progressFill.style.width = `${percent}%`;
