# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import logging
import os
import sys
from datetime import timedelta

from celery.schedules import crontab
from flask_caching.backends.filesystemcache import FileSystemCache

logger = logging.getLogger()

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASE_DIALECT = os.getenv("DATABASE_DIALECT")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_DB = os.getenv("DATABASE_DB")

EXAMPLES_USER = os.getenv("EXAMPLES_USER")
EXAMPLES_PASSWORD = os.getenv("EXAMPLES_PASSWORD")
EXAMPLES_HOST = os.getenv("EXAMPLES_HOST")
EXAMPLES_PORT = os.getenv("EXAMPLES_PORT")
EXAMPLES_DB = os.getenv("EXAMPLES_DB")

SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://"
    f"{DATABASE_USER}:{DATABASE_PASSWORD}@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)
SQLALCHEMY_ENGINE_OPTIONS = {
    "pool_size": int(os.getenv("SQLALCHEMY_POOL_SIZE", "30")),
    "max_overflow": int(os.getenv("SQLALCHEMY_MAX_OVERFLOW", "60")),
    "pool_timeout": int(os.getenv("SQLALCHEMY_POOL_TIMEOUT", "60")),
    "pool_recycle": int(os.getenv("SQLALCHEMY_POOL_RECYCLE", "1800")),
    "pool_pre_ping": True,
}

SQLALCHEMY_EXAMPLES_URI = os.getenv(
    "SUPERSET__SQLALCHEMY_EXAMPLES_URI",
    (
        f"{DATABASE_DIALECT}://"
        f"{EXAMPLES_USER}:{EXAMPLES_PASSWORD}@"
        f"{EXAMPLES_HOST}:{EXAMPLES_PORT}/{EXAMPLES_DB}"
    ),
)

# ---------------------------------------------------------------------------
# Redis / Celery
# ---------------------------------------------------------------------------
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

RESULTS_BACKEND = FileSystemCache("/app/superset_home/sqllab")

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 3600,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_RESULTS_DB,
}
DATA_CACHE_CONFIG = {
    **CACHE_CONFIG,
    "CACHE_DEFAULT_TIMEOUT": 300,
}
# Thumbnails need a much longer TTL than query/data cache (300s) — otherwise
# the screenshot expires from Redis a few minutes after being generated and
# the card falls back to the placeholder until it's recomputed on next view.
THUMBNAIL_CACHE_CONFIG = {
    **CACHE_CONFIG,
    "CACHE_KEY_PREFIX": "superset_thumbnail_",
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(days=2).total_seconds()),
}


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
        "superset.factory_status.tasks",
    )
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    worker_prefetch_multiplier = 1
    task_acks_late = False
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=10, hour=0),
        },
        # Recompute every dashboard/chart thumbnail once a day at midnight,
        # instead of on every rebuild/restart, so the bulk capture load
        # doesn't compete with users viewing dashboards during the day.
        "thumbnails.refresh_all": {
            "task": "refresh_all_thumbnails",
            "schedule": crontab(minute=0, hour=0),
        },
        # Chạy mỗi phút, tự kiểm tra factory_status_task_configs để dispatch
        "factory_status.run_task_configs": {
            "task": "factory_status.run_task_configs",
            "schedule": crontab(minute="*"),
            "options": {"expires": 55},
        },
        # Đồng bộ trạng thái node từ Oracle_Product mỗi 2 phút
        "factory_status.sync_node_status": {
            "task": "factory_status.sync_node_status",
            "schedule": crontab(minute="*/2"),
            "options": {"expires": 115},
        },
    }


CELERY_CONFIG = CeleryConfig

# ---------------------------------------------------------------------------
# Language / i18n
# ---------------------------------------------------------------------------
# LANGUAGES = {
#     "en": {"flag": "us", "name": "English"},
#     # "zh": {"flag": "cn", "name": "Chinese"},
#     # "ja": {"flag": "jp", "name": "Japanese"},
#     "ko": {"flag": "kr", "name": "Korean"},
#     "vi": {"flag": "vn", "name": "Vietnamese"},
#     # "fr": {"flag": "fr", "name": "French"},
#     # "de": {"flag": "de", "name": "German"},
#     # "pt_BR": {"flag": "br", "name": "Brazilian Portuguese"},
# }

