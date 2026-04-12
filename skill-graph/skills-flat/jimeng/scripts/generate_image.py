#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests>=2.28.0",
# ]
# ///
"""
Generate images using the Jimeng (即梦) AI image generation API.

Usage:
    uv run generate_image.py --prompt "描述" --filename "output.png"
    uv run generate_image.py --prompt "描述" --filename "output.png" --model jimeng-5.0 --resolution 2k --aspect-ratio 16:9

Ported from the TypeScript jimeng integration in lingo-M.
"""

import argparse
import hashlib
import json
import math
import os
import sys
import time
import uuid
from pathlib import Path

import requests

# ==================== Constants ====================

BASE_URL = "https://jimeng.jianying.com"
APP_ID = 513695
PLATFORM_CODE = "7"
VERSION_CODE = "8.4.0"
WEB_VERSION = "7.5.0"
SDK_VERSION = "48.0.0"
DA_VERSION = "3.3.10"

DRAFT_VERSION = "3.3.10"
DRAFT_MIN_VERSION_IMAGE = "3.0.2"

IMAGE_MODEL_MAP = {
    "jimeng-5.0": "high_aes_general_v50",
    "jimeng-4.6": "high_aes_general_v42",
    "jimeng-4.5": "high_aes_general_v40l",
    "jimeng-4.1": "high_aes_general_v41",
    "jimeng-4.0": "high_aes_general_v40",
    "jimeng-3.1": "high_aes_general_v30l_art_fangzhou:general_v3.0_18b",
    "jimeng-3.0": "high_aes_general_v30l:general_v3.0_18b",
}

DEFAULT_IMAGE_MODEL = "jimeng-4.0"

RESOLUTION_OPTIONS = {
    "1k": {
        "1:1": {"width": 1024, "height": 1024, "ratio": 1},
        "4:3": {"width": 768, "height": 1024, "ratio": 4},
        "3:4": {"width": 1024, "height": 768, "ratio": 2},
        "16:9": {"width": 1024, "height": 576, "ratio": 3},
        "9:16": {"width": 576, "height": 1024, "ratio": 5},
    },
    "2k": {
        "1:1": {"width": 2048, "height": 2048, "ratio": 1},
        "4:3": {"width": 2304, "height": 1728, "ratio": 4},
        "3:4": {"width": 1728, "height": 2304, "ratio": 2},
        "16:9": {"width": 2560, "height": 1440, "ratio": 3},
        "9:16": {"width": 1440, "height": 2560, "ratio": 5},
    },
}

POLL_INTERVAL = 3  # seconds
POLL_TIMEOUT = 180  # seconds

# ==================== Sign Signature ====================


def generate_sign(uri: str, device_time: int) -> str:
    """Generate Jimeng API sign (MD5-based)."""
    uri_tail = uri[-7:]
    raw = f"9e2c|{uri_tail}|{PLATFORM_CODE}|{VERSION_CODE}|{device_time}||11ac"
    return hashlib.md5(raw.encode()).hexdigest()


# ==================== Cookie / Headers ====================


def get_cookies(provided: str | None) -> str:
    """Get cookies from argument or environment."""
    raw = provided or os.environ.get("JIMENG_COOKIES", "")
    if not raw:
        return ""
    # Support multiple cookies separated by ||| or ,
    entries = raw.split("|||") if "|||" in raw else raw.split(",")
    entries = [e.strip() for e in entries if e.strip()]
    if not entries:
        return ""
    # Use the first entry (round-robin not needed for CLI)
    return entries[0]


def is_full_cookie(entry: str) -> bool:
    return "sessionid=" in entry


def build_cookie_from_session_id(session_id: str) -> str:
    """Build a full cookie string from a session ID."""
    web_id = str(int(7e18 + hash(session_id) % int(3e18)))
    user_id = uuid.uuid4().hex
    unix_ts = int(time.time())
    parts = [
        f"_tea_web_id={web_id}",
        "is_staff_user=false",
        f"sid_guard={session_id}%7C{unix_ts}%7C5184000%7CMon",
        f"uid_tt={user_id}",
        f"uid_tt_ss={user_id}",
        f"sid_tt={session_id}",
        f"sessionid={session_id}",
        f"sessionid_ss={session_id}",
    ]
    return "; ".join(parts)


