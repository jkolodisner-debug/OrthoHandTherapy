import json
import hmac
import hashlib
import base64
import os
from datetime import datetime, timedelta, timezone

import azure.functions as func

from emailer import send_clinician_reset_email, send_patient_reset_email
from storage import TableBackedAppStore, today_iso


app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

TOKEN_TTL_HOURS = 24


def json_response(payload, status_code=200):
    return func.HttpResponse(
        json.dumps(payload),
        status_code=status_code,
        mimetype="application/json",
    )


def error_response(message, status_code=400):
    return json_response({"ok": False, "error": message}, status_code=status_code)


def request_json(req):
    try:
        return req.get_json()
    except ValueError:
        return {}


def store_or_error():
    try:
        return TableBackedAppStore(), None
    except RuntimeError as exc:
        return None, error_response(str(exc), status_code=500)


def token_secret():
    secret = (
        os.getenv("AUTH_TOKEN_SECRET", "").strip()
        or os.getenv("STORAGE_CONNECTION_STRING", "").strip()
        or os.getenv("AzureWebJobsStorage", "").strip()
    )
    if not secret:
        raise RuntimeError("Missing AUTH_TOKEN_SECRET environment variable.")
    return secret.encode("utf-8")


def b64url_encode(value):
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def b64url_decode(value):
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("utf-8"))


def now_utc():
    return datetime.now(timezone.utc)


