const signinForm = document.querySelector("#signin-form");
const signinEmail = document.querySelector("#signin-email");
const signinPassword = document.querySelector("#signin-password");
const signinMessage = document.querySelector("#signin-message");

signinForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const profile = getClinicianProfile();
  const matches =
    signinEmail.value.trim().toLowerCase() === (profile.email || "").trim().toLowerCase() &&
    signinPassword.value === (profile.password || "");

  if (!matches) {
    signinMessage.textContent = "That email or password does not match the clinician account saved on this device.";
    return;
  }

  signinMessage.textContent = "";
  window.location.href = "./select.html";
});
