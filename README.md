# OrthoMotion Recovery Guide

A lightweight page-by-page prototype for post-op orthopedic recovery.

## Flow

- `index.html`: welcome plus sign in/create account
- `select.html`: simple body-part selection
- `progress.html`: current streak and program progress
- `today.html`: today's exercise plan

## Run it

Run the local app server:

```bash
python3 server.py
```

Then open `http://127.0.0.1:8000`.

## Notes

This prototype uses:

- SQLite in `users.db` for local accounts
- PBKDF2 password hashing in `server.py`
- `localStorage` only for non-sensitive UI state like the selected plan and current user profile