def resolve_cookie(entry: str) -> str:
    if is_full_cookie(entry):
        return entry
    return build_cookie_from_session_id(entry)


def build_headers(uri: str, cookie_entry: str, extra_headers: dict | None = None) -> dict:
    """Build request headers with sign signature."""
    device_time = int(time.time())
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "App-Sdk-Version": SDK_VERSION,
        "Appid": str(APP_ID),
        "Appvr": VERSION_CODE,
        "Cookie": resolve_cookie(cookie_entry),
        "Device-Time": str(device_time),
        "Lan": "zh-Hans",
        "Loc": "cn",
        "Origin": BASE_URL,
        "Pf": PLATFORM_CODE,
        "Sign": generate_sign(uri, device_time),
        "Sign-Ver": "1",
        "Tdid": "",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/132.0.0.0 Safari/537.36"
        ),
    }
    if extra_headers:
        headers.update(extra_headers)
    return headers


def build_query_params(cookie_entry: str) -> dict:
    """Build common query parameters."""
    # Try to extract web_id from cookie
    import re
    web_id_match = re.search(r"\b_tea_web_id=(\d+)", cookie_entry)
    web_id = web_id_match.group(1) if web_id_match else str(int(7e18 + hash(cookie_entry) % int(3e18)))
    return {
        "aid": str(APP_ID),
        "device_platform": "web",
        "region": "cn",
        "webId": web_id,
        "da_version": DA_VERSION,
        "os": "mac",
        "web_component_open_flag": "1",
        "web_version": WEB_VERSION,
        "aigc_features": "app_lip_sync",
    }


# ==================== API Calls ====================


def api_post(uri: str, data: dict, cookie_entry: str, extra_headers: dict | None = None) -> dict:
    """Make a POST request to the Jimeng API."""
    url = f"{BASE_URL}{uri}"
    headers = build_headers(uri, cookie_entry, extra_headers)
    params = build_query_params(cookie_entry)

    resp = requests.post(url, json=data, headers=headers, params=params, timeout=60)
    resp.raise_for_status()
    body = resp.json()

    if body.get("ret") != "0":
        errmsg = body.get("errmsg", f"ret={body.get('ret')}")
        raise RuntimeError(f"Jimeng API error on {uri}: {errmsg}")

    return body.get("data", {})


