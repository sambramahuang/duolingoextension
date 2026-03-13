import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

SCORING_MODEL = os.environ.get("SCORING_MODEL", "gpt-4o-mini")
VISION_MODEL = os.environ.get("VISION_MODEL", "gpt-4o-mini")
TRANSCRIPTION_MODEL = os.environ.get("TRANSCRIPTION_MODEL", "whisper-1")
MAX_FRAMES = int(os.environ.get("MAX_FRAMES", "6"))
NATIVE_LANGUAGE = os.environ.get("NATIVE_LANGUAGE", "English")

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = OpenAI()
    return _client


def _score_1_to_10(value, default=5):
    try:
        if isinstance(value, bool):
            raise ValueError("bool is not a score")
        score = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(1, min(10, score))


def _coerce_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _clean_json_candidate(raw_text):
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()
    return text


def _extract_output_text(response):
    raw_text = (getattr(response, "output_text", None) or "").strip()
    if raw_text:
        return raw_text

    for item in getattr(response, "output", []) or []:
        if getattr(item, "type", None) != "message":
            continue
        for part in getattr(item, "content", []) or []:
            part_type = getattr(part, "type", None)
            if part_type in {"output_text", "text"}:
                text = (getattr(part, "text", None) or "").strip()
                if text:
                    return text

    raise RuntimeError("Model returned no text output")


def _parse_json_object(raw_text):
    candidate = _clean_json_candidate(raw_text)
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start == -1 or end == -1 or start >= end:
            raise
        data = json.loads(candidate[start : end + 1])

    if isinstance(data, str):
        data = json.loads(data)
    if not isinstance(data, dict):
        raise ValueError("Model output is not a JSON object")
    return data


def _normalize_string_list(values, max_items=6):
    if not isinstance(values, list):
        return []
    output = []
    seen = set()
    for item in values:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        output.append(text)
        if len(output) >= max_items:
            break
    return output


def _normalize_difficulty(value, fallback=None):
    mapping = {
        "a1": "A1",
        "a2": "A2",
        "b1": "B1",
        "b2": "B2",
        "c1": "C1",
        "c2": "C2",
        "beginner": "A1",
        "novice": "A1",
        "elementary": "A2",
        "intermediate": "B1",
        "upper intermediate": "B2",
        "advanced": "C1",
        "proficient": "C2",
    }
    for candidate in (value, fallback):
        key = str(candidate or "").strip().lower()
        if key in mapping:
            return mapping[key]
    return "B1"


def _normalize_translation_quality(value):
    valid = {"poor", "fair", "good", "excellent"}
    key = str(value or "").strip().lower()
    return key if key in valid else "fair"


def _normalize_translations(translations, fallback_language):
    if not isinstance(translations, list):
        return []
    output = []
    for item in translations:
        if not isinstance(item, dict):
            continue
        phrase = str(item.get("phrase", "")).strip()
        english_translation = str(item.get("english_translation", "")).strip()
        if not phrase or not english_translation:
            continue
        language = str(item.get("language", fallback_language or "")).strip()
        output.append(
            {
                "phrase": phrase,
                "language": language or fallback_language or "Unknown",
                "english_translation": english_translation,
            }
        )
        if len(output) >= 8:
            break
    return output


def _normalize_transcript_analysis(raw, metadata):
    fallback_language = (
        metadata.get("target_language_name")
        or metadata.get("target_language")
        or "Unknown"
    )
    return {
        "teaching_score": _score_1_to_10(raw.get("teaching_score"), default=5),
        "target_alignment_score": _score_1_to_10(
            raw.get("target_alignment_score"), default=5
        ),
        "language_being_taught": str(
            raw.get("language_being_taught") or fallback_language
        ).strip()
        or fallback_language,
        "learner_native_language": NATIVE_LANGUAGE,
        "detected_languages_in_transcript": _normalize_string_list(
            raw.get("detected_languages_in_transcript"), max_items=4
        ),
        "transcription_difficulty": _normalize_difficulty(
            raw.get("transcription_difficulty"),
            fallback=metadata.get("learner_level"),
        ),
        "is_good_for_learning": _coerce_bool(raw.get("is_good_for_learning"), True),
        "translation_quality": _normalize_translation_quality(
            raw.get("translation_quality")
        ),
        "reason": str(raw.get("reason", "")).strip(),
        "translations": _normalize_translations(
            raw.get("translations"), fallback_language=fallback_language
        ),
        "recommendations": _normalize_string_list(
            raw.get("recommendations"), max_items=6
        ),
    }


