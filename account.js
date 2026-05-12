const accountForm = document.querySelector("#account-form");
const firstNameInput = document.querySelector("#first-name-input");
const lastNameInput = document.querySelector("#last-name-input");
const emailInput = document.querySelector("#email-input");
const passwordInput = document.querySelector("#password-input");
const accountMessage = document.querySelector("#account-message");

const profile = getClinicianProfile();
firstNameInput.value = profile.firstName || "";
lastNameInput.value = profile.lastName || "";
emailInput.value = profile.email || "";
passwordInput.value = profile.password || "";

accountForm.addEventListener("submit", (event) => {
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

  saveClinicianProfile({
    firstName: firstNameInput.value.trim(),
    lastName: lastNameInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value
  });
  accountMessage.textContent = "Clinician account details saved on this device.";
});
