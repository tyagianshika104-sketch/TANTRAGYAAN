from __future__ import annotations
import json
import logging
import re
import threading
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import Any, Dict, List

from flask import Flask, jsonify, redirect, render_template, request, session, Response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from config import (
    FIREBASE_WEB_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID,
    HIGH_SCORE_THRESHOLD, APP_DEBUG, APP_HOST, APP_PORT, setup_logging,
)
from database import (
    init_db, verify_firebase_token, get_user_profile, save_user_profile,
    get_user_startups, get_user_applications, insert_user_application,
    insert_user_startups,
)

app = Flask(__name__)
# SECRET_KEY is required for Flask session signing; generate one if not in env
import os as _os
app.secret_key = _os.environ.get("FLASK_SECRET_KEY") or _os.urandom(32)
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"]
)

cache = Cache(config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 60})
cache.init_app(app)

setup_logging()
logger = logging.getLogger(__name__)
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads" / "cvs"
ALLOWED_CV_EXTENSIONS = {".pdf", ".doc", ".docx"}
LOCAL_USERS_PATH = Path(__file__).resolve().parent / "instance" / "users.json"

_status: Dict[str, Any] = {
    "running": False, "last_run": None, "last_count": 0,
    "message": "Click 'Run Pipeline' to scrape latest startups",
    "logs": [],
}
_status_lock = threading.Lock()
_demo_profiles: Dict[str, Dict[str, Any]] = {}
_demo_applications: Dict[str, List[Dict[str, Any]]] = {}
_local_startups: Dict[str, List[Dict[str, Any]]] = {}


def _is_local_user(uid: str) -> bool:
    return uid == "demo-user" or uid.startswith("local-")


def _local_uid(email: str) -> str:
    return f"local-{email.replace('@', '-at-').replace('.', '-')}"


def _read_local_users() -> Dict[str, Dict[str, Any]]:
    if not LOCAL_USERS_PATH.exists():
        return {}
    try:
        with LOCAL_USERS_PATH.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.warning("Could not read local users: %s", exc)
        return {}


def _write_local_users(users: Dict[str, Dict[str, Any]]) -> None:
    LOCAL_USERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOCAL_USERS_PATH.open("w", encoding="utf-8") as handle:
        json.dump(users, handle, indent=2, sort_keys=True)


def _public_user(account: Dict[str, Any]) -> Dict[str, str]:
    return {
        "uid": str(account.get("uid", "")),
        "email": str(account.get("email", "")),
        "name": str(account.get("name", "")),
        "picture": str(account.get("picture", "")),
    }


def _valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def _status_update(message: str) -> None:
    with _status_lock:
        _status["message"] = message
        logs = list(_status.get("logs") or [])
        logs.append({"time": datetime.now().strftime("%H:%M:%S"), "message": message})
        _status["logs"] = logs[-40:]