def _normalize_video_quality(raw):
    return {
        "overall_video_score": _score_1_to_10(raw.get("overall_video_score"), default=5),
        "lighting": _score_1_to_10(raw.get("lighting"), default=5),
        "framing": _score_1_to_10(raw.get("framing"), default=5),
        "camera_stability": _score_1_to_10(raw.get("camera_stability"), default=5),
        "visual_clarity": _score_1_to_10(raw.get("visual_clarity"), default=5),
        "issues": _normalize_string_list(raw.get("issues"), max_items=6),
        "recommendations": _normalize_string_list(raw.get("recommendations"), max_items=6),
    }


def _dedupe_keep_order(items, max_items=8):
    output = []
    seen = set()
    for item in items:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        output.append(text)
        if len(output) >= max_items:
            break
    return output


def _compact_score(value, decimals=1):
    rounded = round(float(value), decimals)
    if float(rounded).is_integer():
        return int(rounded)
    return rounded


def _metadata_to_text(metadata):
    if not metadata:
        return "No creator metadata provided."

    lines = []
    pairs = [
        ("Title", metadata.get("title")),
        ("Description", metadata.get("description")),
        ("Target language", metadata.get("target_language_name") or metadata.get("target_language")),
        ("Learner level", metadata.get("learner_level")),
        ("Category", metadata.get("category")),
        ("Topics", ", ".join(metadata.get("topics", []))),
        ("Has subtitles", str(metadata.get("has_subtitles"))),
        ("Native speaker", str(metadata.get("native_speaker"))),
        ("Slow speech segments", str(metadata.get("slow_speech"))),
    ]
    for label, value in pairs:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            lines.append(f"- {label}: {text}")

    return "\n".join(lines) if lines else "No creator metadata provided."


def score_language_teaching(transcript, metadata=None):
    metadata = metadata or {}
    response = _get_client().responses.create(
        model=SCORING_MODEL,
        temperature=0,
        input=[
            {
                "role": "system",
                "content": (
                    "You evaluate short language-learning video transcripts for English-native learners.\n"
                    "Use the creator metadata as intent. Grade educational quality and alignment.\n"
                    "Return only JSON with this exact schema:\n"
                    "{\n"
                    '  "teaching_score": integer 1-10,\n'
                    '  "target_alignment_score": integer 1-10,\n'
                    '  "language_being_taught": string,\n'
                    '  "learner_native_language": "English",\n'
                    '  "detected_languages_in_transcript": [string],\n'
                    '  "transcription_difficulty": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",\n'
                    '  "is_good_for_learning": boolean,\n'
                    '  "translation_quality": "poor"|"fair"|"good"|"excellent",\n'
                    '  "reason": string,\n'
                    '  "translations": [{"phrase": string, "language": string, "english_translation": string}],\n'
                    '  "recommendations": [string]\n'
                    "}\n"
                    "Rules: Scores must be integers. Do not include markdown."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Creator metadata:\n"
                    f"{_metadata_to_text(metadata)}\n\n"
                    "Transcript:\n"
                    f"{transcript}"
                ),
            },
        ],
        text={"format": {"type": "json_object"}},
    )

    raw = _extract_output_text(response)
    parsed = _parse_json_object(raw)
    return _normalize_transcript_analysis(parsed, metadata=metadata)


def extract_frames(video_path, max_frames=MAX_FRAMES):
    temp_dir = Path(tempfile.mkdtemp(prefix="duo_frames_"))
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vf",
        "fps=1",
        str(temp_dir / "frame_%03d.jpg"),
    ]
    try:
        subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError("ffmpeg is not installed or not on PATH") from exc
    except subprocess.CalledProcessError as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError("ffmpeg failed to extract frames from video") from exc

    frames = sorted(temp_dir.glob("*.jpg"))[:max_frames]
    if not frames:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError("No video frames were extracted")

    return temp_dir, frames


def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def convert_video_to_mp3(input_video, output_mp3):
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_video),
        "-vn",
        "-acodec",
        "libmp3lame",
        "-q:a",
        "2",
        str(output_mp3),
    ]
    try:
        subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg is not installed or not on PATH") from exc
    except subprocess.CalledProcessError as exc:
        raise RuntimeError("ffmpeg failed to extract audio from the uploaded video") from exc


def transcribe_mp3(mp3_file, prompt=None, language_code=None):
    base_kwargs = {
        "model": TRANSCRIPTION_MODEL,
        "temperature": 0,
        "response_format": "json",
    }
    if prompt:
        base_kwargs["prompt"] = prompt
    if language_code:
        base_kwargs["language"] = str(language_code).strip().lower()

    def _submit_transcription(request_kwargs):
        with open(mp3_file, "rb") as audio_file:
            payload = dict(request_kwargs)
            payload["file"] = audio_file
            return _get_client().audio.transcriptions.create(**payload)

    try:
        transcription = _submit_transcription(base_kwargs)
    except Exception:
        # If a language hint is unsupported by the speech model, retry with auto-detect.
        if "language" in base_kwargs:
            fallback_kwargs = dict(base_kwargs)
            fallback_kwargs.pop("language", None)
            transcription = _submit_transcription(fallback_kwargs)
        else:
            raise

    text = str(getattr(transcription, "text", "")).strip()
    if not text:
        raise RuntimeError("Transcription returned empty text")
    return text


