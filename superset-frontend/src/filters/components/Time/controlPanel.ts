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
import {
  ControlPanelConfig,
  sharedControls,
} from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';

const config: ControlPanelConfig = {
  // For control input types, see: superset-frontend/src/explore/components/controls/index.js
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: {
              ...sharedControls.groupby,
              label: t('Column'),
              required: true,
            },
          },
        ],
      ],
    },
    {
      label: t('UI Configuration'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'enableEmptyFilter',
            config: {
              type: 'CheckboxControl',
              label: t('Filter value is required'),
              default: false,
              renderTrigger: true,
              description: t(
                'User must select a value before applying the filter',
              ),
            },
          },
        ],
        [
          {
            name: 'defaultFillterTimeNow',
            config: {
              type: 'CheckboxControl',
              label: t('Default to current time'),
              default: false,
              renderTrigger: true,
              description: t(
                'When checked, the filter defaults to today (00:00 to 23:59) on load.',
              ),
              mutuallyExclusiveWith: [
                'defaultFillterWeekNow',
                'defaultFillterMonthNow',
                'defaultFillterShiftNow',
                'defaultFillterDaysAgo',
              ],
            },
          },
        ],
        [
          {
            name: 'defaultFillterWeekNow',
            config: {
              type: 'CheckboxControl',
              label: t('Default to current week'),
              default: false,
              renderTrigger: true,
              description: t(
                'When checked, the filter defaults to the current week (Monday 00:00 to Sunday 23:59) on load.',
              ),
              mutuallyExclusiveWith: [
                'defaultFillterTimeNow',
                'defaultFillterMonthNow',
                'defaultFillterShiftNow',
                'defaultFillterDaysAgo',
              ],
            },
          },
        ],
        [
          {
            name: 'defaultFillterMonthNow',
            config: {
              type: 'CheckboxControl',
              label: t('Default to current month'),
              default: false,
              renderTrigger: true,
              description: t(
                'When checked, the filter defaults to the current month (1st to last day, 00:00 to 23:59) on load.',
              ),
              mutuallyExclusiveWith: [
                'defaultFillterTimeNow',
                'defaultFillterWeekNow',
                'defaultFillterShiftNow',
                'defaultFillterDaysAgo',
              ],
            },
          },
        ],
        [
          {
            name: 'defaultFillterShiftNow',
            config: {
              type: 'CheckboxControl',
              label: t('Default to work shift (08:00 today → 08:00 tomorrow)'),
              default: false,
              renderTrigger: true,
              description: t(
                'When checked, the filter defaults to the current work shift: 08:00 today to 08:00 the next day.',
              ),
              mutuallyExclusiveWith: [
                'defaultFillterTimeNow',
                'defaultFillterWeekNow',
                'defaultFillterMonthNow',
                'defaultFillterDaysAgo',
              ],
            },
          },
        ],
        [
          {
            name: 'defaultFillterDaysAgo',
            config: {
              type: 'CheckboxControl',
              label: t('Default to N days ago'),
              default: false,
              renderTrigger: true,
              description: t(
                'When checked, the filter defaults to N days ago (00:00) through today (23:59) on load.',
              ),
              mutuallyExclusiveWith: [
                'defaultFillterTimeNow',
                'defaultFillterWeekNow',
                'defaultFillterMonthNow',
                'defaultFillterShiftNow',
                'defaultFillterShiftDaysAgo',
              ],
            },
          },
        ],
        [
          {
            name: 'defaultFillterDaysAgoNumber',
            config: {
              type: 'InputNumber',
              label: t('Number of days'),
              default: 3,
              renderTrigger: true,
              min: 1,
              description: t(
                'Number of days to go back from today when "Default to N days ago" is enabled.',
              ),
            },
          },
        ],
        [
          {
            name: 'defaultFillterShiftDaysAgo',
            config: {
              type: 'CheckboxControl',
              label: t('Default to N days ago (from 8:00)'),
              default: false,
              renderTrigger: true,
              description: t(
                'When checked, the filter defaults to N days ago at 08:00 through today at 08:00 on load.',
              ),
              mutuallyExclusiveWith: [
                'defaultFillterTimeNow',
                'defaultFillterWeekNow',
                'defaultFillterMonthNow',
                'defaultFillterShiftNow',
                'defaultFillterDaysAgo',
              ],
            },
          },
        ],
        [
          {
            name: 'defaultFillterShiftDaysAgoNumber',
            config: {
              type: 'InputNumber',
              label: t('Number of days'),
              default: 3,
              renderTrigger: true,
              min: 1,
              description: t(
                'Number of days to go back from today when "Default to N days ago (from 8:00)" is enabled.',
              ),
            },
          },
        ],
        [
          {
            name: 'enableMaxDaysRange',
            config: {
              type: 'CheckboxControl',
              label: t('Limit date range'),
              default: false,
              renderTrigger: true,
              description: t(
                'When checked, user cannot select a date range exceeding the max days.',
              ),
            },
          },
        ],
        [
          {
            name: 'maxDaysRange',
            config: {
              type: 'InputNumber',
              label: t('Max days'),
              default: 3,
              renderTrigger: true,
              min: 1,
              description: t(
                'Maximum number of days allowed in the date range.',
              ),
            },
          },
        ],
        [
          {
            name: 'width',
            config: {
              type: 'InputNumber',
              label: t('Control width (px)'),
              default: 0,
              renderTrigger: true,
              min: 0,
              description: t(
                'Set a custom width for this filter control in pixels. Leave 0 for auto width.',
              ),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