# ---------------------------------------------------------------------------
# Feature flags
# ---------------------------------------------------------------------------
FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "DATASET_FOLDERS": True,
    "ENABLE_EXTENSIONS": True,
    "SEMANTIC_LAYERS": True,
    "DASHBOARD_RBAC": True,
    "TAGGING_SYSTEM": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "THUMBNAILS": True,
    # The Docker image only installs a browser via Playwright (see
    # INCLUDE_FIREFOX build arg), not Selenium's geckodriver — so screenshots
    # (reports, alerts, thumbnails) must render through Playwright, not Selenium.
    "PLAYWRIGHT_REPORTS_AND_THUMBNAILS": True,
    # Automatically recompute the thumbnail whenever a dashboard/chart is
    # created or saved, instead of waiting for someone to open the list view.
    "THUMBNAILS_SQLA_LISTENERS": True,
    # Default the Dashboards/Charts list pages to card (grid) view.
    "LISTVIEWS_DEFAULT_CARD_VIEW": True,
    # Disabled: the headless Playwright browser used for thumbnail capture
    # runs inside the superset-worker container and can't reliably reach
    # GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL (the external address real user
    # browsers need) — charts using async queries then spin forever
    # waiting on a WebSocket message that never arrives, timing out
    # thumbnail generation (SCREENSHOT_LOAD_WAIT). Superset has no separate
    # "internal" websocket URL config to fix this cleanly, unlike
    # WEBDRIVER_BASEURL vs WEBDRIVER_BASEURL_USER_FRIENDLY. Revisit later
    # if this needs solving properly.
    "GLOBAL_ASYNC_QUERIES": False,
    "ESTIMATE_QUERY_COST": True
}

EXTENSIONS_PATH = "/app/docker/extensions"
ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
WEBDRIVER_BASEURL = (
    # "superset" is the docker-compose.yml service name (reachable inside the
    # Docker network), on the internal Flask port (default 8088). The old
    # value ("superset_app") was the container_name used only in
    # docker-compose-non-dev.yml, which doesn't resolve here.
    f"http://superset:{os.getenv('SUPERSET_PORT', '8088')}"
    f"{os.environ.get('SUPERSET_APP_ROOT', '/')}/"
)
WEBDRIVER_BASEURL_USER_FRIENDLY = (
    # The real address users open in their browser (used for links in
    # report/alert emails), as opposed to WEBDRIVER_BASEURL which is only
    # used internally by the worker container to render screenshots.
    f"http://{os.getenv('SUPERSET_WEBSERVER_ADDRESS', '172.16.13.224')}:"
    f"{os.getenv('SUPERSET_PORT', '8088')}"
    f"{os.environ.get('SUPERSET_APP_ROOT', '/')}/"
)

# ---------------------------------------------------------------------------
# Global async queries - requires the GLOBAL_ASYNC_QUERIES feature flag,
# Redis 5+, the superset-worker Celery worker, and the superset-websocket
# service (already defined in docker-compose.yml).
# ---------------------------------------------------------------------------
# Must match "jwtSecret" in docker/superset-websocket/config.example.json —
# that's the file docker-compose.yml mounts as the websocket service's
# actual runtime config.json.
GLOBAL_ASYNC_QUERIES_JWT_SECRET = os.getenv(
    "GLOBAL_ASYNC_QUERIES_JWT_SECRET",
    "a11aa39bbc8fcf1503e91f8033f56bf494e0d32444d78a52c2c682cf83ddbf7c",
)
# Use the real WebSocket transport (the "polling" default doesn't need
# superset-websocket at all, which would leave that container unused).
GLOBAL_ASYNC_QUERIES_TRANSPORT = "ws"
# This is opened directly by the USER'S BROWSER (not container-to-container),
# so — same reasoning as WEBDRIVER_BASEURL_USER_FRIENDLY above — it must be
# the externally-reachable address, not "localhost" or a Docker service name.
GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL = (
    f"ws://{os.getenv('SUPERSET_WEBSERVER_ADDRESS', '172.16.13.224')}:"
    f"{os.getenv('WEBSOCKET_PORT', '8080')}/"
)
# Where the AsyncQueryManager publishes job-completion events; this one IS
# container-to-container (superset/worker -> redis), so the Docker service
# name is correct here, unlike the WEBSOCKET_URL above.
GLOBAL_ASYNC_QUERIES_CACHE_BACKEND = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_CELERY_DB,
}