def submit_image_task(
    cookie_entry: str,
    prompt: str,
    model_key: str = DEFAULT_IMAGE_MODEL,
    resolution_type: str = "1k",
    aspect_ratio: str = "1:1",
    negative_prompt: str = "",
    seed: int | None = None,
    sample_strength: float = 0.5,
) -> str:
    """Submit an image generation task. Returns history_id."""
    model_req_key = IMAGE_MODEL_MAP.get(model_key, model_key)
    res_config = RESOLUTION_OPTIONS.get(resolution_type, RESOLUTION_OPTIONS["1k"]).get(
        aspect_ratio, RESOLUTION_OPTIONS["1k"]["1:1"]
    )

    component_id = str(uuid.uuid4())
    submit_id = str(uuid.uuid4())
    actual_seed = seed if seed is not None else int(hash(time.time()) % 4294967296)

    metrics_extra = json.dumps({
        "promptSource": "custom",
        "generateCount": 4,
        "isDefaultSeed": 1,
        "originSubmitId": submit_id,
        "isRegenerate": False,
        "enterFrom": "click",
        "imageRatio": res_config["ratio"],
        "sceneOptions": json.dumps([{
            "type": "image",
            "scene": "ImageBasicGenerate",
            "modelReqKey": model_req_key,
            "reportParams": {
                "enterSource": "generate",
                "vipSource": "generate",
                "extraVipFunctionKey": model_req_key,
                "useVipFunctionDetailsReporterHoc": True,
            },
        }]),
    })

    draft_content = json.dumps({
        "type": "draft",
        "id": str(uuid.uuid4()),
        "min_version": DRAFT_MIN_VERSION_IMAGE,
        "min_features": [],
        "is_from_tsn": True,
        "version": DRAFT_VERSION,
        "main_component_id": component_id,
        "component_list": [{
            "type": "image_base_component",
            "id": component_id,
            "min_version": DRAFT_MIN_VERSION_IMAGE,
            "aigc_mode": "workbench",
            "metadata": {
                "type": "",
                "id": str(uuid.uuid4()),
                "created_platform": 3,
                "created_platform_version": "",
                "created_time_in_ms": str(int(time.time() * 1000)),
                "created_did": "",
            },
            "generate_type": "generate",
            "abilities": {
                "type": "",
                "id": str(uuid.uuid4()),
                "generate": {
                    "type": "",
                    "id": str(uuid.uuid4()),
                    "core_param": {
                        "type": "",
                        "id": str(uuid.uuid4()),
                        "model": model_req_key,
                        "prompt": prompt,
                        "negative_prompt": negative_prompt,
                        "seed": actual_seed,
                        "sample_strength": sample_strength,
                        "image_ratio": res_config["ratio"],
                        "large_image_info": {
                            "height": res_config["height"],
                            "width": res_config["width"],
                            "resolution_type": resolution_type,
                        },
                        "intelligent_ratio": False,
                    },
                    "gen_option": {
                        "type": "",
                        "id": str(uuid.uuid4()),
                        "generate_all": False,
                    },
                },
            },
        }],
    })

    request_data = {
        "extend": {"root_model": model_req_key},
        "submit_id": submit_id,
        "metrics_extra": metrics_extra,
        "draft_content": draft_content,
        "http_common_info": {"aid": APP_ID},
    }

    result = api_post(
        "/mweb/v1/aigc_draft/generate",
        request_data,
        cookie_entry,
        extra_headers={"Referer": "https://jimeng.jianying.com/ai-tool/generate"},
    )

    history_id = result.get("aigc_data", {}).get("history_record_id")
    if not history_id:
        raise RuntimeError(f"No history_record_id in response: {json.dumps(result)[:500]}")
    return history_id


def poll_image_status(cookie_entry: str, history_id: str) -> dict:
    """Poll for image generation status. Returns result dict."""
    data = api_post(
        "/mweb/v1/get_history_by_ids",
        {
            "history_ids": [history_id],
            "image_info": {
                "width": 2048,
                "height": 2048,
                "format": "webp",
                "image_scene_list": [
                    {"scene": "normal", "width": 2400, "height": 2400, "uniq_key": "2400", "format": "webp"},
                    {"scene": "normal", "width": 1080, "height": 1080, "uniq_key": "1080", "format": "webp"},
                ],
            },
        },
        cookie_entry,
    )

    history_data = data.get(history_id)
    if not history_data:
        return {"status": "processing", "images": []}

    status_code = history_data.get("status", 0)
    if status_code in (10, 50):
        status = "completed"
    elif status_code == 30:
        status = "failed"
    else:
        status = "processing"

    if status == "failed":
        return {
            "status": "failed",
            "images": [],
            "error": f"fail_code={history_data.get('fail_code')}",
        }

    if status == "completed":
        images = []
        for item in history_data.get("item_list", []):
            large_images = (item.get("image") or {}).get("large_images", [])
            if large_images and large_images[0].get("image_url"):
                img = large_images[0]
                images.append({
                    "url": img["image_url"].replace("\\u0026", "&"),
                    "width": img.get("width"),
                    "height": img.get("height"),
                })
            elif (item.get("common_attr") or {}).get("cover_url"):
                images.append({"url": item["common_attr"]["cover_url"]})
        return {"status": "completed", "images": images}

    return {"status": "processing", "images": []}


# ==================== Main ====================


