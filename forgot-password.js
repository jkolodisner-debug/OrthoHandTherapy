const forgotPasswordParams = new URLSearchParams(window.location.search);
const resetToken = forgotPasswordParams.get("token") || "";

const forgotPasswordEyebrow = document.querySelector("#forgot-password-eyebrow");
const forgotPasswordTitle = document.querySelector("#forgot-password-title");
const forgotPasswordSupportCopy = document.querySelector("#forgot-password-support-copy");
const forgotPasswordMessage = document.querySelector("#forgot-password-message");
const forgotPasswordRequestForm = document.querySelector("#forgot-password-request-form");
const forgotPasswordResetForm = document.querySelector("#forgot-password-reset-form");
const forgotPasswordEmail = document.querySelector("#forgot-password-email");
const forgotPasswordNew = document.querySelector("#forgot-password-new");
const forgotPasswordConfirm = document.querySelector("#forgot-password-confirm");
const forgotPasswordNewToggle = document.querySelector("#forgot-password-new-toggle");
const forgotPasswordConfirmToggle = document.querySelector("#forgot-password-confirm-toggle");

function attachPasswordToggle(button, input) {
  button.addEventListener("click", () => {
    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";
    button.textContent = shouldShow ? "Hide" : "Show";
  });
}

attachPasswordToggle(forgotPasswordNewToggle, forgotPasswordNew);
attachPasswordToggle(forgotPasswordConfirmToggle, forgotPasswordConfirm);

if (resetToken) {
  forgotPasswordEyebrow.textContent = "Reset clinician password";
  forgotPasswordTitle.textContent = "Choose a new password";
  forgotPasswordSupportCopy.textContent =
    "Enter your new password below. This secure reset link can only be used once.";
  forgotPasswordRequestForm.classList.add("hidden");
  forgotPasswordResetForm.classList.remove("hidden");
} else {
  forgotPasswordRequestForm.classList.remove("hidden");
  forgotPasswordResetForm.classList.add("hidden");
}

forgotPasswordRequestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = forgotPasswordEmail.value.trim();
  if (!email) {
    forgotPasswordMessage.textContent = "Enter the clinician email tied to your account.";
    return;
  }

  forgotPasswordMessage.textContent = "Sending reset link...";
  try {
    const message = await apiRequestClinicianPasswordReset(email);
    forgotPasswordMessage.textContent = message;
    forgotPasswordRequestForm.reset();
  } catch (error) {
    forgotPasswordMessage.textContent = error.message;
  }
});

forgotPasswordResetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!resetToken) {
    forgotPasswordMessage.textContent = "This reset link is missing required information.";
    return;
  }

  if (!forgotPasswordNew.value.trim() || !forgotPasswordConfirm.value.trim()) {
    forgotPasswordMessage.textContent = "Enter the new password twice.";
    return;
  }

  if (forgotPasswordNew.value !== forgotPasswordConfirm.value) {
    forgotPasswordMessage.textContent = "The new passwords do not match.";
    return;
  }

  if (forgotPasswordNew.value.length < 8) {
    forgotPasswordMessage.textContent = "Use at least 8 characters for the new password.";
    return;
  }

  forgotPasswordMessage.textContent = "Saving new password...";
  try {
    await apiResetClinicianPasswordWithToken({
      token: resetToken,
      newPassword: forgotPasswordNew.value
    });
    forgotPasswordMessage.textContent = "Your password has been updated. Redirecting to sign in...";
    forgotPasswordResetForm.reset();
    window.setTimeout(() => {
      window.location.href = "./clinician-signin.html";
    }, 1200);
  } catch (error) {
    forgotPasswordMessage.textContent = error.message;
  }
});
