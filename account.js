const accountForm = document.querySelector("#account-form");
const firstNameInput = document.querySelector("#first-name-input");
const lastNameInput = document.querySelector("#last-name-input");
const emailInput = document.querySelector("#email-input");
const passwordInput = document.querySelector("#password-input");
const accountMessage = document.querySelector("#account-message");

const profile = getClinicianSession();
firstNameInput.value = profile?.firstName || "";
lastNameInput.value = profile?.lastName || "";
emailInput.value = profile?.email || "";

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (
    !firstNameInput.value.trim() ||
    !lastNameInput.value.trim() ||
    !emailInput.value.trim() ||
    !passwordInput.value.trim()
  ) {
    accountMessage.textContent = "Please complete first name, last name, email, and password.";
    return;
  }

  accountMessage.textContent = "Creating clinician account...";

  try {
    await apiCreateClinicianAccount({
      firstName: firstNameInput.value.trim(),
      lastName: lastNameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value
    });
    accountMessage.textContent = "Clinician account created. Opening the clinician portal...";
    window.setTimeout(() => {
      window.location.href = "./select.html";
    }, 900);
  } catch (error) {
    accountMessage.textContent = error.message;
  }
});
