#!/usr/bin/env bash
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
set -e

#
# Always install local overrides first
#
/app/docker/docker-bootstrap.sh

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    STEP_CNT=6
else
    STEP_CNT=5
fi

echo_step() {
cat <<EOF
######################################################################
Init Step ${1}/${STEP_CNT} [${2}] -- ${3}
######################################################################
EOF
}
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
# If Cypress run – overwrite the password for admin and export env variables
if [ "$CYPRESS_CONFIG" == "true" ]; then
    ADMIN_PASSWORD="general"
    export SUPERSET_TESTENV=true
    export POSTGRES_DB=superset_cypress
    export SUPERSET__SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://superset:superset@db:5432/superset_cypress
fi
# Initialize the database
echo_step "1" "Starting" "Applying DB migrations"
superset db upgrade
echo_step "1" "Complete" "Applying DB migrations"

# Create an admin user
echo_step "2" "Starting" "Setting up admin user ( admin / $ADMIN_PASSWORD )"
if [ "$CYPRESS_CONFIG" == "true" ]; then
    superset load_test_users
else
    superset fab create-admin \
        --username admin \
        --email admin@superset.com \
        --password "$ADMIN_PASSWORD" \
        --firstname Superset \
        --lastname Admin
fi
echo_step "2" "Complete" "Setting up admin user"
# Create default roles and permissions
echo_step "3" "Starting" "Setting up roles and perms"
superset init
echo_step "3" "Complete" "Setting up roles and perms"

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    # Load some data to play with
    echo_step "4" "Starting" "Loading examples"


    # If Cypress run which consumes superset_test_config – load required data for tests
    if [ "$CYPRESS_CONFIG" == "true" ]; then
        superset load_examples --load-test-data
    else
        superset load_examples
    fi
    echo_step "4" "Complete" "Loading examples"
    THUMB_STEP=5
else
    THUMB_STEP=4
fi

# Every stack start (including after a rebuild) wipes stale thumbnail
# images from Redis, since a rebuild can change how screenshots render
# (e.g. browser engine), then immediately re-queues a fresh capture for
# every dashboard/chart. On top of this, a full recapture also runs on
# its own every day at midnight (see the "thumbnails.refresh_all" beat
# schedule), independent of restarts.
echo_step "$THUMB_STEP" "Starting" "Flushing thumbnail cache in Redis"
python3 - <<'PYEOF'
import os

import redis

r = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    db=int(os.getenv("REDIS_RESULTS_DB", "1")),
)
keys = list(r.scan_iter("superset_thumbnail_*"))
if keys:
    r.delete(*keys)
print(f"Deleted {len(keys)} thumbnail cache keys")
PYEOF
echo_step "$THUMB_STEP" "Complete" "Flushing thumbnail cache in Redis"

echo_step "$((THUMB_STEP + 1))" "Starting" "Queuing thumbnail capture for all dashboards/charts"
superset compute_thumbnails --asynchronous
echo_step "$((THUMB_STEP + 1))" "Complete" "Queuing thumbnail capture for all dashboards/charts"
