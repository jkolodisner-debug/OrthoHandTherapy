import json

import azure.functions as func

from emailer import send_clinician_reset_email
from storage import TableBackedAppStore, today_iso


app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


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

    return json_response({"ok": True, "clinician": clinician}, status_code=201)


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

    return json_response({"ok": True, "clinician": clinician})


@app.route(route="clinicians/{clinicianId}", methods=["GET"])
def get_clinician(req: func.HttpRequest) -> func.HttpResponse:
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
        except RuntimeError as exc:
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


@app.route(route="clinicians/{clinicianId}/patients", methods=["GET"])
def clinician_patients(req: func.HttpRequest) -> func.HttpResponse:
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
    store, error = store_or_error()
    if error:
        return error

    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    payload = request_json(req)
    selected_categories = payload.get("selectedCategories") or []
    assigned_items = payload.get("assignedItems") or []
    if not clinician_id:
        return error_response("Clinician ID is required.")
    if not selected_categories or not assigned_items:
        return error_response("The selected program does not contain exercises.")
    try:
        patient = store.enroll_patient(clinician_id, selected_categories, assigned_items)
    except ValueError as exc:
        return error_response(str(exc), status_code=400)
    return json_response({"ok": True, "patient": patient}, status_code=201)


@app.route(route="patients/activate", methods=["POST"])
def activate_patient(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error
    payload = request_json(req)
    patient_id = (payload.get("patientId") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    if not patient_id or not email or not password:
        return error_response("Patient ID, email, and password are required.")
    try:
        patient = store.activate_patient(patient_id, email, password, local_date=payload.get("date"))
    except ValueError as exc:
        return error_response(str(exc), status_code=409)
    return json_response({"ok": True, "patient": patient}, status_code=201)


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
    return json_response({"ok": True, "patient": patient})


@app.route(route="clinicians/{clinicianId}/patients/{patientId}/notes", methods=["POST"])
def save_clinician_note(req: func.HttpRequest) -> func.HttpResponse:
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
    store, error = store_or_error()
    if error:
        return error

    payload = request_json(req)
    clinician_id = (payload.get("clinicianId") or "").strip()
    selected_categories = payload.get("selectedCategories") or []
    assigned_items = payload.get("assignedItems") or []
    clinician_notes = payload.get("clinicianNotes") or ""
    patient_id = payload.get("patientId") or ""

    if not clinician_id:
        return error_response("Clinician ID is required to save a patient plan.")

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
    store, error = store_or_error()
    if error:
        return error
    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    patient_id = req.route_params.get("patientId") or ""
    record = store.get_patient_record(patient_id)
    if not record or record.get("clinicianId") != clinician_id:
        return error_response("Patient ID is not associated with this clinician account.", status_code=404)
    return json_response({"ok": True, "patient": record})


@app.route(route="patients/{patientId}", methods=["GET"])
def get_patient(req: func.HttpRequest) -> func.HttpResponse:
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
    store, error = store_or_error()
    if error:
        return error

    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    patient_id = req.route_params.get("patientId") or ""
    record = store.get_patient_record(patient_id)
    if not record or record.get("clinicianId") != clinician_id:
        return error_response("Patient ID is not associated with this clinician account.", status_code=404)

    return json_response({"ok": True, "trends": store.get_trend_data(patient_id)})


@app.route(route="clinicians/{clinicianId}/patients/{patientId}/analytics", methods=["GET"])
def clinician_patient_analytics(req: func.HttpRequest) -> func.HttpResponse:
    store, error = store_or_error()
    if error:
        return error

    clinician_id = (req.route_params.get("clinicianId") or "").strip()
    patient_id = req.route_params.get("patientId") or ""
    record = store.get_patient_record(patient_id)
    if not record or record.get("clinicianId") != clinician_id:
        return error_response("Patient ID is not associated with this clinician account.", status_code=404)

    return json_response({"ok": True, "analytics": store.get_patient_analytics(patient_id)})
