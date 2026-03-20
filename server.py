import hashlib
import hmac
import json
import secrets
import sqlite3
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "users.db"
ITERATIONS = 200_000


def get_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                selected_plan TEXT DEFAULT 'knee',
                completed_sessions INTEGER NOT NULL DEFAULT 0,
                streak_count INTEGER NOT NULL DEFAULT 0,
                last_completed_on TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(users)").fetchall()
        }
        migrations = [
            ("selected_plan", "ALTER TABLE users ADD COLUMN selected_plan TEXT DEFAULT 'knee'"),
            ("completed_sessions", "ALTER TABLE users ADD COLUMN completed_sessions INTEGER NOT NULL DEFAULT 0"),
            ("streak_count", "ALTER TABLE users ADD COLUMN streak_count INTEGER NOT NULL DEFAULT 0"),
            ("last_completed_on", "ALTER TABLE users ADD COLUMN last_completed_on TEXT"),
        ]

        for column_name, statement in migrations:
            if column_name not in columns:
                connection.execute(statement)

        connection.commit()


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        ITERATIONS,
    ).hex()
    return salt, password_hash


def verify_password(password, salt, password_hash):
    _, computed_hash = hash_password(password, salt=salt)
    return hmac.compare_digest(computed_hash, password_hash)


def serialize_user(user_row):
    today = date.today().isoformat()
    last_completed_on = user_row["last_completed_on"]
    return {
        "id": user_row["id"],
        "name": user_row["name"],
        "email": user_row["email"],
        "selectedPlan": user_row["selected_plan"] or "knee",
        "completedSessions": user_row["completed_sessions"] or 0,
        "streakCount": user_row["streak_count"] or 0,
        "lastCompletedOn": last_completed_on,
        "completedToday": last_completed_on == today,
    }


def fetch_user(connection, user_id):
    return connection.execute(
        """
        SELECT id, name, email, selected_plan, completed_sessions, streak_count, last_completed_on
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status_code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b"{}"
        return json.loads(raw_body.decode("utf-8"))

    def do_POST(self):
        if self.path == "/api/signup":
            self.handle_signup()
            return

        if self.path == "/api/login":
            self.handle_login()
            return

        if self.path == "/api/select-plan":
            self.handle_select_plan()
            return

        if self.path == "/api/complete-session":
            self.handle_complete_session()
            return

        self.send_json(404, {"error": "Route not found."})

    def handle_signup(self):
        try:
            payload = self.read_json_body()
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Invalid JSON body."})
            return

        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))

        if not name or not email or not password:
            self.send_json(400, {"error": "Name, email, and password are required."})
            return

        if len(password) < 8:
            self.send_json(400, {"error": "Password must be at least 8 characters."})
            return

        salt, password_hash = hash_password(password)

        try:
            with get_db() as connection:
                existing_user = connection.execute(
                    """
                    SELECT id
                    FROM users
                    WHERE lower(email) = ? OR lower(name) = ?
                    """,
                    (email.lower(), name.lower()),
                ).fetchone()

                if existing_user:
                    self.send_json(409, {"error": "That username or email is already in use."})
                    return

                cursor = connection.execute(
                    """
                    INSERT INTO users (name, email, password_hash, password_salt)
                    VALUES (?, ?, ?, ?)
                    """,
                    (name, email, password_hash, salt),
                )
                connection.commit()
                user_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "An account with that email already exists."})
            return

        self.send_json(
            201,
            {
                "user": serialize_user(
                    {
                        "id": user_id,
                        "name": name,
                        "email": email,
                        "selected_plan": "knee",
                        "completed_sessions": 0,
                        "streak_count": 0,
                        "last_completed_on": None,
                    }
                )
            },
        )

    def handle_login(self):
        try:
            payload = self.read_json_body()
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Invalid JSON body."})
            return

        identifier = str(payload.get("identifier", "")).strip().lower()
        password = str(payload.get("password", ""))

        if not identifier or not password:
            self.send_json(400, {"error": "Username or email and password are required."})
            return

        with get_db() as connection:
            user = connection.execute(
                """
                SELECT id, name, email, password_hash, password_salt, selected_plan, completed_sessions, streak_count, last_completed_on
                FROM users
                WHERE lower(email) = ? OR lower(name) = ?
                """,
                (identifier, identifier),
            ).fetchone()

        if not user or not verify_password(password, user["password_salt"], user["password_hash"]):
            self.send_json(401, {"error": "Incorrect username, email, or password."})
            return

        self.send_json(
            200,
            {
                "user": serialize_user(user)
            },
        )

    def handle_select_plan(self):
        try:
            payload = self.read_json_body()
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Invalid JSON body."})
            return

        user_id = payload.get("userId")
        plan_id = str(payload.get("planId", "")).strip()

        if not user_id or not plan_id:
            self.send_json(400, {"error": "User and plan are required."})
            return

        with get_db() as connection:
            connection.execute(
                "UPDATE users SET selected_plan = ? WHERE id = ?",
                (plan_id, user_id),
            )
            connection.commit()
            user = fetch_user(connection, user_id)

        if not user:
            self.send_json(404, {"error": "User not found."})
            return

        self.send_json(200, {"user": serialize_user(user)})

    def handle_complete_session(self):
        try:
            payload = self.read_json_body()
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Invalid JSON body."})
            return

        user_id = payload.get("userId")

        if not user_id:
            self.send_json(400, {"error": "User is required."})
            return

        today = date.today().isoformat()

        with get_db() as connection:
            user = fetch_user(connection, user_id)

            if not user:
                self.send_json(404, {"error": "User not found."})
                return

            completed_sessions = user["completed_sessions"] or 0
            streak_count = user["streak_count"] or 0
            last_completed_on = user["last_completed_on"]

            if last_completed_on != today:
                completed_sessions += 1
                streak_count += 1
                connection.execute(
                    """
                    UPDATE users
                    SET completed_sessions = ?, streak_count = ?, last_completed_on = ?
                    WHERE id = ?
                    """,
                    (completed_sessions, streak_count, today, user_id),
                )
                connection.commit()

            updated_user = fetch_user(connection, user_id)

        self.send_json(200, {"user": serialize_user(updated_user)})


def main():
    init_db()
    server = ThreadingHTTPServer(("127.0.0.1", 8000), AppHandler)
    print("Serving OrthoMotion at http://127.0.0.1:8000")
    server.serve_forever()


if __name__ == "__main__":
    main()
