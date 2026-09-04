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
            name: 'enableHourFilter',
            config: {
              type: 'CheckboxControl',
              label: t('Filter by hour'),
              default: true,
              renderTrigger: true,
              description: t(
                'When checked, the filter lets the user pick a time of day ' +
                'in addition to the date, for both the start and end. When ' +
                'unchecked, only dates can be picked and the time is fixed ' +
                'at 00:00:00 for the start and 23:59:59 for the end.',
              ),
            },
          },
        ],
        [
          {
            name: 'defaultFillterCustomRange',
            config: {
              type: 'CheckboxControl',
              label: t('Default to custom relative time range'),
              default: false,
              renderTrigger: true,
              description: t(
                'When checked, configure Date from and Date to independently relative to today.',
              ),
            },
          },
        ],
        [
          {
            name: 'defaultFillterDateFromDaysAgo',
            config: {
              type: 'InputNumber',
              label: t('Date from: days ago'),
              default: 3,
              renderTrigger: true,
              min: 0,
              description: t(
                'Days before today for the start of the default range. Use 0 for today.',
              ),
            },
          },
          {
            name: 'defaultFillterDateFromHour',
            config: {
              type: 'InputNumber',
              label: t('Date from: hour'),
              default: 0,
              renderTrigger: true,
              min: 0,
              max: 23,
              description: t('Hour for the start of the default range (0-23).'),
            },
          },
          {
            name: 'defaultFillterDateFromMinute',
            config: {
              type: 'InputNumber',
              label: t('Date from: minute'),
              default: 0,
              renderTrigger: true,
              min: 0,
              max: 59,
              description: t(
                'Minute for the start of the default range (0-59).',
              ),
            },
          },
        ],
        [
          {
            name: 'defaultFillterDateToDaysAgo',
            config: {
              type: 'InputNumber',
              label: t('Date to: offset days'),
              default: 0,
              renderTrigger: true,
              description: t(
                'Days relative to today for the end of the default range. Use a negative value for a past day, 0 for today, or a positive value for a future day.',
              ),
            },
          },
          {
            name: 'defaultFillterDateToHour',
            config: {
              type: 'InputNumber',
              label: t('Date to: hour'),
              default: 23,
              renderTrigger: true,
              min: 0,
              max: 23,
              description: t('Hour for the end of the default range (0-23).'),
            },
          },
          {
            name: 'defaultFillterDateToMinute',
            config: {
              type: 'InputNumber',
              label: t('Date to: minute'),
              default: 59,
              renderTrigger: true,
              min: 0,
              max: 59,
              description: t('Minute for the end of the default range (0-59).'),
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
