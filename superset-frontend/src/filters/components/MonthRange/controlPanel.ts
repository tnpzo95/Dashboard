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
import { ControlPanelConfig } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';

const config: ControlPanelConfig = {
    controlPanelSections: [
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
                                'User must select a month range before applying the filter',
                            ),
                        },
                    },
                ],
                [
                    {
                        name: 'defaultFillterTimeNow',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Default to current month'),
                            default: false,
                            renderTrigger: true,
                            description: t(
                                'When checked, the filter defaults to the current month on load.',
                            ),
                            mutuallyExclusiveWith: ['defaultFillterMonthsAgo'],
                        },
                    },
                ],
                [
                    {
                        name: 'defaultFillterMonthsAgo',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Default to N months ago'),
                            default: false,
                            renderTrigger: true,
                            description: t(
                                'When checked, the filter defaults to N months ago through the current month on load.',
                            ),
                            mutuallyExclusiveWith: ['defaultFillterTimeNow'],
                        },
                    },
                ],
                [
                    {
                        name: 'defaultFillterMonthsAgoNumber',
                        config: {
                            type: 'InputNumber',
                            label: t('Number of months'),
                            default: 3,
                            renderTrigger: true,
                            min: 1,
                            description: t(
                                'Number of months to go back from the current month when "Default to N months ago" is enabled.',
                            ),
                        },
                    },
                ],
            ],
        },
    ],
};

export default config;
