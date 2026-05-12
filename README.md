# OrthoMotion Recovery Guide

A lightweight local-only prototype for clinician-assigned orthopedic hand recovery tracking.

## Flow

- `index.html`: landing page asking whether the user is a clinician or patient
- `select.html`: clinician portal for building plans, generating patient IDs, and jumping to status tracking
- `patient-access.html`: patient ID entry page
- `clinician-status.html`: clinician status tracking view with simple progress graphs
- `account.html`: clinician account details prototype
- `progress.html`: patient dashboard showing the assigned plan, recovery day, and clinician notes
- `today.html`: patient-facing daily checklist with adherence, pain, and swelling tracking

## Run it

Open `index.html` directly in a browser, or run a simple local server:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000`.

## Firebase setup

The Firebase CLI is installed locally in `~/.local/bin/firebase`.

Open a new Terminal window, then verify it with:

```bash
firebase --version
```

For this static app, the Firebase Web SDK is prepared in browser-module form:

- `firebase-client.js`
- `firebase-config.example.js`

To connect your real Firebase project:

1. Copy `firebase-config.example.js` to `firebase-config.js`
2. Replace the placeholder values with your Firebase web app config
3. Keep `firebase-config.js` out of git

The current app is not migrated to Firebase storage/auth yet, but the SDK scaffolding is now ready for that next step.

## Notes

This prototype stores clinician details, patient IDs, assigned plans, and progress only in browser `localStorage` on the current device.

- Clinician account details are local-only placeholders right now
- No health data is sent to a server
- Scope is hand recovery only
- The app is designed for clinician-assigned exercise tracking, not independent medical treatment
- YouTube how-to links are still placeholders
- If browser storage is cleared, progress is lost
