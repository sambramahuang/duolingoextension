"""
Flask API server for Duolingo Creator Studio.
Accepts influencer uploads and returns AI grading results.
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from transcriber import FFMPEG_BIN, analyze_video_file

load_dotenv()

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

ALLOWED_EXTENSIONS = {"mp4", "mov", "webm", "avi", "mkv"}
IS_VERCEL = os.environ.get("VERCEL") == "1" or bool(os.environ.get("VERCEL_ENV"))
_default_upload_limit_mb = 4.5 if IS_VERCEL else 500.0
try:
    UPLOAD_LIMIT_MB = float(os.environ.get("UPLOAD_LIMIT_MB", str(_default_upload_limit_mb)))
except ValueError:
    UPLOAD_LIMIT_MB = _default_upload_limit_mb
MAX_CONTENT_LENGTH = int(max(1.0, UPLOAD_LIMIT_MB) * 1024 * 1024)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def _json_error(message, status=400):
    return jsonify({"success": False, "error": message}), status


def _allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _format_upload_limit_mb():
    if float(UPLOAD_LIMIT_MB).is_integer():
        return str(int(UPLOAD_LIMIT_MB))
    return str(UPLOAD_LIMIT_MB)


def _parse_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _parse_topics(raw_value):
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [part.strip() for part in str(raw_value).split(",") if part.strip()]


def _extract_metadata(form):
    return {
        "title": form.get("title", "").strip(),
        "description": form.get("description", "").strip(),
        "target_language_code": form.get("target_language_code", "").strip(),
        "target_language": form.get("target_language", "").strip(),
        "target_language_name": form.get("target_language_name", "").strip(),
        "learner_level": form.get("learner_level", "").strip(),
        "category": form.get("category", "").strip(),
        "topics": _parse_topics(form.get("topics")),
        "has_subtitles": _parse_bool(form.get("has_subtitles"), default=False),
        "native_speaker": _parse_bool(form.get("native_speaker"), default=False),
        "slow_speech": _parse_bool(form.get("slow_speech"), default=False),
    }

def _ffmpeg_available():
    try:
        subprocess.run(
            [FFMPEG_BIN, "-version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify(
        {
            "success": True,
            "service": "duolingo-creator-grading",
            "openai_configured": bool(os.environ.get("OPENAI_API_KEY")),
            "ffmpeg_available": _ffmpeg_available(),
            "runtime": "vercel" if IS_VERCEL else "local",
            "upload_limit_mb": UPLOAD_LIMIT_MB,
        }
    )


@app.route("/api/analyze", methods=["POST"])
def analyze():
    if not os.environ.get("OPENAI_API_KEY"):
        return _json_error("OPENAI_API_KEY is missing on the server", status=503)

    if "video" not in request.files:
        return _json_error("No video file provided", status=400)

    video_file = request.files["video"]
    if not video_file.filename:
        return _json_error("No file selected", status=400)

    if not _allowed_file(video_file.filename):
        return _json_error(
            f"File type not allowed. Use one of: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
            status=400,
        )

    if request.content_length and request.content_length > app.config["MAX_CONTENT_LENGTH"]:
        return _json_error(
            f"Uploaded file is too large (max {_format_upload_limit_mb()}MB on this deployment)",
            status=413,
        )

    metadata = _extract_metadata(request.form)
    suffix = Path(secure_filename(video_file.filename)).suffix or ".mp4"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        video_file.save(tmp.name)
        temp_video_path = tmp.name

    try:
        result = analyze_video_file(temp_video_path, metadata=metadata)
        combined = dict(result.get("combined", {}))
        # Return the combined object directly so frontend relies on combined only.
        if "language" not in combined or not combined.get("language"):
            combined["language"] = metadata.get("target_language_name") or "Unknown"
        if "difficulty" not in combined or not combined.get("difficulty"):
            combined["difficulty"] = metadata.get("learner_level") or "B1"
        if "good_for_learning" not in combined:
            combined["good_for_learning"] = True
        if "english_translation" not in combined:
            combined["english_translation"] = []
        if "recommendations" not in combined:
            combined["recommendations"] = []
        if "transcript" not in combined:
            combined["transcript"] = str(result.get("transcript", "")).strip()
        return jsonify(combined)

    except FileNotFoundError as exc:
        return _json_error(str(exc), status=400)
    except RuntimeError as exc:
        return _json_error(str(exc), status=422)
    except Exception as exc:
        return _json_error(f"Analysis failed: {exc}", status=500)
    finally:
        try:
            os.unlink(temp_video_path)
        except OSError:
            pass


@app.errorhandler(413)
def payload_too_large(_error):
    return _json_error(
        f"Uploaded file is too large (max {_format_upload_limit_mb()}MB on this deployment)",
        status=413,
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("FLASK_DEBUG", "1").strip() == "1"
    print(f"Starting Duolingo Creator Studio API on http://localhost:{port}")
    print("Required env: OPENAI_API_KEY")
    app.run(host="0.0.0.0", port=port, debug=debug)
