import os
import time
import logging

import requests

from config import settings

logger = logging.getLogger(__name__)

# Instagram Login flow — via graph.instagram.com (no Facebook Page required).
# The 3-step container flow (create → wait for encoding → publish) is the same; only the host/token differ.
BASE_URL = f"{settings.instagram_graph_base.rstrip('/')}/{settings.instagram_api_version}"


def _check(resp: requests.Response, action: str) -> requests.Response:
    """On 4xx/5xx, include the Meta error body (JSON) in the log and exception message to surface the cause."""
    if resp.status_code >= 400:
        body = resp.text
        logger.error(f"Instagram {action} failed [{resp.status_code}]: {body}")
        raise requests.HTTPError(f"{action} {resp.status_code}: {body}", response=resp)
    return resp


def create_reels_container(video_url: str, caption: str) -> str:
    account_id = settings.instagram_account_id
    token = settings.instagram_access_token

    resp = requests.post(
        f"{BASE_URL}/{account_id}/media",
        data={
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "access_token": token,
        },
    )
    _check(resp, "container creation")
    return resp.json()["id"]


def wait_for_encoding(container_id: str, max_attempts: int = 20) -> None:
    token = settings.instagram_access_token

    for attempt in range(max_attempts):
        resp = requests.get(
            f"{BASE_URL}/{container_id}",
            # status: includes a human-readable reason (e.g. "Error: 2207026 ...")
            params={"fields": "status_code,status", "access_token": token},
        )
        _check(resp, "encoding status check")
        data = resp.json()
        status = data.get("status_code")

        if status == "FINISHED":
            return
        elif status == "ERROR":
            # the status field carries the actual failure reason (unreachable URL, format spec, etc.)
            logger.error(f"Meta encoding error: {data}")
            raise Exception(f"Meta encoding error: {data.get('status') or data}")
        else:
            logger.info(f"Encoding... ({attempt + 1}/{max_attempts}) status={status}")
            time.sleep(30)

    raise Exception("Encoding timed out (over 10 minutes)")


def publish_reels(container_id: str) -> str:
    account_id = settings.instagram_account_id
    token = settings.instagram_access_token

    resp = requests.post(
        f"{BASE_URL}/{account_id}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": token,
        },
    )
    _check(resp, "publish")
    return resp.json()["id"]
