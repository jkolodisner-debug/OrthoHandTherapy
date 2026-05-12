const signinForm = document.querySelector("#signin-form");
const signinEmail = document.querySelector("#signin-email");
const signinPassword = document.querySelector("#signin-password");
const signinMessage = document.querySelector("#signin-message");
const signinPasswordToggle = document.querySelector("#signin-password-toggle");
const signinRemember = document.querySelector("#signin-remember");

const rememberedClinicianEmail = getRememberedClinicianEmail();

signinRemember.checked = Boolean(rememberedClinicianEmail);
signinEmail.value = rememberedClinicianEmail;

signinPasswordToggle.addEventListener("click", () => {
  const shouldShow = signinPassword.type === "password";
  signinPassword.type = shouldShow ? "text" : "password";
  signinPasswordToggle.textContent = shouldShow ? "Hide" : "Show";
});

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  signinMessage.textContent = "Signing in...";

  try {
    await apiSignInClinician({
      email: signinEmail.value.trim(),
      password: signinPassword.value,
      rememberOnDevice: signinRemember.checked
    });

    if (signinRemember.checked) {
      saveRememberedClinicianEmail(signinEmail.value.trim());
    } else {
      saveRememberedClinicianEmail("");
    }

    signinMessage.textContent = "";
    window.location.href = "./select.html";
  } catch (error) {
    signinMessage.textContent = error.message;
  }
});
