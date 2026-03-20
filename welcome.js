const authForm = document.querySelector("#auth-form");
const nameInput = document.querySelector("#name-input");
const authTabs = document.querySelectorAll("[data-auth-mode]");
const authTitle = document.querySelector("#auth-title");
const authSubtitle = document.querySelector("#auth-subtitle");
const submitButton = document.querySelector("#submit-button");
const welcomeName = document.querySelector("#welcome-name");
const passwordInput = document.querySelector("#password-input");
const emailInput = document.querySelector("#email-input");
const identifierLabel = document.querySelector("#identifier-label");
const authHint = document.querySelector("#auth-hint");
const authError = document.querySelector("#auth-error");
const nameGroup = document.querySelector("#name-group");
const identifierGroup = document.querySelector("#identifier-group");

let authMode = "signin";

function updateAuthMode(mode) {
  authMode = mode;
  authTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authMode === mode);
  });

  authTitle.textContent = mode === "signin" ? "Welcome back" : "Create your account";
  authSubtitle.textContent =
    mode === "signin"
      ? "Pick up your recovery plan where you left off."
      : "Start a simple daily rehab routine built around your surgery area.";
  submitButton.textContent = mode === "signin" ? "Sign in" : "Create account";
  passwordInput.placeholder = mode === "signin" ? "Enter your password" : "Create a password";
  nameGroup.classList.toggle("hidden", mode === "signin");
  nameGroup.hidden = mode === "signin";
  nameInput.disabled = mode === "signin";
  identifierGroup.hidden = false;
  emailInput.disabled = false;
  identifierLabel.textContent = mode === "signin" ? "Username or email" : "Email";
  emailInput.placeholder = mode === "signin" ? "Enter your username or email" : "you@example.com";
  authHint.textContent =
    mode === "signin"
      ? "This local build signs in against your SQLite database on this computer."
      : "This local build creates an account in your SQLite database on this computer.";
  authError.textContent = "";
}

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => updateAuthMode(tab.dataset.authMode));
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  authError.textContent = "";

  if (!email || !password || (authMode === "create" && !name)) {
    if (authMode === "create" && !name) {
      nameInput.focus();
    } else if (!email) {
      emailInput.focus();
    } else {
      passwordInput.focus();
    }
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = authMode === "signin" ? "Signing in..." : "Creating account...";

  try {
    const response =
      authMode === "signin"
        ? await signInUser({ identifier: email, password })
        : await signUpUser({ name, email, password });

    saveUser(response.user);
    window.location.href = authMode === "signin" ? "./progress.html" : "./select.html";
  } catch (error) {
    authError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = authMode === "signin" ? "Sign in" : "Create account";
  }
});

const existingUser = getUser();
if (existingUser) {
  welcomeName.textContent = existingUser.name;
  emailInput.value = existingUser.email || "";
  nameInput.value = existingUser.name || "";
}

updateAuthMode(authMode);
