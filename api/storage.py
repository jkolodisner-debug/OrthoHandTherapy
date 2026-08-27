import base64
import hashlib
import json
import math
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from azure.core.exceptions import ResourceExistsError
from azure.data.tables import TableServiceClient, UpdateMode


def utc_now():
    return datetime.now(timezone.utc)


def utc_now_iso():
    return utc_now().isoformat()


def today_iso():
    return utc_now().date().isoformat()


def yesterday_iso():
    return (utc_now().date() - timedelta(days=1)).isoformat()


def normalized_log_date(value):
    try:
        return datetime.strptime(f"{value or ''}", "%Y-%m-%d").date().isoformat()
    except ValueError:
        return today_iso()


def json_dumps(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True)


def json_loads(value, fallback):
    if not value:
        return fallback

    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def normalize_email(value):
    return (value or "").strip().lower()


def normalize_invite_code(value):
    return (value or "").strip()


def normalize_patient_id(value):
    return (value or "").strip().upper()


def parse_daily_count(value):
    text = f"{value or ''}".strip().lower()
    if not text:
        return None

    import re

    match = re.match(r"^(\d+)(?:\s*x)?(?:\s+daily)?$", text)
    if not match:
        return None

    count = int(match.group(1))
    return count if count > 0 else None


def parse_weekly_minimum(value):
    numbers = [int(number) for number in re.findall(r"\d+", f"{value or ''}")]
    return numbers[0] if numbers else 1


def _continued_fraction_beta(a, b, x):
    max_iterations = 200
    epsilon = 3e-12
    tiny = 1e-300
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - (qab * x / qap)
    d = tiny if abs(d) < tiny else d
    d = 1.0 / d
    result = d
    for iteration in range(1, max_iterations + 1):
        twice_iteration = 2 * iteration
        numerator = iteration * (b - iteration) * x / ((qam + twice_iteration) * (a + twice_iteration))
        d = 1.0 + numerator * d
        d = tiny if abs(d) < tiny else d
        c = 1.0 + numerator / c
        c = tiny if abs(c) < tiny else c
        d = 1.0 / d
        result *= d * c
        numerator = -(a + iteration) * (qab + iteration) * x / ((a + twice_iteration) * (qap + twice_iteration))
        d = 1.0 + numerator * d
        d = tiny if abs(d) < tiny else d
        c = 1.0 + numerator / c
        c = tiny if abs(c) < tiny else c
        d = 1.0 / d
        delta = d * c
        result *= delta
        if abs(delta - 1.0) < epsilon:
            break
    return result


def regularized_incomplete_beta(x, a, b):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    front = math.exp(
        math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
        + a * math.log(x) + b * math.log(1.0 - x)
    )
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _continued_fraction_beta(a, b, x) / a
    return 1.0 - front * _continued_fraction_beta(b, a, 1.0 - x) / b


def pain_linear_regression(values):
    sample_size = len(values)
    if sample_size < 2:
        return {"sampleSize": sample_size, "slope": "", "rSquared": "", "pValue": "", "direction": "insufficient"}
    x_values = list(range(sample_size))
    x_mean = sum(x_values) / sample_size
    y_mean = sum(values) / sample_size
    ss_x = sum((value - x_mean) ** 2 for value in x_values)
    ss_y = sum((value - y_mean) ** 2 for value in values)
    cross = sum((x_values[index] - x_mean) * (values[index] - y_mean) for index in range(sample_size))
    slope = cross / ss_x if ss_x else 0.0
    r_squared = (cross ** 2 / (ss_x * ss_y)) if ss_x and ss_y else 0.0
    p_value = ""
    if sample_size >= 3:
        if r_squared >= 1 - 1e-12:
            p_value = 0.0
        else:
            t_statistic = abs(slope) * math.sqrt(ss_x / max((ss_y - (cross ** 2 / ss_x)) / (sample_size - 2), 1e-15))
            degrees_freedom = sample_size - 2
            p_value = regularized_incomplete_beta(
                degrees_freedom / (degrees_freedom + t_statistic ** 2),
                degrees_freedom / 2,
                0.5,
            )
    direction = "stable" if abs(slope) < 0.01 else ("downward" if slope < 0 else "upward")
    return {
        "sampleSize": sample_size,
        "slope": round(slope, 3),
        "rSquared": round(r_squared, 3),
        "pValue": round(p_value, 4) if p_value != "" else "",
        "direction": direction,
    }


def new_clinician_id():
    return f"cln_{secrets.token_hex(8)}"


def new_patient_id():
    prefix = "HND"
    suffix = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(5))
    return f"{prefix}-{suffix}"


