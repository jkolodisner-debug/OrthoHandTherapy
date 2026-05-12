import base64
import hashlib
import json
import os
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


def normalize_patient_id(value):
    return (value or "").strip().upper()


def new_clinician_id():
    return f"cln_{secrets.token_hex(8)}"


def new_patient_id():
    return f"HND-{secrets.token_hex(3).upper()}"


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


class TableBackedAppStore:
    def __init__(self):
        connection_string = os.getenv("STORAGE_CONNECTION_STRING", "").strip()
        if not connection_string:
            raise RuntimeError("Missing STORAGE_CONNECTION_STRING environment variable.")

        self.service = TableServiceClient.from_connection_string(connection_string)
        self.clinicians_table = os.getenv("CLINICIANS_TABLE", "Clinicians")
        self.patients_table = os.getenv("PATIENTS_TABLE", "Patients")
        self.plans_table = os.getenv("PLANS_TABLE", "Plans")
        self.progress_table = os.getenv("PROGRESS_TABLE", "ProgressLogs")
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

    def create_clinician(self, first_name, last_name, email, password):
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
            "createdAt": now,
            "updatedAt": now,
        }

    def save_patient_plan(self, clinician_id, selected_categories, assigned_items, clinician_notes, patient_id=""):
        normalized_patient_id = normalize_patient_id(patient_id) or new_patient_id()
        existing_patient = self._find_patient_entity(normalized_patient_id)
        plan_version = 1

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
            "assignedItemsJson": json_dumps(assigned_items),
            "clinicianNotes": clinician_notes or "",
            "createdAt": plan_entity.get("createdAt", now) if plan_entity else now,
            "updatedAt": now,
            "version": plan_version,
        }
        self._plans().upsert_entity(next_plan, mode=UpdateMode.REPLACE)
        return self.get_patient_record(normalized_patient_id)

    def get_patient_record(self, patient_id):
        patient_entity = self._find_patient_entity(patient_id)
        if not patient_entity:
            return None

        normalized_id = patient_entity["RowKey"]
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
            "clinicianId": patient_entity.get("clinicianId", patient_entity["PartitionKey"]),
            "selectedCategories": plan_payload["selectedCategories"],
            "assignedItems": plan_payload["assignedItems"],
            "clinicianNotes": plan_payload["clinicianNotes"],
            "createdAt": plan_payload["createdAt"],
            "updatedAt": plan_payload["updatedAt"],
            "planVersion": plan_payload["planVersion"],
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
                    "clinicianId": clinician_id,
                    "completedSessions": int(entity.get("completedSessions", 0) or 0),
                    "streakCount": int(entity.get("streakCount", 0) or 0),
                    "lastCompletedOn": entity.get("lastCompletedOn", ""),
                    "updatedAt": entity.get("updatedAt", ""),
                    "planVersion": int(entity.get("planVersion", 1) or 1),
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
        row_key = date or today_iso()
        progress_client = self._progress()

        existing = None
        try:
            existing = progress_client.get_entity(normalized_id, row_key)
        except Exception:
            existing = None

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

    def complete_today_session(self, patient_id):
        normalized_id = normalize_patient_id(patient_id)
        patient_entity = self._find_patient_entity(normalized_id)
        if not patient_entity:
            raise ValueError("Patient ID not found.")

        today = today_iso()
        if patient_entity.get("lastCompletedOn") == today:
            return self._serialize_progress_summary(patient_entity)

        previous = patient_entity.get("lastCompletedOn", "")
        next_streak = int(patient_entity.get("streakCount", 0) or 0) + 1 if previous == yesterday_iso() else 1
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
            for _, value in entries:
                try:
                    pain_before_values.append(float(value.get("pain_before")))
                except (TypeError, ValueError):
                    pass
                try:
                    pain_after_values.append(float(value.get("pain_after")))
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
                    "checkedCount": checked_count,
                }
            )

        return trend