def _default_local_profile(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
        "created_at": _utc_iso(),
        "skills": "Python, React, APIs",
        "degree": "Engineering",
        "cgpa": "8.2",
        "year": "Final year",
        "experience": "full-stack projects",
        "location": "India",
        "github": "",
        "linkedin": "",
        "leetcode": "",
        "resume_link": "",
        "cv_filename": "",
        "cv_path": "",
        "certificates": "",
        "role_target": "Software Engineer",
        "notice_period": "Immediately",
        "expected_ctc": "",
    }


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_payload() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _allowed_cv(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_CV_EXTENSIONS


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found"}), 404
    if request.host.startswith(("127.0.0.1:5000", "localhost:5000")):
        return redirect(f"http://127.0.0.1:5173{request.path}", code=302)
    return render_template("dashboard.html"), 404


@app.errorhandler(Exception)
def server_error(error):
    logger.exception("Unhandled request error on %s: %s", request.path, error)
    if request.path.startswith("/api/"):
        return jsonify({"error": "Internal server error"}), 500
    return render_template("dashboard.html"), 500


def _require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        user = {}
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            user = verify_firebase_token(token)
        if not user or not user.get("uid"):
            session_user = session.get("user") or {}
            if session_user.get("uid"):
                logger.warning(
                    "_require_auth: using Flask session fallback for %s",
                    request.path,
                )
                user = session_user
        if not user or not user.get("uid"):
            return jsonify({"error": "Invalid or expired token"}), 401
        request.user = user
        return f(*args, **kwargs)
    return decorated


@app.route("/")
def index():
    if request.host.startswith(("127.0.0.1:5000", "localhost:5000")):
        return redirect("http://127.0.0.1:5173/", code=302)
    return render_template("dashboard.html")


@app.route("/api/firebase-config")
def firebase_config():
    return jsonify({
        "apiKey": FIREBASE_WEB_API_KEY,
        "authDomain": FIREBASE_AUTH_DOMAIN,
        "projectId": FIREBASE_PROJECT_ID,
        "storageBucket": FIREBASE_STORAGE_BUCKET,
        "messagingSenderId": FIREBASE_MESSAGING_SENDER_ID,
        "appId": FIREBASE_APP_ID,
    })


@app.route("/api/auth/verify", methods=["POST"])
def auth_verify():
    data = _json_payload()
    token = data.get("idToken", "")
    if not token:
        logger.warning("auth_verify: missing idToken")
        return jsonify({"error": "No token"}), 400
    user = verify_firebase_token(token)
    if not user or not user.get("uid"):
        logger.warning("auth_verify: Firebase token verification failed")
        return jsonify({
            "error": "Could not verify sign-in. "
                     "Check that FIREBASE_CREDENTIALS_PATH is correct in .env "
                     "and that firebase_credentials.json exists."
        }), 401
    uid = user["uid"]
    existing = get_user_profile(uid)
    if not existing:
        created_profile = {
            "email": user.get("email", ""),
            "name": user.get("name", ""),
            "picture": user.get("picture", ""),
            "created_at": _utc_iso(),
            "skills": "", "degree": "", "cgpa": "", "year": "",
            "experience": "", "location": "", "github": "",
            "linkedin": "", "leetcode": "", "resume_link": "",
            "cv_filename": "", "cv_path": "",
            "certificates": "", "role_target": "", "notice_period": "",
            "expected_ctc": "",
        }
        if not save_user_profile(uid, created_profile):
            logger.warning("auth_verify: profile save failed for uid=%s", uid)
            existing = created_profile
    profile = get_user_profile(uid) or existing or {}
    session["user"] = user
    session.permanent = True
    logger.info("auth_verify: verified Firebase user uid=%s email=%s", uid, user.get("email", ""))
    return jsonify({"user": user, "profile": profile})


@app.route("/api/auth/demo", methods=["POST"])
def auth_demo():
    """Create a local demo session for the Vite frontend when Firebase auth is not wired."""
    user = {
        "uid": "demo-user",
        "email": "arjun@example.com",
        "name": "Arjun Sharma",
        "picture": "",
    }
    existing = _demo_profiles.get(user["uid"]) or get_user_profile(user["uid"])
    if not existing:
        existing = _default_local_profile(user)
        if not save_user_profile(user["uid"], existing):
            _demo_profiles[user["uid"]] = existing
    session["user"] = user
    session.permanent = True
    return jsonify({"user": user, "profile": existing})


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = _json_payload()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    users = _read_local_users()
    account = users.get(email)
    if not account or not check_password_hash(str(account.get("password_hash", "")), password):
        return jsonify({"error": "Invalid email or password"}), 401

    user = _public_user(account)
    uid = user["uid"]
    existing = _demo_profiles.get(uid)
    if not existing:
        existing = _default_local_profile(user)
        _demo_profiles[uid] = existing

    session["user"] = user
    session.permanent = True
    return jsonify({"user": user, "profile": existing})


@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    data = _json_payload()
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400
    if not _valid_email(email):
        return jsonify({"error": "Enter a valid email address"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    users = _read_local_users()
    if email in users:
        return jsonify({"error": "An account with this email already exists"}), 409

    user = {
        "uid": _local_uid(email),
        "email": email,
        "name": name,
        "picture": "",
    }
    users[email] = {
        **user,
        "password_hash": generate_password_hash(password),
        "created_at": _utc_iso(),
    }
    _write_local_users(users)

    profile = _default_local_profile(user)
    _demo_profiles[user["uid"]] = profile
    session["user"] = user
    session.permanent = True
    return jsonify({"user": user, "profile": profile}), 201


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.pop("user", None)
    return jsonify({"ok": True})


@app.route("/api/profile", methods=["GET"])
@_require_auth
def api_profile():
    uid = request.user["uid"]
    profile = _demo_profiles.get(uid, {}) if _is_local_user(uid) else get_user_profile(uid) or {}
    return jsonify({**request.user, **profile})


@app.route("/api/profile", methods=["PUT"])
@_require_auth
def api_update_profile():
    uid = request.user["uid"]
    data = _json_payload()
    allowed_fields = [
        "name", "degree", "cgpa", "year", "skills", "experience",
        "location", "github", "linkedin", "leetcode", "resume_link",
        "certificates", "role_target", "notice_period", "expected_ctc",
    ]
    update = {k: v for k, v in data.items() if k in allowed_fields}
    if update:
        if _is_local_user(uid):
            _demo_profiles[uid] = {**_demo_profiles.get(uid, {}), **update}
        elif not save_user_profile(uid, update):
            _demo_profiles[uid] = {**_demo_profiles.get(uid, {}), **update}
    return jsonify({"ok": True})


@app.route("/api/profile/cv", methods=["POST"])
@_require_auth
def api_upload_cv():
    uid = request.user["uid"]
    file = request.files.get("cv")
    if not file or not file.filename:
        return jsonify({"ok": False, "error": "No CV file uploaded"}), 400
    if not _allowed_cv(file.filename):
        return jsonify({"ok": False, "error": "Upload a PDF, DOC, or DOCX file"}), 400

    safe_name = secure_filename(file.filename)
    filename = f"{uid}_{int(datetime.now(timezone.utc).timestamp())}_{safe_name}"
    
    from agents.ibm_cos import is_cos_configured, upload_file_object
    
    if is_cos_configured():
        file_obj = file.stream
        cos_filename = upload_file_object(file_obj, filename, content_type=file.content_type or "application/pdf")
        if cos_filename:
            update = {
                "cv_filename": cos_filename,
                "cv_path": f"cos://{cos_filename}",
                "resume_link": f"cos://{cos_filename}",
            }
        else:
            return jsonify({"ok": False, "error": "Failed to upload to IBM COS"}), 500
    else:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        path = UPLOAD_DIR / filename
        file.save(path)
        update = {
            "cv_filename": safe_name,
            "cv_path": str(path),
            "resume_link": str(path),
        }
    if _is_local_user(uid):
        _demo_profiles[uid] = {**_demo_profiles.get(uid, {}), **update}
    elif not save_user_profile(uid, update):
        _demo_profiles[uid] = {**_demo_profiles.get(uid, {}), **update}
    return jsonify({"ok": True, **update})


@app.route("/api/cv-score", methods=["POST"])
@_require_auth
@limiter.limit("10 per minute")
def api_cv_score():
    uid = request.user["uid"]
    profile = _demo_profiles.get(uid, {}) if _is_local_user(uid) else get_user_profile(uid) or {}
    cv_path = profile.get("cv_path")
    if not cv_path:
        return jsonify({"ok": False, "error": "No valid CV found. Please upload one first."}), 400
    actual_path = cv_path
    if cv_path.startswith("cos://"):
        from agents.ibm_cos import download_to_temp_file
        fname = cv_path.replace("cos://", "")
        actual_path = download_to_temp_file(fname)
        if not actual_path:
            return jsonify({"ok": False, "error": "Failed to retrieve CV from IBM COS"}), 500
    elif not Path(actual_path).exists():
        return jsonify({"ok": False, "error": "No valid CV found locally. Please upload again."}), 400
    try:
        from agents.cv_scorer import score_cv
        result = score_cv(cv_path=actual_path, startup_sector="General Tech", user_profile=profile)
        return jsonify({"ok": True, "result": result})
    except Exception as e:
        logger.error(f"CV Scoring failed: {e}")
        return jsonify({"ok": False, "error": "CV Scoring failed"}), 500


@app.route("/api/startups")
@_require_auth
@cache.cached(timeout=60, query_string=True)
def api_startups():
    uid = request.user["uid"]
    startups = _local_startups.get(uid, []) if _is_local_user(uid) else get_user_startups(uid)
    if not startups and not _is_local_user(uid):
        startups = _get_demo_startups()
    return jsonify({"startups": startups, "threshold": HIGH_SCORE_THRESHOLD, "status": _status})


@app.route("/api/run", methods=["POST"])
@_require_auth
def api_run():
    if _status["running"]:
        return jsonify({"ok": False, "message": "Already running"})
    uid = request.user["uid"]
    threading.Thread(target=_run_pipeline_bg, args=(uid,), daemon=True).start()
    return jsonify({"ok": True, "message": "Pipeline started"})


@app.route("/api/copilot/ask", methods=["POST"])
@_require_auth
@limiter.limit("5 per minute")
def api_copilot_ask():
    uid = request.user["uid"]
    data = _json_payload()
    query = data.get("query", "")
    if not query or len(query) > 500:
        return jsonify({"ok": False, "error": "Query is required (max 500 chars)"}), 400
    profile = _demo_profiles.get(uid, {}) if _is_local_user(uid) else get_user_profile(uid) or {}
    startups = _local_startups.get(uid, []) if _is_local_user(uid) else get_user_startups(uid)
    if not startups and not _is_local_user(uid):
        startups = _get_demo_startups()
    try:
        from agents.copilot import ask_copilot
        response = ask_copilot(query, profile, startups)
        return jsonify({"ok": True, "response": response})
    except Exception as e:
        logger.error(f"Copilot error: {e}")
        return jsonify({"ok": False, "error": "Failed to get AI response"}), 500


@app.route("/api/health")
def api_health():
    from agents.ibm_watsonx import is_watsonx_configured
    from agents.ibm_nlu import is_nlu_configured
    from agents.ibm_cos import is_cos_configured
    from agents.ibm_tts import is_tts_configured
    from agents.ibm_stt import is_stt_configured
    from database import _get_cloudant_client
    return jsonify({
        "status": "ok",
        "watsonx": is_watsonx_configured(),
        "nlu": is_nlu_configured(),
        "cos": is_cos_configured(),
        "tts": is_tts_configured(),
        "stt": is_stt_configured(),
        "cloudant": _get_cloudant_client() is not None,
        "timestamp": _utc_iso(),
    })


@app.route("/api/tts/startup", methods=["POST"])
@_require_auth
@limiter.limit("10 per minute")
def api_tts_startup():
    data = _json_payload()
    text = data.get("text", "")
    if not text:
        return jsonify({"ok": False, "error": "Text is required"}), 400
    try:
        from agents.ibm_tts import text_to_speech
        audio = text_to_speech(text[:500])
        if audio:
            return Response(audio, mimetype="audio/mp3")
        return jsonify({"ok": False, "error": "TTS not configured or failed"}), 503
    except Exception as e:
        logger.error(f"TTS error: {e}")
        return jsonify({"ok": False, "error": "TTS failed"}), 500


@app.route("/api/stt/transcribe", methods=["POST"])
@_require_auth
@limiter.limit("10 per minute")
def api_stt_transcribe():
    audio_file = request.files.get("audio")
    if not audio_file:
        return jsonify({"ok": False, "error": "Audio file required"}), 400
    try:
        from agents.ibm_stt import transcribe_audio
        audio_bytes = audio_file.read()
        content_type = audio_file.content_type or "audio/webm"
        transcript = transcribe_audio(audio_bytes, content_type)
        if transcript:
            return jsonify({"ok": True, "transcript": transcript})
        return jsonify({"ok": False, "error": "STT not configured or failed"}), 503
    except Exception as e:
        logger.error(f"STT error: {e}")
        return jsonify({"ok": False, "error": "STT failed"}), 500


@app.route("/api/status")
def api_status():
    return jsonify(_status)


@app.route("/api/stream")
def api_stream():
    import time as _time
    def generate():
        last_state = None
        iterations = 0
        while iterations < 300:
            with _status_lock:
                current_state = {
                    "running": _status["running"],
                    "message": _status["message"],
                    "logs": _status["logs"],
                    "last_count": _status["last_count"],
                    "last_run": _status["last_run"],
                }
            if current_state != last_state:
                yield f"data: {json.dumps(current_state)}\n\n"
                last_state = current_state
            _time.sleep(1)
            iterations += 1
        yield f'data: {json.dumps({"type": "timeout"})}\n\n'
    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/apply", methods=["POST"])
@_require_auth
def api_apply():
    uid = request.user["uid"]
    data = _json_payload()
    name = data.get("name", "")
    startups = _local_startups.get(uid, []) if _is_local_user(uid) else get_user_startups(uid)
    startups = startups or ([] if _is_local_user(uid) else _get_demo_startups())
    startup = next((s for s in startups if s.get("name") == name), None)
    if not startup:
        return jsonify({"ok": False, "error": "Startup not found"}), 404
    try:
        from agents.email_drafter import draft_cold_email
        from profiles.profile_matcher import get_best_profile
        from utils.cgpa_handler import get_cgpa_strategy
        profile = _demo_profiles.get(uid, {}) if _is_local_user(uid) else get_user_profile(uid) or {}
        profile_dict = get_best_profile(startup.get("sector", ""))
        cgpa_raw = profile.get("cgpa", "0") or "0"
        try:
            cgpa_val = float(cgpa_raw)
        except ValueError:
            cgpa_val = 0.0
        cgpa_strategy = get_cgpa_strategy(cgpa_val)
        result = draft_cold_email(startup, {
            "name": profile.get("name", ""),
            "degree": profile.get("degree", ""),
            "cgpa": profile.get("cgpa", ""),
            "year": profile.get("year", ""),
            "skills": profile.get("skills", ""),
            "experience": profile.get("experience", ""),
            "role_target": profile.get("role_target", ""),
            "location": profile.get("location", ""),
            "github": profile.get("github", ""),
            "linkedin": profile.get("linkedin", ""),
            "resume_link": profile.get("resume_link", ""),
            "certificates": profile.get("certificates", ""),
            "notice_period": profile.get("notice_period", ""),
            "expected_ctc": profile.get("expected_ctc", ""),
            "cgpa_strategy": cgpa_strategy.get("strategy", "medium"),
            "best_role": profile_dict.get("role", "Software Engineer"),
        })
        subject = result.get("subject", "")
        body = result.get("body", "")
        if subject and body:
            return jsonify({
                "ok": True,
                "subject": subject,
                "body": body,
                "ai": bool(result.get("generated_with_ai")),
            })
    except Exception as e:
        logger.warning("AI drafter failed: %s", e)
    profile = _demo_profiles.get(uid, {}) if _is_local_user(uid) else get_user_profile(uid) or {}
    subject, body = _build_email_fallback(startup, profile)
    return jsonify({"ok": True, "subject": subject, "body": body, "ai": False})


@app.route("/api/mark-applied", methods=["POST"])
@_require_auth
def api_mark_applied():
    uid = request.user["uid"]
    data = _json_payload()
    startup_name = data.get("name", "")
    subject = data.get("subject", "")
    if not startup_name:
        return jsonify({"ok": False, "error": "Name required"}), 400
    profile = _demo_profiles.get(uid, {}) if _is_local_user(uid) else get_user_profile(uid) or {}
    application = {
        "startup_name": startup_name,
        "profile_used": profile.get("role_target", ""),
        "email_subject": subject or f"Application for {startup_name}",
        "notes": f"Applied from dashboard at {datetime.now().isoformat()}",
    }
    if _is_local_user(uid) or not insert_user_application(uid, application):
        app = {
            **application,
            "id": f"demo-{len(_demo_applications.get(uid, [])) + 1}",
            "applied_date": _utc_iso(),
            "status": "APPLIED",
        }
        _demo_applications.setdefault(uid, []).insert(0, app)
    return jsonify({"ok": True})


@app.route("/api/applications")
@_require_auth
def api_applications():
    uid = request.user["uid"]
    apps = _demo_applications.get(uid, []) if _is_local_user(uid) else get_user_applications(uid) or _demo_applications.get(uid, [])
    return jsonify({"applications": apps})


@app.route("/api/history")
@_require_auth
def api_history():
    uid = request.user["uid"]
    apps = _demo_applications.get(uid, []) if _is_local_user(uid) else get_user_applications(uid) or _demo_applications.get(uid, [])
    startups = _local_startups.get(uid, []) if _is_local_user(uid) else get_user_startups(uid)
    startups = startups or ([] if _is_local_user(uid) else _get_demo_startups())
    scores = [int(s.get("score") or 0) for s in startups if s.get("score")]
    avg_score = int(round(sum(scores) / len(scores))) if scores else 0
    latest = startups[0] if startups else {}
    return jsonify({
        "applications": apps,
        "cv_summary": {
            "latest_score": latest.get("score"),
            "latest_grade": latest.get("confidence", ""),
            "latest_verdict": latest.get("cv_verdict", ""),
            "avg_score": avg_score,
            "scored_count": len(scores),
            "latest_missing_skills": latest.get("cv_missing_skills", []),
        },
    })


def _run_pipeline_bg(uid: str):
    with _status_lock:
        _status["running"] = True
        _status["logs"] = []
    _status_update("Starting live pipeline")
    _status_update("Scraping 5 sources...")
    try:
        from main import run_pipeline
        records = run_pipeline(send_digest=False, allow_demo=False)
        records = sorted(records, key=lambda item: int(item.get("score") or 0), reverse=True)
        if _is_local_user(uid):
            _local_startups[uid] = records
        elif records:
            insert_user_startups(uid, records)
        _status["last_count"] = len(records)
        _status["last_run"] = datetime.now().strftime("%d %b %Y %I:%M %p")
        if records:
            _status_update(f"Done - {len(records)} live startups processed")
        else:
            _status_update("Done - no live startups found from sources")
    except Exception as exc:
        logger.exception("Pipeline error: %s", exc)
        _status_update(f"Pipeline error: {exc}")
        _status["last_run"] = datetime.now().strftime("%d %b %Y %I:%M %p")
    finally:
        _status["running"] = False


def _build_email_fallback(startup: dict, profile: dict) -> tuple:
    import re
    name = profile.get("name", "Candidate")
    degree = profile.get("degree", "Engineering")
    skills = profile.get("skills", "Python")
    experience = profile.get("experience", "projects")
    location = profile.get("location", "India")
    github = profile.get("github", "")
    linkedin = profile.get("linkedin", "")
    resume = profile.get("resume_link", "")
    role = startup.get("role_match", "Software Engineer")
    notice = profile.get("notice_period", "Immediately")
    ctc = profile.get("expected_ctc", "")
    s_name = startup.get("name", "your company")
    amount_cr = float(startup.get("amount_inr") or 0) / 10_000_000
    round_type = startup.get("round_type", "funding")
    sector = startup.get("sector", "")
    what = startup.get("summary_what", f"your work in {sector}")
    why = startup.get("summary_why", "Fresh funding means team growth.")
    try:
        cgpa = float(profile.get("cgpa") or 0)
        cgpa_line = (
            f"My CGPA of {profile['cgpa']} reflects strong academics." if cgpa >= 8.0
            else f"I have a {profile['cgpa']} CGPA with hands-on experience." if cgpa >= 7.0
            else ""
        )
    except Exception:
        cgpa_line = ""
    links = " | ".join(filter(None, [
        f"GitHub: {github}" if github else "",
        f"LinkedIn: {linkedin}" if linkedin else "",
        f"Resume: {resume}" if resume else "",
    ]))
    avail = f"Notice period: {notice}" + (f" | Expected CTC: {ctc}" if ctc else "")
    subject = f"Application for {role} — {name} | {degree}"
    body = f"""Dear Hiring Team at {s_name},

I came across {s_name}'s Rs.{amount_cr:.1f} Cr {round_type} and was genuinely excited — {what}

{why}

I am {name}, a {degree} student from {location}. My core skills include {skills}, with experience through {experience}.
{cgpa_line}
I am actively looking for a {role} role and believe my background is a strong fit for {s_name}.

{links}
{avail}

I would love a quick 15-minute call. Looking forward to hearing from you.

Best regards,
{name}"""
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    return subject, body


def _get_demo_startups() -> List[Dict[str, Any]]:
    return [
        {"name": "Perfios", "amount_inr": 3360000000, "round_type": "Series C", "sector": "FinTech",
         "score": 93, "confidence": "HIGH", "source": "Crunchbase",
         "summary_what": "Financial data API platform for 900+ banks.",
         "summary_why": "Series C + massive scale = immediate hiring.",
         "role_match": "Backend Developer", "url": "https://inc42.com", "date": "2025-03-20"},
        {"name": "Krutrim AI", "amount_inr": 1680000000, "round_type": "Series A", "sector": "AI",
         "score": 91, "confidence": "HIGH", "source": "Entrackr",
         "summary_what": "India's first home-grown LLM for Indian languages.",
         "summary_why": "Massive Series A — hiring ML engineers aggressively.",
         "role_match": "ML Engineer", "url": "https://entrackr.com", "date": "2025-03-20"},
        {"name": "PayNearby", "amount_inr": 450000000, "round_type": "Series B", "sector": "FinTech",
         "score": 88, "confidence": "HIGH", "source": "Inc42",
         "summary_what": "Micro-ATM network for rural India.",
         "summary_why": "Series B means rapid team expansion.",
         "role_match": "Backend Developer", "url": "https://inc42.com", "date": "2025-03-20"},
        {"name": "HealthPlix", "amount_inr": 420000000, "round_type": "Series B", "sector": "HealthTech",
         "score": 83, "confidence": "HIGH", "source": "YourStory",
         "summary_what": "AI-powered EMR for 80,000+ doctors.",
         "summary_why": "Series B expansion = AI and backend roles.",
         "role_match": "ML Engineer", "url": "https://yourstory.com", "date": "2025-03-20"},
        {"name": "Scapia", "amount_inr": 330000000, "round_type": "Seed", "sector": "FinTech",
         "score": 82, "confidence": "HIGH", "source": "YourStory",
         "summary_what": "Travel credit card with zero forex fees.",
         "summary_why": "Fresh seed — building tech team from scratch.",
         "role_match": "Full Stack Developer", "url": "https://yourstory.com", "date": "2025-03-20"},
        {"name": "Probo", "amount_inr": 280000000, "round_type": "Series A", "sector": "FinTech",
         "score": 79, "confidence": "HIGH", "source": "Google News",
         "summary_what": "Opinion trading platform for real-world events.",
         "summary_why": "Series A = scaling tech infra now.",
         "role_match": "Backend Developer", "url": "https://inc42.com", "date": "2025-03-20"},
        {"name": "Classplus", "amount_inr": 150000000, "round_type": "Series B", "sector": "EdTech",
         "score": 74, "confidence": "MEDIUM", "source": "Entrackr",
         "summary_what": "Creator-led education platform for 50,000+ teachers.",
         "summary_why": "Growing engineering team for product roles.",
         "role_match": "Software Engineer", "url": "https://entrackr.com", "date": "2025-03-20"},
        {"name": "Zypp Electric", "amount_inr": 250000000, "round_type": "Series A", "sector": "Logistics",
         "score": 71, "confidence": "HIGH", "source": "Inc42",
         "summary_what": "India's largest EV two-wheeler fleet for last-mile delivery.",
         "summary_why": "Fleet expansion = IoT and data roles opening.",
         "role_match": "Data Analyst", "url": "https://inc42.com", "date": "2025-03-20"},
    ]


def run_web_app() -> None:
    init_db()
    print("\n" + "=" * 50)
    print("  FundedFirst Dashboard (Firebase + Auth)")
    print(f"  Open: http://localhost:{APP_PORT}")
    print("=" * 50 + "\n")
    app.run(debug=APP_DEBUG, host=APP_HOST, port=APP_PORT)


if __name__ == "__main__":
    run_web_app()