def hash_password(password, salt=None):
    salt_bytes = salt or secrets.token_bytes(16)
    password_bytes = (password or "").encode("utf-8")
    derived = hashlib.pbkdf2_hmac("sha256", password_bytes, salt_bytes, 200000)
    return {
        "salt": base64.b64encode(salt_bytes).decode("utf-8"),
        "hash": base64.b64encode(derived).decode("utf-8"),
    }


def verify_password(password, salt_b64, hash_b64):
    salt_bytes = base64.b64decode(salt_b64.encode("utf-8"))
    comparison = hash_password(password, salt_bytes)
    return secrets.compare_digest(comparison["hash"], hash_b64)


def hash_reset_token(token):
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


class TableBackedAppStore:
    def __init__(self):
        connection_string = (
            os.getenv("STORAGE_CONNECTION_STRING", "").strip()
            or os.getenv("AzureWebJobsStorage", "").strip()
        )
        if not connection_string:
            raise RuntimeError("Missing Azure storage connection string environment variable.")

        self.service = TableServiceClient.from_connection_string(connection_string)
        self.clinicians_table = os.getenv("CLINICIANS_TABLE", "Clinicians")
        self.patients_table = os.getenv("PATIENTS_TABLE", "Patients")
        self.plans_table = os.getenv("PLANS_TABLE", "Plans")
        self.progress_table = os.getenv("PROGRESS_TABLE", "ProgressLogs")
        self.clinician_invite_code = os.getenv("CLINICIAN_INVITE_CODE", "").strip()
        self.reset_password_ttl_minutes = max(5, int(os.getenv("RESET_PASSWORD_TTL_MINUTES", "30") or 30))
        if not self.clinician_invite_code:
            raise RuntimeError("Missing CLINICIAN_INVITE_CODE environment variable.")
        self._ensure_tables()

    def _ensure_tables(self):
        for name in [
            self.clinicians_table,
            self.patients_table,
            self.plans_table,
            self.progress_table,
        ]:
            try:
                self.service.create_table_if_not_exists(name)
            except ResourceExistsError:
                pass

    def _table(self, name):
        return self.service.get_table_client(name)

    def _clinicians(self):
        return self._table(self.clinicians_table)

    def _patients(self):
        return self._table(self.patients_table)

    def _plans(self):
        return self._table(self.plans_table)

    def _progress(self):
        return self._table(self.progress_table)

    def find_clinician_by_email(self, email):
        normalized_email = normalize_email(email)
        if not normalized_email:
            return None

        entities = self._clinicians().query_entities(
            query_filter="PartitionKey eq 'CLINICIAN' and email eq @email",
            parameters={"email": normalized_email},
        )
        return next(iter(entities), None)

    def invite_code_is_valid(self, invite_code):
        return normalize_invite_code(invite_code) == self.clinician_invite_code

    def create_clinician(self, invite_code, first_name, last_name, email, password):
        if not self.invite_code_is_valid(invite_code):
            raise ValueError("That invite code is not valid.")

        normalized_email = normalize_email(email)
        if self.find_clinician_by_email(normalized_email):
            raise ValueError("An account with that email already exists.")

        clinician_id = new_clinician_id()
        password_data = hash_password(password)
        now = utc_now_iso()

        entity = {
            "PartitionKey": "CLINICIAN",
            "RowKey": clinician_id,
            "clinicianId": clinician_id,
            "firstName": (first_name or "").strip(),
            "lastName": (last_name or "").strip(),
            "email": normalized_email,
            "passwordHash": password_data["hash"],
            "passwordSalt": password_data["salt"],
            "createdAt": now,
            "updatedAt": now,
        }
        self._clinicians().create_entity(entity)
        return self._serialize_clinician(entity)

    def sign_in_clinician(self, email, password):
        entity = self.find_clinician_by_email(email)
        if not entity:
            raise ValueError("No clinician account matches that email.")

        if not verify_password(password, entity["passwordSalt"], entity["passwordHash"]):
            raise ValueError("Incorrect password.")

        return self._serialize_clinician(entity)

    def get_clinician(self, clinician_id):
        if not clinician_id:
            return None

        try:
            entity = self._clinicians().get_entity("CLINICIAN", clinician_id)
        except Exception:
            return None

        return self._serialize_clinician(entity)

    def list_clinicians(self):
        entities = self._clinicians().query_entities(query_filter="PartitionKey eq 'CLINICIAN'")
        return sorted(
            [
                {
                    "clinicianId": entity["RowKey"],
                    "firstName": entity.get("firstName", ""),
                    "lastName": entity.get("lastName", ""),
                }
                for entity in entities
            ],
            key=lambda item: (item.get("lastName", ""), item.get("firstName", "")),
        )

    def reset_clinician_password(self, clinician_id, new_password):
        if not clinician_id:
            raise ValueError("Clinician ID is required.")

        if not new_password or len(new_password) < 8:
            raise ValueError("New password must be at least 8 characters.")

        try:
            entity = self._clinicians().get_entity("CLINICIAN", clinician_id)
        except Exception as exc:
            raise ValueError("Clinician account not found.") from exc

        password_data = hash_password(new_password)
        entity["passwordHash"] = password_data["hash"]
        entity["passwordSalt"] = password_data["salt"]
        entity["accountActivated"] = True
        entity["activatedAt"] = entity.get("activatedAt") or utc_now_iso()
        entity["resetTokenHash"] = ""
        entity["resetTokenExpiresAt"] = ""
        entity["updatedAt"] = utc_now_iso()
        self._clinicians().upsert_entity(entity, mode=UpdateMode.REPLACE)
        return self._serialize_clinician(entity)

    def create_clinician_reset_token(self, email):
        entity = self.find_clinician_by_email(email)
        if not entity:
            return None

        token = secrets.token_urlsafe(32)
        entity["resetTokenHash"] = hash_reset_token(token)
        entity["resetTokenExpiresAt"] = (utc_now() + timedelta(minutes=self.reset_password_ttl_minutes)).isoformat()
        entity["updatedAt"] = utc_now_iso()
        self._clinicians().upsert_entity(entity, mode=UpdateMode.REPLACE)
        return {
            "token": token,
            "email": entity.get("email", ""),
            "expiresAt": entity["resetTokenExpiresAt"],
        }

    def reset_clinician_password_with_token(self, token, new_password):
        if not token:
            raise ValueError("Reset token is required.")

        if not new_password or len(new_password) < 8:
            raise ValueError("New password must be at least 8 characters.")

        token_hash = hash_reset_token(token)
        entities = self._clinicians().query_entities(
            query_filter="PartitionKey eq 'CLINICIAN' and resetTokenHash eq @tokenHash",
            parameters={"tokenHash": token_hash},
        )
        entity = next(iter(entities), None)
        if not entity:
            raise ValueError("This reset link is invalid or has already been used.")

        expires_at = entity.get("resetTokenExpiresAt", "")
        if not expires_at:
            raise ValueError("This reset link is invalid or has already been used.")

        try:
            expires_at_value = datetime.fromisoformat(expires_at)
        except ValueError as exc:
            raise ValueError("This reset link is invalid or has already been used.") from exc

        if expires_at_value <= utc_now():
            raise ValueError("This reset link has expired. Request a new one.")

        password_data = hash_password(new_password)
        entity["passwordHash"] = password_data["hash"]
        entity["passwordSalt"] = password_data["salt"]
        entity["resetTokenHash"] = ""
        entity["resetTokenExpiresAt"] = ""
        entity["updatedAt"] = utc_now_iso()
        self._clinicians().upsert_entity(entity, mode=UpdateMode.REPLACE)
        return self._serialize_clinician(entity)

    def create_patient_reset_token(self, email):
        entity = self.find_patient_by_email(email)
        if not entity:
            return None

        token = secrets.token_urlsafe(32)
        entity["resetTokenHash"] = hash_reset_token(token)
        entity["resetTokenExpiresAt"] = (utc_now() + timedelta(minutes=self.reset_password_ttl_minutes)).isoformat()
        entity["updatedAt"] = utc_now_iso()
        self._patients().upsert_entity(entity, mode=UpdateMode.MERGE)
        return {
            "token": token,
            "email": entity.get("email", ""),
            "expiresAt": entity["resetTokenExpiresAt"],
        }

    def reset_patient_password_with_token(self, token, new_password):
        if not token:
            raise ValueError("Reset token is required.")

        if not new_password or len(new_password) < 8:
            raise ValueError("New password must be at least 8 characters.")

        token_hash = hash_reset_token(token)
        entities = self._patients().query_entities(
            query_filter="resetTokenHash eq @tokenHash",
            parameters={"tokenHash": token_hash},
        )
        entity = next(iter(entities), None)
        if not entity:
            raise ValueError("This reset link is invalid or has already been used.")

        expires_at = entity.get("resetTokenExpiresAt", "")
        if not expires_at:
            raise ValueError("This reset link is invalid or has already been used.")

        try:
            expires_at_value = datetime.fromisoformat(expires_at)
        except ValueError as exc:
            raise ValueError("This reset link is invalid or has already been used.") from exc

        if expires_at_value <= utc_now():
            raise ValueError("This reset link has expired. Request a new one.")

        password_data = hash_password(new_password)
        entity["passwordHash"] = password_data["hash"]
        entity["passwordSalt"] = password_data["salt"]
        entity["resetTokenHash"] = ""
        entity["resetTokenExpiresAt"] = ""
        entity["updatedAt"] = utc_now_iso()
        self._patients().upsert_entity(entity, mode=UpdateMode.MERGE)
        return self.get_patient_record(entity["RowKey"])

    def _serialize_clinician(self, entity):
        return {
            "clinicianId": entity["RowKey"],
            "firstName": entity.get("firstName", ""),
            "lastName": entity.get("lastName", ""),
            "email": entity.get("email", ""),
            "createdAt": entity.get("createdAt", ""),
            "updatedAt": entity.get("updatedAt", ""),
        }

    def _find_patient_entity(self, patient_id):
        normalized_id = normalize_patient_id(patient_id)
        entities = self._patients().query_entities(
            query_filter="RowKey eq @patientId",
            parameters={"patientId": normalized_id},
        )
        return next(iter(entities), None)

    def find_patient_by_email(self, email):
        normalized_email = normalize_email(email)
        if not normalized_email:
            return None

        entities = self._patients().query_entities(
            query_filter="email eq @email",
            parameters={"email": normalized_email},
        )
        return next(iter(entities), None)

    def _get_plan_entity(self, patient_id):
        normalized_id = normalize_patient_id(patient_id)
        entities = self._plans().query_entities(
            query_filter="PartitionKey eq @patientId and RowKey eq 'current'",
            parameters={"patientId": normalized_id},
        )
        return next(iter(entities), None)

    def _serialize_progress_summary(self, entity):
        if not entity:
            return {
                "completedSessions": 0,
                "streakCount": 0,
                "lastCompletedOn": "",
            }

        return {
            "completedSessions": int(entity.get("completedSessions", 0) or 0),
            "streakCount": int(entity.get("streakCount", 0) or 0),
            "lastCompletedOn": entity.get("lastCompletedOn", ""),
        }

    def _default_patient_record(self, patient_id, clinician_id):
        now = utc_now_iso()
        return {
            "PartitionKey": clinician_id,
            "RowKey": patient_id,
            "patientId": patient_id,
            "clinicianId": clinician_id,
            "completedSessions": 0,
            "streakCount": 0,
            "lastCompletedOn": "",
            "accountActivated": False,
            "activatedAt": "",
            "createdAt": now,
            "updatedAt": now,
        }

    def save_patient_plan(self, clinician_id, selected_categories, assigned_items, clinician_notes, patient_id=""):
        normalized_patient_id = normalize_patient_id(patient_id) or new_patient_id()
        existing_patient = self._find_patient_entity(normalized_patient_id)
        plan_version = 1

        normalized_items = []
        for item in assigned_items:
            inferred_count = parse_daily_count(item.get("default_frequency"))
            normalized_items.append(
                {
                    **item,
                    "default_frequency": item.get("default_frequency", "").strip() if item.get("default_frequency") else "",
                    "daily_target_count": max(
                        1,
                        int(item.get("daily_target_count") or 0) or inferred_count or 1,
                    ),
                }
            )

        if existing_patient and existing_patient.get("clinicianId") != clinician_id:
            raise ValueError("That patient ID is already assigned to another clinician.")

        patient_entity = existing_patient or self._default_patient_record(normalized_patient_id, clinician_id)
        plan_entity = self._get_plan_entity(normalized_patient_id)

        if plan_entity:
            plan_version = int(plan_entity.get("version", 1) or 1) + 1

        now = utc_now_iso()
        patient_entity.update(
            {
                "updatedAt": now,
                "planVersion": plan_version,
            }
        )

        self._patients().upsert_entity(patient_entity, mode=UpdateMode.MERGE)

        next_plan = {
            "PartitionKey": normalized_patient_id,
            "RowKey": "current",
            "patientId": normalized_patient_id,
            "clinicianId": clinician_id,
            "selectedCategoriesJson": json_dumps(selected_categories),
            "assignedItemsJson": json_dumps(normalized_items),
            "clinicianNotes": clinician_notes or "",
            "createdAt": plan_entity.get("createdAt", now) if plan_entity else now,
            "updatedAt": now,
            "version": plan_version,
        }
        self._plans().upsert_entity(next_plan, mode=UpdateMode.REPLACE)
        return self.get_patient_record(normalized_patient_id)

    def save_clinician_note(self, clinician_id, patient_id, clinician_notes):
        normalized_patient_id = normalize_patient_id(patient_id)
        patient_entity = self._find_patient_entity(normalized_patient_id)
        if not patient_entity or patient_entity.get("clinicianId") != clinician_id:
            raise ValueError("Patient ID is not associated with this clinician account.")
        if not self._get_plan_entity(normalized_patient_id):
            raise ValueError("No active patient plan was found.")

        now = utc_now_iso()
        self._plans().upsert_entity(
            {
                "PartitionKey": normalized_patient_id,
                "RowKey": "current",
                "clinicianNotes": clinician_notes or "",
                "updatedAt": now,
            },
            mode=UpdateMode.MERGE,
        )
        self._patients().upsert_entity(
            {
                "PartitionKey": clinician_id,
                "RowKey": normalized_patient_id,
                "updatedAt": now,
            },
            mode=UpdateMode.MERGE,
        )
        return self.get_patient_record(normalized_patient_id)

    def enroll_patient(self, clinician_id, selected_categories, assigned_items):
        if not self.get_clinician(clinician_id):
            raise ValueError("The selected clinician account was not found.")

        patient_id = new_patient_id()
        while self._find_patient_entity(patient_id):
            patient_id = new_patient_id()

        return self.save_patient_plan(
            clinician_id=clinician_id,
            patient_id=patient_id,
            selected_categories=selected_categories,
            assigned_items=assigned_items,
            clinician_notes="",
        )

    def activate_patient(self, patient_id, email):
        normalized_id = normalize_patient_id(patient_id)
        patient = self._find_patient_entity(normalized_id)
        if not patient:
            raise ValueError("Patient ID not found. Check the ID provided by your clinician.")
        if patient.get("passwordHash"):
            raise ValueError("This patient ID already has an account. Please sign in instead.")
        normalized_email = normalize_email(email)
        if not normalized_email:
            raise ValueError("Email is required.")
        existing_email_patient = self.find_patient_by_email(normalized_email)
        if existing_email_patient and existing_email_patient.get("RowKey") != normalized_id:
            raise ValueError("That email is already being used for another patient account.")
        now = utc_now_iso()
        patient.update(
            {
                "email": normalized_email,
                "updatedAt": now,
            }
        )
        self._patients().upsert_entity(patient, mode=UpdateMode.MERGE)
        token = secrets.token_urlsafe(32)
        patient["resetTokenHash"] = hash_reset_token(token)
        patient["resetTokenExpiresAt"] = (utc_now() + timedelta(minutes=self.reset_password_ttl_minutes)).isoformat()
        patient["updatedAt"] = utc_now_iso()
        self._patients().upsert_entity(patient, mode=UpdateMode.MERGE)
        return {
            "token": token,
            "email": normalized_email,
            "expiresAt": patient["resetTokenExpiresAt"],
        }

    def sign_in_patient(self, email, password, local_date=None):
        patient = self.find_patient_by_email(email)
        if not patient:
            raise ValueError("No patient account matches that email.")
        if not patient.get("passwordHash") or not patient.get("passwordSalt"):
            raise ValueError("This patient account has not been activated yet.")
        if not verify_password(password, patient["passwordSalt"], patient["passwordHash"]):
            raise ValueError("Incorrect password.")
        return self.get_patient_record(patient["RowKey"], local_date=local_date)

    def _repair_shifted_completion(self, patient_id, local_date, patient_entity=None):
        normalized_id = normalize_patient_id(patient_id)
        row_key = normalized_log_date(local_date)
        patient_entity = patient_entity or self._find_patient_entity(normalized_id)
        if not patient_entity or patient_entity.get("lastCompletedOn") != row_key:
            return patient_entity

        progress_client = self._progress()
        try:
            current = progress_client.get_entity(normalized_id, row_key)
        except Exception:
            return patient_entity
        if not current.get("sessionCompletedAt"):
            return patient_entity

        previous_date = (datetime.strptime(row_key, "%Y-%m-%d").date() - timedelta(days=1)).isoformat()
        try:
            previous = progress_client.get_entity(normalized_id, previous_date)
        except Exception:
            return patient_entity
        if previous.get("sessionCompletedAt"):
            return patient_entity

        current_entries = json_loads(current.get("entriesJson", ""), {})
        previous_entries = json_loads(previous.get("entriesJson", ""), {})
        current_has_ratings = any(
            isinstance(entry, dict) and ("pain_after" in entry or "stiffness_after" in entry)
            for entry in current_entries.values()
        )
        previous_has_ratings = any(
            isinstance(entry, dict) and ("pain_after" in entry or "stiffness_after" in entry)
            for entry in previous_entries.values()
        )
        if not previous_entries or current_has_ratings or (current_entries and not previous_has_ratings):
            return patient_entity

        completion_timestamp = current.get("sessionCompletedAt")
        current["sessionCompletedAt"] = ""
        current["updatedAt"] = utc_now_iso()
        previous["sessionCompletedAt"] = completion_timestamp
        previous["updatedAt"] = utc_now_iso()
        progress_client.upsert_entity(current, mode=UpdateMode.REPLACE)
        progress_client.upsert_entity(previous, mode=UpdateMode.REPLACE)
        patient_entity["lastCompletedOn"] = previous_date
        patient_entity["updatedAt"] = utc_now_iso()
        self._patients().upsert_entity(patient_entity, mode=UpdateMode.MERGE)
        return patient_entity

    def get_patient_record(self, patient_id, local_date=None):
        patient_entity = self._find_patient_entity(patient_id)
        if not patient_entity:
            return None

        normalized_id = patient_entity["RowKey"]
        if local_date:
            patient_entity = self._repair_shifted_completion(normalized_id, local_date, patient_entity)
        plan_entity = self._get_plan_entity(normalized_id)
        plan_payload = {
            "selectedCategories": [],
            "assignedItems": [],
            "clinicianNotes": "",
            "createdAt": patient_entity.get("createdAt", ""),
            "updatedAt": patient_entity.get("updatedAt", ""),
            "planVersion": int(patient_entity.get("planVersion", 1) or 1),
        }

        if plan_entity:
            plan_payload = {
                "selectedCategories": json_loads(plan_entity.get("selectedCategoriesJson", ""), []),
                "assignedItems": json_loads(plan_entity.get("assignedItemsJson", ""), []),
                "clinicianNotes": plan_entity.get("clinicianNotes", ""),
                "createdAt": plan_entity.get("createdAt", patient_entity.get("createdAt", "")),
                "updatedAt": plan_entity.get("updatedAt", patient_entity.get("updatedAt", "")),
                "planVersion": int(plan_entity.get("version", 1) or 1),
            }

        progress = self._serialize_progress_summary(patient_entity)
        progress["dailyLogs"] = self.get_daily_logs(normalized_id)

        return {
            "patientId": normalized_id,
            "email": patient_entity.get("email", ""),
            "clinicianId": patient_entity.get("clinicianId", patient_entity["PartitionKey"]),
            "selectedCategories": plan_payload["selectedCategories"],
            "assignedItems": plan_payload["assignedItems"],
            "clinicianNotes": plan_payload["clinicianNotes"],
            "createdAt": plan_payload["createdAt"],
            "updatedAt": plan_payload["updatedAt"],
            "planVersion": plan_payload["planVersion"],
            "accountActivated": bool(patient_entity.get("passwordHash") or patient_entity.get("accountActivated")),
            "activatedAt": patient_entity.get("activatedAt", ""),
            "progress": progress,
        }

    def get_clinician_patients(self, clinician_id):
        entities = self._patients().query_entities(
            query_filter="PartitionKey eq @clinicianId",
            parameters={"clinicianId": clinician_id},
        )
        patients = []
        for entity in entities:
            patients.append(
                {
                    "patientId": entity["RowKey"],
                    "email": entity.get("email", ""),
                    "clinicianId": clinician_id,
                    "completedSessions": int(entity.get("completedSessions", 0) or 0),
                    "streakCount": int(entity.get("streakCount", 0) or 0),
                    "lastCompletedOn": entity.get("lastCompletedOn", ""),
                    "createdAt": entity.get("createdAt", ""),
                    "updatedAt": entity.get("updatedAt", ""),
                    "planVersion": int(entity.get("planVersion", 1) or 1),
                    "accountActivated": bool(entity.get("passwordHash") or entity.get("accountActivated")),
                    "activatedAt": entity.get("activatedAt", ""),
                }
            )

        return sorted(patients, key=lambda item: item.get("updatedAt", ""), reverse=True)

    def get_daily_logs(self, patient_id):
        normalized_id = normalize_patient_id(patient_id)
        entities = self._progress().query_entities(
            query_filter="PartitionKey eq @patientId",
            parameters={"patientId": normalized_id},
        )
        logs = {}
        for entity in entities:
            logs[entity["RowKey"]] = json_loads(entity.get("entriesJson", ""), {})
            if entity.get("sessionCompletedAt"):
                logs[entity["RowKey"]]["sessionCompletedAt"] = entity["sessionCompletedAt"]
        return logs

    def upsert_daily_log(self, patient_id, date, item_id, patch):
        normalized_id = normalize_patient_id(patient_id)
        row_key = normalized_log_date(date)
        self._repair_shifted_completion(normalized_id, row_key)
        progress_client = self._progress()

        existing = None
        try:
            existing = progress_client.get_entity(normalized_id, row_key)
        except Exception:
            existing = None

        if {"pain_after", "stiffness_after"} & set(patch):
            patient_entity = self._find_patient_entity(normalized_id)
            session_is_complete = bool(existing and existing.get("sessionCompletedAt"))
            patient_is_complete = bool(patient_entity and patient_entity.get("lastCompletedOn") == row_key)
            if session_is_complete or patient_is_complete:
                raise ValueError("Today's pain and stiffness ratings have already been submitted.")

        entries = {}
        if existing:
            entries = json_loads(existing.get("entriesJson", ""), {})

        current = entries.get(item_id, {})
        entries[item_id] = {
            **current,
            **patch,
        }

        entity = {
            "PartitionKey": normalized_id,
            "RowKey": row_key,
            "patientId": normalized_id,
            "entriesJson": json_dumps(entries),
            "updatedAt": utc_now_iso(),
            "createdAt": existing.get("createdAt", utc_now_iso()) if existing else utc_now_iso(),
            "sessionCompletedAt": existing.get("sessionCompletedAt", "") if existing else "",
        }
        progress_client.upsert_entity(entity, mode=UpdateMode.REPLACE)
        return entries

    def complete_today_session(self, patient_id, date=None):
        normalized_id = normalize_patient_id(patient_id)
        patient_entity = self._find_patient_entity(normalized_id)
        if not patient_entity:
            raise ValueError("Patient ID not found.")

        today = normalized_log_date(date)
        patient_entity = self._repair_shifted_completion(normalized_id, today, patient_entity)
        if patient_entity.get("lastCompletedOn") == today:
            return self._serialize_progress_summary(patient_entity)

        previous = patient_entity.get("lastCompletedOn", "")
        local_yesterday = (datetime.strptime(today, "%Y-%m-%d").date() - timedelta(days=1)).isoformat()
        next_streak = int(patient_entity.get("streakCount", 0) or 0) + 1 if previous == local_yesterday else 1
        patient_entity["completedSessions"] = int(patient_entity.get("completedSessions", 0) or 0) + 1
        patient_entity["streakCount"] = next_streak
        patient_entity["lastCompletedOn"] = today
        patient_entity["updatedAt"] = utc_now_iso()
        self._patients().upsert_entity(patient_entity, mode=UpdateMode.MERGE)

        progress_client = self._progress()
        existing = None
        try:
            existing = progress_client.get_entity(normalized_id, today)
        except Exception:
            existing = None

        entries = json_loads(existing.get("entriesJson", ""), {}) if existing else {}
        entity = {
            "PartitionKey": normalized_id,
            "RowKey": today,
            "patientId": normalized_id,
            "entriesJson": json_dumps(entries),
            "updatedAt": utc_now_iso(),
            "createdAt": existing.get("createdAt", utc_now_iso()) if existing else utc_now_iso(),
            "sessionCompletedAt": utc_now_iso(),
        }
        progress_client.upsert_entity(entity, mode=UpdateMode.REPLACE)
        return self._serialize_progress_summary(patient_entity)

    def reset_today_progress(self, patient_id, date=None):
        normalized_id = normalize_patient_id(patient_id)
        patient_entity = self._find_patient_entity(normalized_id)
        if not patient_entity:
            raise ValueError("Patient ID not found.")

        local_date = normalized_log_date(date)
        patient_entity = self._repair_shifted_completion(normalized_id, local_date, patient_entity)
        try:
            self._progress().delete_entity(partition_key=normalized_id, row_key=local_date)
        except Exception:
            pass

        remaining = self._progress().query_entities(
            query_filter="PartitionKey eq @patientId",
            parameters={"patientId": normalized_id},
        )
        completed_dates = sorted(
            entity["RowKey"] for entity in remaining if entity.get("sessionCompletedAt")
        )
        streak_count = 0
        if completed_dates:
            streak_count = 1
            for index in range(len(completed_dates) - 1, 0, -1):
                current = datetime.strptime(completed_dates[index], "%Y-%m-%d").date()
                previous = datetime.strptime(completed_dates[index - 1], "%Y-%m-%d").date()
                if (current - previous).days != 1:
                    break
                streak_count += 1

        patient_entity.update(
            {
                "completedSessions": len(completed_dates),
                "streakCount": streak_count,
                "lastCompletedOn": completed_dates[-1] if completed_dates else "",
                "updatedAt": utc_now_iso(),
            }
        )
        self._patients().upsert_entity(patient_entity, mode=UpdateMode.MERGE)
        return self._serialize_progress_summary(patient_entity)

    def get_trend_data(self, patient_id, days=7):
        record = self.get_patient_record(patient_id)
        if not record:
            return []

        assigned_total = len(record.get("assignedItems", []))
        all_logs = record["progress"].get("dailyLogs", {})
        dates = []
        today = utc_now().date()
        for offset in range(days - 1, -1, -1):
            dates.append((today - timedelta(days=offset)).isoformat())

        trend = []
        for date in dates:
            day_log = all_logs.get(date, {})
            entries = [(key, value) for key, value in day_log.items() if key != "sessionCompletedAt"]
            checked_count = sum(1 for _, value in entries if value.get("patient_checkoff"))

            pain_before_values = []
            pain_after_values = []
            stiffness_values = []
            for _, value in entries:
                try:
                    pain_before_values.append(float(value.get("pain_before")))
                except (TypeError, ValueError):
                    pass
                try:
                    pain_after_values.append(float(value.get("pain_after")))
                except (TypeError, ValueError):
                    pass
                try:
                    stiffness_values.append(float(value.get("stiffness_after")))
                except (TypeError, ValueError):
                    pass

            trend.append(
                {
                    "date": date,
                    "completionPercent": round((checked_count / assigned_total) * 100) if assigned_total else 0,
                    "avgPainBefore": round(sum(pain_before_values) / len(pain_before_values), 1)
                    if pain_before_values
                    else "",
                    "avgPainAfter": round(sum(pain_after_values) / len(pain_after_values), 1)
                    if pain_after_values
                    else "",
                    "avgStiffness": round(sum(stiffness_values) / len(stiffness_values), 1)
                    if stiffness_values
                    else "",
                    "checkedCount": checked_count,
                }
            )

        return trend

    def get_patient_analytics(self, patient_id):
        record = self.get_patient_record(patient_id)
        if not record:
            return {}

        all_logs = record["progress"].get("dailyLogs", {})
        daily_pain = []
        monthly_values = {}
        completed_dates = set()
        for log_date, day_log in sorted(all_logs.items()):
            if day_log.get("sessionCompletedAt"):
                completed_dates.add(log_date)
            pain_values = []
            for item_id, item_log in day_log.items():
                if item_id == "sessionCompletedAt" or not isinstance(item_log, dict):
                    continue
                try:
                    pain_values.append(float(item_log.get("pain_after")))
                except (TypeError, ValueError):
                    pass
            if pain_values and day_log.get("sessionCompletedAt"):
                average_pain = round(sum(pain_values) / len(pain_values), 1)
                daily_pain.append({"date": log_date, "pain": average_pain})
                monthly_values.setdefault(log_date[:7], []).append(average_pain)

        monthly_pain = [
            {
                "month": month,
                "averagePain": round(sum(values) / len(values), 1),
                "reportedDays": len(values),
            }
            for month, values in sorted(monthly_values.items())
        ]
        trend = pain_linear_regression([entry["pain"] for entry in daily_pain])

        weekly_target = 7
        today = utc_now().date()
        created_at = record.get("createdAt", "")
        try:
            start_date = datetime.fromisoformat(created_at.replace("Z", "+00:00")).date()
        except (TypeError, ValueError):
            start_date = datetime.strptime(min(all_logs.keys()), "%Y-%m-%d").date() if all_logs else today

        current_week_start = today - timedelta(days=today.weekday())
        first_full_week = start_date if start_date.weekday() == 0 else start_date + timedelta(days=7 - start_date.weekday())
        full_week_counts = []
        week_start = first_full_week
        while week_start < current_week_start:
            week_end = week_start + timedelta(days=6)
            count = sum(1 for value in completed_dates if week_start <= datetime.strptime(value, "%Y-%m-%d").date() <= week_end)
            full_week_counts.append(count)
            week_start += timedelta(days=7)

        current_week_count = sum(
            1 for value in completed_dates
            if current_week_start <= datetime.strptime(value, "%Y-%m-%d").date() <= today
        )
        weeks_meeting_goal = sum(1 for count in full_week_counts if count >= weekly_target)
        weeks_below_goal = sum(1 for count in full_week_counts if count < weekly_target)
        adherence_percent = (
            round(sum(min(count, weekly_target) for count in full_week_counts) / (weekly_target * len(full_week_counts)) * 100)
            if full_week_counts
            else ""
        )

        return {
            "dailyPain": daily_pain,
            "monthlyPain": monthly_pain,
            "painTrend": trend,
            "adherence": {
                "weeklyTarget": weekly_target,
                "currentWeekCompleted": current_week_count,
                "weeksEvaluated": len(full_week_counts),
                "weeksMeetingGoal": weeks_meeting_goal,
                "weeksBelowGoal": weeks_below_goal,
                "overallPercent": adherence_percent,
            },
        }
