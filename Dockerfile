#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

######################################################################
# Node stage to deal with static asset construction
######################################################################
ARG PY_VER=3.11.14-slim-trixie

# If BUILDPLATFORM is null, set it to 'amd64' (or leave as is otherwise).
ARG BUILDPLATFORM=${BUILDPLATFORM:-amd64}

# Include translations in the final build
ARG BUILD_TRANSLATIONS="false"

######################################################################
# superset-node-ci used as a base for building frontend assets and CI
######################################################################
FROM --platform=${BUILDPLATFORM} node:22-trixie-slim AS superset-node-ci
ARG BUILD_TRANSLATIONS
ENV BUILD_TRANSLATIONS=${BUILD_TRANSLATIONS}
ARG DEV_MODE="false"
ENV DEV_MODE=${DEV_MODE}

COPY --chmod=755 docker/ /app/docker/

# THÊM DÒNG NÀY - đảm bảo docker-init.sh có quyền execute
RUN find /app/docker -name "*.sh" -type f -exec chmod +x {} \;

RUN chmod +x /app/docker/*.sh

# Fix CRLF line endings from Windows hosts and ensure scripts are executable
RUN apt-get update && apt-get install -y --no-install-recommends dos2unix \
    && rm -rf /var/lib/apt/lists/* \
    && find /app/docker -name "*.sh" -type f -exec dos2unix {} \; \
    && find /app/docker -name "*.sh" -type f -exec chmod 755 {} \;

ARG NPM_BUILD_CMD="build"

RUN bash /app/docker/apt-install.sh build-essential python3 zstd

ENV BUILD_CMD=${NPM_BUILD_CMD} \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN bash /app/docker/frontend-mem-nag.sh

WORKDIR /app/superset-frontend

RUN mkdir -p /app/superset/static/assets \
    /app/superset/translations

RUN --mount=type=bind,source=./superset-frontend/package.json,target=./package.json \
    --mount=type=bind,source=./superset-frontend/package-lock.json,target=./package-lock.json \
    --mount=type=cache,target=/root/.cache \
    --mount=type=cache,target=/root/.npm \
    if [ "${DEV_MODE}" = "false" ]; then \
    npm ci; \
    else \
    echo "Skipping 'npm ci' in dev mode"; \
    fi

COPY superset-frontend /app/superset-frontend

######################################################################
# superset-node is used for compiling frontend assets
######################################################################
FROM superset-node-ci AS superset-node

RUN --mount=type=cache,target=/root/.npm \
    if [ "${DEV_MODE}" = "false" ]; then \
    echo "Running 'npm run ${BUILD_CMD}'"; \
    npm run ${BUILD_CMD}; \
    else \
    echo "Skipping 'npm run ${BUILD_CMD}' in dev mode"; \
    fi

COPY superset/translations /app/superset/translations

RUN if [ "${BUILD_TRANSLATIONS}" = "true" ]; then \
    npm run build-translation; \
    fi; \
    rm -rf /app/superset/translations/*/*/*.[po,mo]


######################################################################
# Base python layer
######################################################################
FROM python:${PY_VER} AS python-base

ARG SUPERSET_HOME="/app/superset_home"
ENV SUPERSET_HOME=${SUPERSET_HOME}

RUN mkdir -p ${SUPERSET_HOME}

RUN useradd --user-group -d ${SUPERSET_HOME} -m --no-log-init --shell /bin/bash superset \
    && chmod -R 1777 ${SUPERSET_HOME} \
    && chown -R superset:superset ${SUPERSET_HOME}

# Copy shell scripts and fix CRLF line endings from Windows hosts
COPY --chmod=755 docker/*.sh /app/docker/

RUN find /app/docker -name "*.sh" -type f -exec sed -i 's/\r$//' {} \; \
    && find /app/docker -name "*.sh" -type f -exec chmod 755 {} \;

RUN pip install --no-cache-dir --upgrade uv

RUN uv venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"

######################################################################
# Python translation compiler layer
######################################################################
FROM python-base AS python-translation-compiler

ARG BUILD_TRANSLATIONS
ENV BUILD_TRANSLATIONS=${BUILD_TRANSLATIONS}

COPY requirements/translations.txt requirements/
RUN --mount=type=cache,target=/root/.cache/uv \
    . /app/.venv/bin/activate && /app/docker/pip-install.sh --requires-build-essential -r requirements/translations.txt

COPY superset/translations/ /app/translations_mo/
RUN if [ "${BUILD_TRANSLATIONS}" = "true" ]; then \
    pybabel compile -d /app/translations_mo | true; \
    fi; \
    rm -f /app/translations_mo/*/*/*.[po,json]

######################################################################
# Python APP common layer
######################################################################
FROM python-base AS python-common

ENV SUPERSET_HOME="/app/superset_home" \
    HOME="/app/superset_home" \
    SUPERSET_ENV="production" \
    FLASK_APP="superset.app:create_app()" \
    PYTHONPATH="/app/pythonpath" \
    SUPERSET_PORT="8088"

# Copy the entrypoints and fix permissions
COPY --chmod=755 docker/entrypoints /app/docker/entrypoints

RUN find /app/docker/entrypoints -name "*.sh" -type f -exec sed -i 's/\r$//' {} \; \
    && find /app/docker/entrypoints -name "*.sh" -type f -exec chmod 755 {} \;

WORKDIR /app

RUN mkdir -p \
    ${PYTHONPATH} \
    superset/static \
    requirements \
    superset-frontend \
    apache_superset.egg-info \
    && touch superset/static/version_info.json \
    && chown -R superset:superset superset/static

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright-browsers

ARG INCLUDE_CHROMIUM="false"
ARG INCLUDE_FIREFOX="false"
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    if [ "${INCLUDE_CHROMIUM}" = "true" ] || [ "${INCLUDE_FIREFOX}" = "true" ]; then \
    uv pip install playwright && \
    playwright install-deps && \
    if [ "${INCLUDE_CHROMIUM}" = "true" ]; then playwright install chromium; fi && \
    if [ "${INCLUDE_FIREFOX}" = "true" ]; then playwright install firefox; fi; \
    else \
    echo "Skipping browser installation"; \
    fi

COPY pyproject.toml setup.py MANIFEST.in README.md ./
COPY superset-frontend/package.json superset-frontend/
COPY scripts/check-env.py scripts/

COPY --chmod=755 ./docker/entrypoints/run-server.sh /usr/bin/run-server.sh
RUN sed -i 's/\r$//' /usr/bin/run-server.sh && chmod 755 /usr/bin/run-server.sh

RUN /app/docker/apt-install.sh \
    curl \
    libsasl2-dev \
    libsasl2-modules-gssapi-mit \
    libpq-dev \
    libecpg-dev \
    libldap2-dev

RUN mkdir -p /app/data && chown -R superset:superset /app/data

COPY --from=superset-node /app/superset/static/assets superset/static/assets

COPY superset superset
RUN rm superset/translations/*/*/*.po

COPY --from=superset-node /app/superset/translations superset/translations
COPY --from=python-translation-compiler /app/translations_mo superset/translations

HEALTHCHECK CMD /app/docker/docker-healthcheck.sh
CMD ["/app/docker/entrypoints/run-server.sh"]
EXPOSE ${SUPERSET_PORT}

######################################################################
# Final lean image...
######################################################################
FROM python-common AS lean

COPY requirements/base.txt requirements/
COPY superset-core superset-core

RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/base.txt

RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install -e .

# Install oracledb with --no-deps to avoid pulling sqlalchemy>=2.0
# The cx_Oracle shim is handled at runtime in superset_config.py
RUN uv pip install --no-deps "oracledb>=2.0.0,<3.0.0"

RUN python -m compileall /app/superset

USER superset

######################################################################
# Dev image...
######################################################################
FROM python-common AS dev

RUN bash /app/docker/apt-install.sh \
    git \
    pkg-config \
    default-libmysqlclient-dev

COPY requirements/*.txt requirements/
COPY superset-core superset-core
COPY superset-extensions-cli superset-extensions-cli

RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/development.txt

RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install -e .

RUN uv pip install .[postgres]

# Install oracledb with --no-deps to avoid pulling sqlalchemy>=2.0
RUN uv pip install --no-deps "oracledb>=2.0.0,<3.0.0"

RUN python -m compileall /app/superset

USER superset

######################################################################
# CI image...
######################################################################
FROM lean AS ci
USER root
RUN uv pip install .[postgres,duckdb]
USER superset
CMD ["/app/docker/entrypoints/docker-ci.sh"]

######################################################################
# Showtime image - lean + DuckDB for examples database
######################################################################
FROM lean AS showtime
USER root
RUN uv pip install .[duckdb]
USER superset
CMD ["/app/docker/entrypoints/docker-ci.sh"]