# ---------------------------------------------------------------------------
# Screenshots (thumbnails / reports / alerts) - use Chromium via Playwright.
# ---------------------------------------------------------------------------
WEBDRIVER_TYPE = "chrome"
WEBDRIVER_OPTION_ARGS = [
    "--headless",
    # The worker container runs as root; Chromium refuses to launch as root
    # without this flag.
    "--no-sandbox",
    # /dev/shm is tiny by default in Docker and crashes Chromium tabs on
    # heavy dashboards.
    "--disable-dev-shm-usage",
    "--disable-gpu",
]
# Small buffer before webdriver.py starts checking chart readiness (not
# the main wait mechanism anymore — see SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT
# / SCREENSHOT_LOAD_WAIT below, which cap the actual readiness waits).
SCREENSHOT_SELENIUM_HEADSTART = 1
# Brief settle time after charts are (or are judged to be) ready, so
# in-flight CSS animations/transitions don't get caught mid-frame.
SCREENSHOT_SELENIUM_ANIMATION_WAIT = 3
# Caps for the readiness waits in webdriver.py — element/chart-container
# visibility and "loading" spinners disappearing. These no longer fail the
# screenshot on timeout (they just log a warning and capture whatever is on
# screen), so a generous 30s only ever means "wait this long for genuinely
# slow charts before giving up on waiting" — it can't cause a hard error.
SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT = int(timedelta(seconds=30).total_seconds() * 1000)
SCREENSHOT_LOAD_WAIT = int(timedelta(seconds=30).total_seconds())

SQLLAB_CTAS_NO_LIMIT = True

# Session không hết hạn để token luôn có hiệu lực khi hiển thị màn hình lớn
PERMANENT_SESSION_LIFETIME = 365 * 24 * 60 * 60
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = False
SESSION_COOKIE_SAMESITE = "Lax"

log_level_text = os.getenv("SUPERSET_LOG_LEVEL", "INFO")
LOG_LEVEL = getattr(logging, log_level_text.upper(), logging.INFO)

# ---------------------------------------------------------------------------
# Oracle thin client shim (oracledb replaces cx_Oracle)
# Must run before any DB connection is made
# ---------------------------------------------------------------------------
try:
    import oracledb

    oracledb.version = "8.3.0"
    sys.modules["cx_Oracle"] = oracledb
except ImportError:
    logger.warning("oracledb not installed — Oracle connections unavailable")

# ---------------------------------------------------------------------------
# Cypress test config override
# ---------------------------------------------------------------------------
if os.getenv("CYPRESS_CONFIG") == "true":
    base_dir = os.path.dirname(__file__)
    module_folder = os.path.abspath(
        os.path.join(base_dir, "../../tests/integration_tests/")
    )
    sys.path.insert(0, module_folder)
    from superset_test_config import *  # noqa

    sys.path.pop(0)

# ---------------------------------------------------------------------------
# Local Docker overrides (imported once, at the end)
# ---------------------------------------------------------------------------
try:
    import superset_config_docker
    from superset_config_docker import *  # noqa: F403

    logger.info(
        "Loaded your Docker configuration at [%s]", superset_config_docker.__file__
    )
except ImportError:
    logger.info("Using default Docker config...")
