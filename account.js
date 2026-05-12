const accountForm = document.querySelector("#account-form");
const firstNameInput = document.querySelector("#first-name-input");
const lastNameInput = document.querySelector("#last-name-input");
const emailInput = document.querySelector("#email-input");
const passwordInput = document.querySelector("#password-input");
const accountMessage = document.querySelector("#account-message");
const accountEyebrow = document.querySelector("#account-eyebrow");
const accountTitle = document.querySelector("#account-title");
const accountSupportCopy = document.querySelector("#account-support-copy");
const accountSubmitButton = document.querySelector("#account-submit-button");
const passwordToggleButton = document.querySelector("#password-toggle-button");
const accountTopLink = document.querySelector("#account-top-link");
const accountSecondaryLink = document.querySelector("#account-secondary-link");
const resetPasswordSection = document.querySelector("#reset-password-section");
const resetPasswordForm = document.querySelector("#reset-password-form");
const newPasswordInput = document.querySelector("#new-password-input");
const confirmPasswordInput = document.querySelector("#confirm-password-input");
const newPasswordToggle = document.querySelector("#new-password-toggle");
const confirmPasswordToggle = document.querySelector("#confirm-password-toggle");
const resetPasswordMessage = document.querySelector("#reset-password-message");

const params = new URLSearchParams(window.location.search);
const isDetailsMode = params.get("mode") === "details";

if (isDetailsMode) {
  accountEyebrow.textContent = "Account details";
  accountTitle.textContent = "Clinician account details";
  accountSupportCopy.textContent =
    "Review the saved clinician name and email for this session. Password is never shown here.";
  accountSubmitButton.hidden = true;
  accountTopLink.href = "./select.html";
  accountTopLink.textContent = "Clinician portal";
  accountSecondaryLink.href = "./select.html";
  accountSecondaryLink.textContent = "Clinician portal";

  firstNameInput.readOnly = true;
  lastNameInput.readOnly = true;
  emailInput.readOnly = true;
  passwordInput.value = "";
  passwordInput.placeholder = "Password hidden";
  passwordInput.disabled = true;
  passwordToggleButton.hidden = true;
  resetPasswordSection.classList.remove("hidden");
} else {
  accountTopLink.href = "./clinician-auth.html";
  accountTopLink.textContent = "Back";
  accountSecondaryLink.href = "./clinician-auth.html";
  accountSecondaryLink.textContent = "Clinician access";
}

passwordToggleButton.addEventListener("click", () => {
  const shouldShow = passwordInput.type === "password";
  passwordInput.type = shouldShow ? "text" : "password";
  passwordToggleButton.textContent = shouldShow ? "Hide" : "Show";
});

newPasswordToggle.addEventListener("click", () => {
  const shouldShow = newPasswordInput.type === "password";
  newPasswordInput.type = shouldShow ? "text" : "password";
  newPasswordToggle.textContent = shouldShow ? "Hide" : "Show";
});

confirmPasswordToggle.addEventListener("click", () => {
  const shouldShow = confirmPasswordInput.type === "password";
  confirmPasswordInput.type = shouldShow ? "text" : "password";
  confirmPasswordToggle.textContent = shouldShow ? "Hide" : "Show";
});

async function loadClinicianDetails() {
  if (!isDetailsMode) {
    return;
  }

  const clinician = await apiFetchClinicianDetails();
  firstNameInput.value = clinician.firstName || "";
  lastNameInput.value = clinician.lastName || "";
  emailInput.value = clinician.email || "";
}

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isDetailsMode) {
    return;
  }

  if (
    !firstNameInput.value.trim() ||
    !lastNameInput.value.trim() ||
    !emailInput.value.trim() ||
    !passwordInput.value.trim()
  ) {
    accountMessage.textContent = "Please complete first name, last name, email, and password.";
    return;
  }

  accountMessage.textContent = isDetailsMode ? "Saving account details..." : "Creating clinician account...";

  try {
    await apiCreateClinicianAccount({
      firstName: firstNameInput.value.trim(),
      lastName: lastNameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value
    });
    accountMessage.textContent = isDetailsMode
      ? "Account details saved. Opening the clinician portal..."
      : "Clinician account created. Opening the clinician portal...";
    window.setTimeout(() => {
      window.location.href = "./select.html";
    }, 900);
  } catch (error) {
    accountMessage.textContent = error.message;
  }
});

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isDetailsMode) {
    return;
  }

  if (!newPasswordInput.value.trim() || !confirmPasswordInput.value.trim()) {
    resetPasswordMessage.textContent = "Enter the new password twice.";
    return;
  }

  if (newPasswordInput.value !== confirmPasswordInput.value) {
    resetPasswordMessage.textContent = "The new passwords do not match.";
    return;
  }

  if (newPasswordInput.value.length < 8) {
    resetPasswordMessage.textContent = "Use at least 8 characters for the new password.";
    return;
  }

  resetPasswordMessage.textContent = "Saving new password...";

  try {
    await apiResetClinicianPassword(newPasswordInput.value);
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    resetPasswordMessage.textContent = "New password saved.";
  } catch (error) {
    resetPasswordMessage.textContent = error.message;
  }
});

loadClinicianDetails().catch((error) => {
  if (isDetailsMode) {
    accountMessage.textContent = error.message;
  }
});
