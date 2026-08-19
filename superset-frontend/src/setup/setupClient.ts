/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { SupersetClient, ClientConfig } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { store } from 'src/views/store';
import parseCookie from 'src/utils/parseCookie';
import getBootstrapData from 'src/utils/getBootstrapData';

const bootstrapData = getBootstrapData();
let displayedForbiddenToast = false;
let suppressForbiddenRejectionListenerAdded = false;

function isForbiddenResponse(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 403
  );
}

function showForbiddenToast() {
  if (displayedForbiddenToast) {
    return;
  }

  displayedForbiddenToast = true;
  store.dispatch(
    addDangerToast(t('You do not have permission to access this resource.'), {
      noDuplicate: true,
    }),
  );
  window.setTimeout(() => {
    displayedForbiddenToast = false;
  }, 1000);
}

function suppressUnhandledForbiddenRejections() {
  if (suppressForbiddenRejectionListenerAdded) {
    return;
  }

  suppressForbiddenRejectionListenerAdded = true;
  window.addEventListener(
    'unhandledrejection',
    event => {
      if (isForbiddenResponse(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}

function getDefaultConfiguration(): ClientConfig {
  const csrfNode = document.querySelector<HTMLInputElement>('#csrf_token');
  const csrfToken = csrfNode?.value;

  // when using flask-jwt-extended csrf is set in cookies
  const jwtAccessCsrfCookieName =
    bootstrapData.common.conf.JWT_ACCESS_CSRF_COOKIE_NAME;
  const cookieCSRFToken = parseCookie()[jwtAccessCsrfCookieName] || '';

  // Configure retry behavior from backend settings
  const retryConfig = bootstrapData.common.conf;

  // Create exponential backoff delay function with jitter
  const createRetryDelayFunction = () => {
    const baseDelay = retryConfig.SUPERSET_CLIENT_RETRY_DELAY || 1000;
    const multiplier =
      retryConfig.SUPERSET_CLIENT_RETRY_BACKOFF_MULTIPLIER || 2;
    const maxDelay = retryConfig.SUPERSET_CLIENT_RETRY_MAX_DELAY || 10000;

    return (attempt: number) => {
      // Calculate exponential backoff: baseDelay * Math.pow(multiplier, attempt)
      const safeAttempt = Math.min(attempt, 10); // Limit attempt to prevent overflow
      const exponentialDelay = baseDelay * Math.pow(multiplier, safeAttempt);

      // Apply max delay cap
      const cappedDelay = Math.min(exponentialDelay, maxDelay);

      // Add random jitter to prevent thundering herd
      const jitter = Math.random() * cappedDelay;

      return cappedDelay + jitter;
    };
  };

  const fetchRetryOptions = {
    retries: retryConfig.SUPERSET_CLIENT_RETRY_ATTEMPTS || 3,
    retryDelay: createRetryDelayFunction(),
    retryOn: retryConfig.SUPERSET_CLIENT_RETRY_STATUS_CODES || [502, 503, 504],
  };

  return {
    protocol: ['http:', 'https:'].includes(window?.location?.protocol)
      ? (window?.location?.protocol as 'http:' | 'https:')
      : undefined,
    host: window.location?.host || '',
    csrfToken: csrfToken || cookieCSRFToken,
    fetchRetryOptions,
    forbiddenHandler: showForbiddenToast,
  };
}

export default function setupClient(customConfig: Partial<ClientConfig> = {}) {
  suppressUnhandledForbiddenRejections();

  SupersetClient.configure({
    ...getDefaultConfiguration(),
    ...customConfig,
  })
    .init()
    .catch(error => {
      logging.warn('Error initializing SupersetClient', error);
    });
}
