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
                            description: t(
                                'Temporal column this filter compares against ' +
                                '(exact match).',
                            ),
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
                                'When checked, the filter lets the user pick a ' +
                                'time of day in addition to the date. When ' +
                                'unchecked, only a date can be picked and the ' +
                                'time is fixed at 00:00:00.',
                            ),
                        },
                    },
                ],
                [
                    {
                        name: 'defaultDateTimeNow',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Default to current date/time'),
                            default: false,
                            renderTrigger: true,
                            description: t(
                                'When checked, the filter defaults to the current ' +
                                'date and time on load.',
                            ),
                            mutuallyExclusiveWith: ['defaultDateTimeDaysAgo'],
                        },
                    },
                ],
                [
                    {
                        name: 'defaultDateTimeDaysAgo',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Default to N days ago'),
                            default: false,
                            renderTrigger: true,
                            description: t(
                                'When checked, the filter defaults to the current ' +
                                'time, N days ago, on load.',
                            ),
                            mutuallyExclusiveWith: ['defaultDateTimeNow'],
                        },
                    },
                ],
                [
                    {
                        name: 'defaultDateTimeDaysAgoNumber',
                        config: {
                            type: 'InputNumber',
                            label: t('Number of days'),
                            default: 3,
                            renderTrigger: true,
                            min: 1,
                            description: t(
                                'Number of days to go back from today when ' +
                                '"Default to N days ago" is enabled.',
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
                                'Set a custom width for this filter control in ' +
                                'pixels. Leave 0 for auto width.',
                            ),
                        },
                    },
                ],
            ],
        },
    ],
};

export default config;
