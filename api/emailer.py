import os
from urllib.parse import quote

from azure.communication.email import EmailClient


def _required_env(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing {name} environment variable.")
    return value


def _send_reset_email(recipient_email, token, role_label):
    connection_string = _required_env("AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING")
    sender = _required_env("ACS_EMAIL_SENDER")
    frontend_base_url = os.getenv(
        "FRONTEND_BASE_URL",
        "https://victorious-forest-016e84e10.7.azurestaticapps.net",
    ).strip().rstrip("/")
    if not frontend_base_url:
        raise RuntimeError("Missing FRONTEND_BASE_URL environment variable.")

    reset_link = f"{frontend_base_url}/forgot-password.html?token={quote(token)}&role={quote(role_label)}"
    subject = f"Reset your Online Hand Recovery {role_label} password"
    plain_text = (
        f"A request was received to reset your {role_label} password for Online Hand Recovery.\n\n"
        f"Open this link to choose a new password: {reset_link}\n\n"
        "This link expires soon. If you did not request a password reset, you can ignore this email."
    )
    html = (
        "<html><body style='font-family: Arial, sans-serif; color: #102a43;'>"
        "<h2>Reset your clinician password</h2>"
        f"<p>A request was received to reset your {role_label} password for Online Hand Recovery.</p>"
        f"<p><a href='{reset_link}' style='display:inline-block;padding:12px 18px;"
        "background:#ab0520;color:#ffffff;text-decoration:none;border-radius:8px;'>Choose a new password</a></p>"
        f"<p>If the button does not open, copy and paste this link into your browser:<br>{reset_link}</p>"
        "<p>This link expires soon. If you did not request a password reset, you can ignore this email.</p>"
        "</body></html>"
    )

    client = EmailClient.from_connection_string(connection_string)
    poller = client.begin_send(
        {
            "senderAddress": sender,
            "recipients": {"to": [{"address": recipient_email}]},
            "content": {
                "subject": subject,
                "plainText": plain_text,
                "html": html,
            },
        }
    )
    poller.result()


def send_clinician_reset_email(recipient_email, token):
    _send_reset_email(recipient_email, token, "clinician")


def send_patient_reset_email(recipient_email, token):
    _send_reset_email(recipient_email, token, "patient")
