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

const params = new URLSearchParams(window.location.search);
const isDetailsMode = params.get("mode") === "details";

if (isDetailsMode) {
  const clinician = getClinicianSession();
  accountEyebrow.textContent = "Account details";
  accountTitle.textContent = "Clinician account details";
  accountSupportCopy.textContent =
    "Review the saved clinician name and email for this session. Password is never shown here. Profile editing and password reset can come next.";
  accountSubmitButton.hidden = true;

  if (clinician) {
    firstNameInput.value = clinician.firstName || "";
    lastNameInput.value = clinician.lastName || "";
    emailInput.value = clinician.email || "";
  }

  firstNameInput.readOnly = true;
  lastNameInput.readOnly = true;
  emailInput.readOnly = true;
  passwordInput.value = "";
  passwordInput.placeholder = "Password hidden";
  passwordInput.disabled = true;
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