def main():
    parser = argparse.ArgumentParser(
        description="Generate images using Jimeng (即梦) AI image generation API"
    )
    parser.add_argument(
        "--prompt", "-p", required=True, help="Image description/prompt"
    )
    parser.add_argument(
        "--filename", "-f", required=True, help="Output filename (e.g., output.png)"
    )
    parser.add_argument(
        "--model", "-m",
        default=DEFAULT_IMAGE_MODEL,
        choices=list(IMAGE_MODEL_MAP.keys()),
        help=f"Model to use (default: {DEFAULT_IMAGE_MODEL})",
    )
    parser.add_argument(
        "--resolution", "-r",
        default="1k",
        choices=["1k", "2k"],
        help="Output resolution (default: 1k)",
    )
    parser.add_argument(
        "--aspect-ratio", "-a",
        default="1:1",
        choices=["1:1", "4:3", "3:4", "16:9", "9:16"],
        help="Aspect ratio (default: 1:1)",
    )
    parser.add_argument(
        "--negative-prompt", "-n",
        default="",
        help="Negative prompt (things to avoid)",
    )
    parser.add_argument(
        "--cookies", "-c",
        help="Jimeng cookies / session ID (overrides JIMENG_COOKIES env var)",
    )

    args = parser.parse_args()

    # Get cookies
    cookie_entry = get_cookies(args.cookies)
    if not cookie_entry:
        print("Error: No Jimeng cookies provided.", file=sys.stderr)
        print("Please either:", file=sys.stderr)
        print("  1. Provide --cookies argument", file=sys.stderr)
        print("  2. Set JIMENG_COOKIES environment variable", file=sys.stderr)
        sys.exit(1)

    # Set up output path
    output_path = Path(args.filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Submitting image generation task...")
    print(f"  Model: {args.model}")
    print(f"  Resolution: {args.resolution}")
    print(f"  Aspect ratio: {args.aspect_ratio}")
    print(f"  Prompt: {args.prompt}")

    # Submit task
    try:
        history_id = submit_image_task(
            cookie_entry=cookie_entry,
            prompt=args.prompt,
            model_key=args.model,
            resolution_type=args.resolution,
            aspect_ratio=args.aspect_ratio,
            negative_prompt=args.negative_prompt,
        )
    except Exception as e:
        print(f"Error submitting task: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Task submitted: history_id={history_id}")
    print(f"Polling for results (timeout: {POLL_TIMEOUT}s)...")

    # Poll for completion
    start_time = time.time()
    result = None
    while time.time() - start_time < POLL_TIMEOUT:
        try:
            result = poll_image_status(cookie_entry, history_id)
        except Exception as e:
            print(f"Warning: poll error: {e}", file=sys.stderr)
            time.sleep(POLL_INTERVAL)
            continue

        if result["status"] == "completed":
            break
        elif result["status"] == "failed":
            print(f"Error: Image generation failed: {result.get('error', 'unknown')}", file=sys.stderr)
            sys.exit(1)

        elapsed = int(time.time() - start_time)
        print(f"  Still processing... ({elapsed}s elapsed)")
        time.sleep(POLL_INTERVAL)
    else:
        print(f"Error: Timed out after {POLL_TIMEOUT}s", file=sys.stderr)
        sys.exit(1)

    # Download the first image
    images = result.get("images", [])
    if not images:
        print("Error: No images in completed result", file=sys.stderr)
        sys.exit(1)

    image_url = images[0]["url"]
    print(f"Downloading image...")

    try:
        resp = requests.get(image_url, timeout=120)
        resp.raise_for_status()
        output_path.write_bytes(resp.content)
    except Exception as e:
        print(f"Error downloading image: {e}", file=sys.stderr)
        sys.exit(1)

    full_path = output_path.resolve()
    print(f"\nImage saved: {full_path}")
    # OpenClaw parses MEDIA tokens and will attach the file on supported providers.
    print(f"MEDIA: {full_path}")


if __name__ == "__main__":
    main()
