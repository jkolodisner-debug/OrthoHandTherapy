# OrthoMotion Recovery Guide

A clinician-assigned orthopedic hand recovery tracker with a static frontend and a new Azure Function backend scaffold.

## Flow

- `index.html`: landing page asking whether the user is a clinician or patient
- `select.html`: clinician portal for building plans, generating patient IDs, and jumping to status tracking
- `patient-access.html`: patient ID entry page
- `clinician-status.html`: clinician status tracking view with simple progress graphs
- `account.html`: clinician account details prototype
- `progress.html`: patient dashboard showing the assigned plan, recovery day, and clinician notes
- `today.html`: patient-facing daily checklist with adherence, pain, and swelling tracking
- `api/`: Azure Functions Python backend scaffold for clinician accounts, patient plans, and progress storage

## Run it

Open `index.html` directly in a browser, or run a simple local server:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000`.

## Azure backend

The repo now includes an Azure Functions app under `api/` with these endpoints:

- `POST /api/clinician/signup`
- `POST /api/clinician/signin`
- `GET /api/clinicians/{clinicianId}/patients`
- `POST /api/patients`
- `GET /api/patients/{patientId}`
- `POST /api/patients/{patientId}/progress/item`
- `POST /api/patients/{patientId}/progress/complete`
- `GET /api/patients/{patientId}/trends`

Supporting Azure files:

- `api/host.json`
- `api/requirements.txt`
- `api/local.settings.example.json`
- `api/storage.py`
- `api/function_app.py`

### Azure environment variables

Set these in your Azure Function App:

```text
STORAGE_CONNECTION_STRING
CLINICIANS_TABLE=Clinicians
PATIENTS_TABLE=Patients
PLANS_TABLE=Plans
PROGRESS_TABLE=ProgressLogs
```

### Azure tables expected by the API

- `Clinicians`
- `Patients`
- `Plans`
- `ProgressLogs`

### Deploy notes

Right now the backend scaffold is built, but the frontend still uses the local `data.js` storage layer until we wire the pages over to the new API. That means:

- your Static Web App can stay live as the current UI
- the new `api/` folder is ready to deploy to Azure Functions
- the next integration step is replacing the current `localStorage` reads and writes with `fetch("/api/...")` calls

If you want to run the Function App locally later, create `api/local.settings.json` from the example file and install the requirements in a Python environment.

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

The current frontend prototype still stores clinician details, patient IDs, assigned plans, and progress in browser `localStorage` on the current device until the Azure API is wired into the pages.

- Clinician account details are local-only placeholders right now
- The new Azure backend scaffold is ready for clinician and patient data once the frontend is connected
- Scope is hand recovery only
- The app is designed for clinician-assigned exercise tracking, not independent medical treatment
- YouTube how-to links are still placeholders
- If browser storage is cleared, progress is lost