def create_auth_token(role, account_id):
    payload = {
        "role": role,
        "accountId": account_id,
        "exp": int((now_utc() + timedelta(hours=TOKEN_TTL_HOURS)).timestamp()),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = b64url_encode(payload_bytes)
    signature = hmac.new(token_secret(), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    return f"{payload_b64}.{b64url_encode(signature)}"


def verify_auth_token(token):
    if not token or "." not in token:
        raise ValueError("Sign in is required.")

    payload_b64, signature_b64 = token.split(".", 1)
    expected_signature = hmac.new(token_secret(), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    provided_signature = b64url_decode(signature_b64)
    if not hmac.compare_digest(expected_signature, provided_signature):
        raise ValueError("Your session is invalid. Please sign in again.")

    payload = json.loads(b64url_decode(payload_b64).decode("utf-8"))
    if int(payload.get("exp", 0) or 0) <= int(now_utc().timestamp()):
        raise ValueError("Your session has expired. Please sign in again.")
    return payload


def get_bearer_token(req):
    header = req.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        return ""
    return header[7:].strip()


def require_auth(req, role=None):
    try:
        payload = verify_auth_token(get_bearer_token(req))
    except ValueError as exc:
        return None, error_response(str(exc), status_code=401)
    except Exception:
        return None, error_response("Your session is invalid. Please sign in again.", status_code=401)
    except RuntimeError as exc:
        return None, error_response(str(exc), status_code=500)

    if role and payload.get("role") != role:
        return None, error_response("You are not allowed to use this route.", status_code=403)
    return payload, None


def require_clinician_route_access(req):
    auth, error = require_auth(req, role="clinician")
    if error:
        return None, error
    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    if clinician_id and auth.get("accountId") != clinician_id:
        return None, error_response("You are not allowed to use this clinician account.", status_code=403)
    return auth, None


def require_patient_route_access(req):
    auth, error = require_auth(req, role="patient")
    if error:
        return None, error
    patient_id = (req.route_params.get("patientId") or "").strip().upper()
    if patient_id and auth.get("accountId") != patient_id:
        return None, error_response("You are not allowed to use this patient account.", status_code=403)
    return auth, None


@app.route(route="clinician/signup", methods=["POST"])
def clinician_signup(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error

    payload = request_json(req)
    invite_code = (payload.get("inviteCode") or "").strip()
    first_name = (payload.get("firstName") or "").strip()
    last_name = (payload.get("lastName") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""

    if not all([invite_code, first_name, last_name, email, password]):
        return error_response("Invite code, first name, last name, email, and password are all required.")

    try:
        clinician = store.create_clinician(invite_code, first_name, last_name, email, password)
    except ValueError as exc:
        return error_response(str(exc), status_code=409)

    return json_response({"ok": True, "clinician": clinician, "authToken": create_auth_token("clinician", clinician["clinicianId"])}, status_code=201)


@app.route(route="clinician/signin", methods=["POST"])
def clinician_signin(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error

    payload = request_json(req)
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""

    if not email or not password:
        return error_response("Email and password are required.")

    try:
        clinician = store.sign_in_clinician(email, password)
    except ValueError as exc:
        return error_response(str(exc), status_code=401)

    return json_response({"ok": True, "clinician": clinician, "authToken": create_auth_token("clinician", clinician["clinicianId"])})


@app.route(route="clinicians/{clinicianId}", methods=["GET"])
def get_clinician(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_clinician_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    if not clinician_id:
        return error_response("Clinician ID is required.")

    clinician = store.get_clinician(clinician_id)
    if not clinician:
        return error_response("Clinician account not found.", status_code=404)

    return json_response({"ok": True, "clinician": clinician})


@app.route(route="clinicians", methods=["GET"])
def list_clinicians(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error
    return json_response({"ok": True, "clinicians": store.list_clinicians()})


@app.route(route="clinicians/{clinicianId}/reset-password", methods=["POST"])
def reset_clinician_password(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_clinician_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    payload = request_json(req)
    new_password = payload.get("newPassword") or ""

    if not clinician_id:
        return error_response("Clinician ID is required.")

    try:
        clinician = store.reset_clinician_password(clinician_id, new_password)
    except ValueError as exc:
        return error_response(str(exc), status_code=400)

    return json_response({"ok": True, "clinician": clinician})


@app.route(route="clinician/forgot-password", methods=["POST"])
def forgot_clinician_password(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error

    email = (request_json(req).get("email") or "").strip()
    if not email:
        return error_response("Email is required.")

    reset_request = store.create_clinician_reset_token(email)
    if reset_request:
        try:
            send_clinician_reset_email(reset_request["email"], reset_request["token"])
        except Exception as exc:
            return error_response(str(exc), status_code=500)

    return json_response(
        {
            "ok": True,
            "message": "If that email matches a clinician account, a reset link has been sent."
        }
    )


@app.route(route="clinician/reset-password", methods=["POST"])
def reset_clinician_password_by_token(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error

    payload = request_json(req)
    token = (payload.get("token") or "").strip()
    new_password = payload.get("newPassword") or ""

    try:
        clinician = store.reset_clinician_password_with_token(token, new_password)
    except ValueError as exc:
        return error_response(str(exc), status_code=400)

    return json_response({"ok": True, "clinician": clinician})


@app.route(route="patient/forgot-password", methods=["POST"])
def forgot_patient_password(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error

    email = (request_json(req).get("email") or "").strip()
    if not email:
        return error_response("Email is required.")

    reset_request = store.create_patient_reset_token(email)
    if reset_request:
        try:
            send_patient_reset_email(reset_request["email"], reset_request["token"])
        except Exception as exc:
            return error_response(str(exc), status_code=500)

    return json_response(
        {
            "ok": True,
            "message": "If that email matches a patient account, a reset link has been sent."
        }
    )


@app.route(route="patient/reset-password", methods=["POST"])
def reset_patient_password_by_token(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error

    payload = request_json(req)
    token = (payload.get("token") or "").strip()
    new_password = payload.get("newPassword") or ""

    try:
        patient = store.reset_patient_password_with_token(token, new_password)
    except ValueError as exc:
        return error_response(str(exc), status_code=400)

    return json_response({"ok": True, "patient": patient})


@app.route(route="clinicians/{clinicianId}/patients", methods=["GET"])
def clinician_patients(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_clinician_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    if not clinician_id:
        return error_response("Clinician ID is required.")

    patients = store.get_clinician_patients(clinician_id)
    return json_response({"ok": True, "patients": patients})


@app.route(route="clinicians/{clinicianId}/patients/invite", methods=["POST"])
def create_patient_invitation(req: func.HttpRequest) -> func.HttpResponse:
    return error_response("Clinicians can no longer create patient IDs. Patients create their own accounts and are assigned IDs automatically.", status_code=403)


@app.route(route="patients/signup", methods=["POST"])
def patient_signup(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error
    payload = request_json(req)
    clinician_id = (payload.get("clinicianId") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    if not clinician_id or not email or not password:
        return error_response("Physician, email, and password are required.")
    try:
        patient = store.create_patient_account(
            clinician_id=clinician_id,
            email=email,
            password=password,
            local_date=payload.get("date"),
        )
    except ValueError as exc:
        return error_response(str(exc), status_code=409)
    return json_response({"ok": True, "patient": patient, "authToken": create_auth_token("patient", patient["patientId"])}, status_code=201)


@app.route(route="patients/signin", methods=["POST"])
def patient_signin(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error
    payload = request_json(req)
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    if not email or not password:
        return error_response("Email and password are required.")
    try:
        patient = store.sign_in_patient(email, password, local_date=payload.get("date"))
    except ValueError as exc:
        return error_response(str(exc), status_code=401)
    return json_response({"ok": True, "patient": patient, "authToken": create_auth_token("patient", patient["patientId"])})


@app.route(route="clinicians/{clinicianId}/patients/{patientId}/notes", methods=["POST"])
def save_clinician_note(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_clinician_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    patient_id = (req.route_params.get("patientId") or "").strip()
    clinician_notes = (request_json(req).get("clinicianNotes") or "").strip()
    if not clinician_id or not patient_id:
        return error_response("Clinician ID and patient ID are required.")
    if len(clinician_notes) > 1500:
        return error_response("The clinician note must be 1,500 characters or fewer.")

    try:
        patient = store.save_clinician_note(clinician_id, patient_id, clinician_notes)
    except ValueError as exc:
        return error_response(str(exc), status_code=404)
    return json_response({"ok": True, "patient": patient})


@app.route(route="patients", methods=["POST"])
def save_patient_plan(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_auth(req, role="clinician")
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    payload = request_json(req)
    clinician_id = auth.get("accountId", "")
    selected_categories = payload.get("selectedCategories") or []
    assigned_items = payload.get("assignedItems") or []
    clinician_notes = payload.get("clinicianNotes") or ""
    patient_id = payload.get("patientId") or ""

    if not clinician_id:
        return error_response("Clinician ID is required to save a patient plan.")
    if not patient_id:
        return error_response("Load an existing patient before saving a plan.")

    if not selected_categories or not assigned_items:
        return error_response("Select at least one category and one assigned item.")

    try:
        record = store.save_patient_plan(
            clinician_id=clinician_id,
            patient_id=patient_id,
            selected_categories=selected_categories,
            assigned_items=assigned_items,
            clinician_notes=clinician_notes,
        )
    except ValueError as exc:
        return error_response(str(exc), status_code=409)

    return json_response({"ok": True, "patient": record}, status_code=201)


@app.route(route="patients/enroll", methods=["POST"])
def enroll_patient(req: func.HttpRequest) -> func.HttpResponse:
    return error_response("Patient IDs must be created from a signed-in clinician account.", status_code=403)


@app.route(route="clinicians/{clinicianId}/patients/{patientId}", methods=["GET"])
def clinician_patient(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_clinician_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error
    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    patient_id = req.route_params.get("patientId") or ""
    record = store.get_patient_record(patient_id)
    if not record or not store.clinician_can_access_patient(clinician_id, patient_id):
        return error_response("Patient ID is not associated with this clinician account.", status_code=404)
    return json_response({"ok": True, "patient": record})


@app.route(route="patients/{patientId}", methods=["GET"])
def get_patient(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_patient_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    patient_id = req.route_params.get("patientId") or ""
    record = store.get_patient_record(patient_id, local_date=req.params.get("date"))
    if not record:
        return error_response("Patient ID not found.", status_code=404)

    return json_response({"ok": True, "patient": record})


@app.route(route="patients/{patientId}/progress/item", methods=["POST"])
def update_progress_item(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_patient_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    patient_id = req.route_params.get("patientId") or ""
    payload = request_json(req)
    item_id = payload.get("itemId") or ""
    date = payload.get("date") or today_iso()
    patch = payload.get("patch") or {}

    if not patient_id or not item_id:
        return error_response("Patient ID and item ID are required.")

    if not isinstance(patch, dict):
        return error_response("Patch must be a JSON object.")

    try:
        entries = store.upsert_daily_log(patient_id=patient_id, date=date, item_id=item_id, patch=patch)
    except ValueError as exc:
        return error_response(str(exc), status_code=409)
    return json_response({"ok": True, "date": date, "entries": entries})


@app.route(route="patients/{patientId}/progress/complete", methods=["POST"])
def complete_progress(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_patient_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    patient_id = req.route_params.get("patientId") or ""
    if not patient_id:
        return error_response("Patient ID is required.")

    payload = request_json(req)
    try:
        progress = store.complete_today_session(patient_id, date=payload.get("date"))
    except ValueError as exc:
        return error_response(str(exc), status_code=404)

    return json_response({"ok": True, "progress": progress})


@app.route(route="patients/{patientId}/progress/reset", methods=["POST"])
def reset_today_progress(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_patient_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    patient_id = req.route_params.get("patientId") or ""
    if not patient_id:
        return error_response("Patient ID is required.")

    payload = request_json(req)
    try:
        progress = store.reset_today_progress(patient_id, date=payload.get("date"))
    except ValueError as exc:
        return error_response(str(exc), status_code=404)

    return json_response({"ok": True, "progress": progress})


@app.route(route="patients/{patientId}/trends", methods=["GET"])
def patient_trends(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_patient_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    patient_id = req.route_params.get("patientId") or ""
    if not patient_id:
        return error_response("Patient ID is required.")

    trends = store.get_trend_data(patient_id)
    return json_response({"ok": True, "trends": trends})


@app.route(route="clinicians/{clinicianId}/patients/{patientId}/trends", methods=["GET"])
def clinician_patient_trends(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_clinician_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    patient_id = req.route_params.get("patientId") or ""
    record = store.get_patient_record(patient_id)
    if not record or not store.clinician_can_access_patient(clinician_id, patient_id):
        return error_response("Patient ID is not associated with this clinician account.", status_code=404)

    return json_response({"ok": True, "trends": store.get_trend_data(patient_id)})


@app.route(route="clinicians/{clinicianId}/patients/{patientId}/analytics", methods=["GET"])
def clinician_patient_analytics(req: func.HttpRequest) -> func.HttpResponse:
    auth, error = require_clinician_route_access(req)
    if error:
        return error
    store, error = store_or_error()
    if error:
        return error

    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    patient_id = req.route_params.get("patientId") or ""
    record = store.get_patient_record(patient_id)
    if not record or not store.clinician_can_access_patient(clinician_id, patient_id):
        return error_response("Patient ID is not associated with this clinician account.", status_code=404)

    return json_response({"ok": True, "analytics": store.get_patient_analytics(patient_id)})