def score_video_quality(video_path):
    temp_dir, frames = extract_frames(video_path)
    try:
        content = [
            {
                "type": "input_text",
                "text": (
                    "Evaluate this educational creator video for learning usability.\n"
                    "Return only JSON with schema:\n"
                    "{\n"
                    '  "overall_video_score": integer 1-10,\n'
                    '  "lighting": integer 1-10,\n'
                    '  "framing": integer 1-10,\n'
                    '  "camera_stability": integer 1-10,\n'
                    '  "visual_clarity": integer 1-10,\n'
                    '  "issues": [string],\n'
                    '  "recommendations": [string]\n'
                    "}\n"
                ),
            }
        ]

        for frame in frames:
            content.append(
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{encode_image(frame)}",
                }
            )

        response = _get_client().responses.create(
            model=VISION_MODEL,
            temperature=0,
            input=[{"role": "user", "content": content}],
            text={"format": {"type": "json_object"}},
        )
        raw = _extract_output_text(response)
        parsed = _parse_json_object(raw)
        return _normalize_video_quality(parsed)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def combine_scores(transcript_result, video_result, transcript_text=""):
    teaching_score = _score_1_to_10(transcript_result.get("teaching_score"), default=5)
    alignment_score = _score_1_to_10(
        transcript_result.get("target_alignment_score"), default=teaching_score
    )
    learning_score = (teaching_score * 0.8) + (alignment_score * 0.2)

    video_score = _score_1_to_10(video_result.get("overall_video_score"), default=5)
    overall = (learning_score * 1) + (video_score * 0)

    merged_recommendations = _dedupe_keep_order(
        transcript_result.get("recommendations", [])
        + video_result.get("recommendations", []),
        max_items=5,
    )

    return {
        "overall_score": _compact_score(overall, decimals=1),
        "learning_score": _compact_score(learning_score, decimals=1),
        "video_score": video_score,
        "difficulty": transcript_result.get("transcription_difficulty", "B1"),
        "language": transcript_result.get("language_being_taught", "Unknown"),
        "good_for_learning": transcript_result.get("is_good_for_learning", True),
        "transcript": str(transcript_text or "").strip(),
        "english_translation": transcript_result.get("translations", []),
        "recommendations": merged_recommendations,
    }


def run_transcription_pipeline(mp3_path, prompt, metadata):
    language_code = metadata.get("target_language_code")
    text = transcribe_mp3(mp3_path, prompt=prompt, language_code=language_code)
    transcript_analysis = score_language_teaching(text, metadata=metadata)
    return text, transcript_analysis


def run_video_quality_pipeline(video_path):
    return score_video_quality(video_path)


def analyze_video_file(video_path, metadata=None):
    metadata = metadata or {}
    input_path = Path(video_path)
    if not input_path.exists() or not input_path.is_file():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    prompt = "Do NOT translate."
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_mp3:
        mp3_path = temp_mp3.name

    try:
        convert_video_to_mp3(str(input_path), mp3_path)

        with ThreadPoolExecutor(max_workers=2) as executor:
            transcript_future = executor.submit(
                run_transcription_pipeline, mp3_path, prompt, metadata
            )
            video_future = executor.submit(run_video_quality_pipeline, str(input_path))

            transcript_text, transcript_analysis = transcript_future.result()
            video_quality = video_future.result()

        combined = combine_scores(
            transcript_analysis,
            video_quality,
            transcript_text=transcript_text,
        )
        return {
            "transcript": transcript_text,
            "transcript_analysis": transcript_analysis,
            "video_quality": video_quality,
            "combined": combined,
        }
    finally:
        try:
            os.unlink(mp3_path)
        except OSError:
            pass


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 transcriber.py input.mp4")
        sys.exit(1)

    input_mp4 = sys.argv[1]
    input_path = Path(input_mp4)
    if not input_path.exists():
        print(f"File not found: {input_mp4}")
        sys.exit(1)

    try:
        result = analyze_video_file(input_mp4)
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)

    print("\nTranscript:")
    print(result["transcript"])
    print("\nFinal Analysis:")
    print(json.dumps(result["combined"], ensure_ascii=False, indent=2))
