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
import { t } from '@apache-superset/core/translation';
import { GenericDataType } from '@apache-superset/core/common';
import {
    ControlPanelConfig,
    Dataset,
    getStandardizedControls,
} from '@superset-ui/chart-controls';
import {
    titleFontSizeControl,
    valueFontSizeControl,
    titleColorControl,
    valueColorControl,
    backgroundColorControl,
    borderRadiusControl,
    customBorderRadiusControl,
    paddingControl,
} from './sharedControls';

export default {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [['metric'], ['adhoc_filters']],
        },
        {
            label: t('Chart Options'),
            expanded: true,
            controlSetRows: [
                [titleFontSizeControl],
                [valueFontSizeControl],
                [titleColorControl],
                [valueColorControl],
                [backgroundColorControl],
                [borderRadiusControl],
                [customBorderRadiusControl],
                [paddingControl],
                [
                    {
                        name: 'hide_dashboard_header',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Hide dashboard header'),
                            description: t('Hide the chart header (title and controls) when displayed on a dashboard'),
                            default: false,
                            renderTrigger: true,
                        },
                    },
                ],
                ['y_axis_format'],
                ['currency_format'],
                [
                    {
                        name: 'conditional_formatting',
                        config: {
                            type: 'ConditionalFormattingControl',
                            renderTrigger: true,
                            label: t('Conditional Formatting'),
                            description: t(
                                'Apply conditional color formatting to metric',
                            ),
                            shouldMapStateToProps() {
                                return true;
                            },
                            mapStateToProps(explore, _, chart) {
                                const verboseMap = explore?.datasource?.hasOwnProperty(
                                    'verbose_map',
                                )
                                    ? (explore?.datasource as Dataset)?.verbose_map
                                    : (explore?.datasource?.columns ?? {});
                                const { colnames, coltypes } =
                                    chart?.queriesResponse?.[0] ?? {};
                                const numericColumns =
                                    Array.isArray(colnames) && Array.isArray(coltypes)
                                        ? colnames
                                            .filter(
                                                (_: string, index: number) =>
                                                    coltypes[index] === GenericDataType.Numeric,
                                            )
                                            .map((colname: string | number) => ({
                                                value: colname,
                                                label:
                                                    (Array.isArray(verboseMap)
                                                        ? verboseMap[colname as number]
                                                        : verboseMap[colname as string]) ?? colname,
                                                dataType:
                                                    colnames &&
                                                    coltypes[colnames?.indexOf(colname)],
                                            }))
                                        : [];
                                return {
                                    columnOptions: numericColumns,
                                    verboseMap,
                                };
                            },
                        },
                    },
                ],
            ],
        },
    ],
    controlOverrides: {
        y_axis_format: {
            label: t('Number format'),
        },
    },
    formDataOverrides: formData => ({
        ...formData,
        metric: getStandardizedControls().shiftMetric(),
    }),
} as ControlPanelConfig;