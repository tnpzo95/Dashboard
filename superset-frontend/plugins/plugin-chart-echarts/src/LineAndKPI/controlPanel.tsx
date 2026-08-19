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
import {
    ControlPanelConfig,
    ControlSubSectionHeader,
    D3_FORMAT_DOCS,
    D3_FORMAT_OPTIONS,
    DEFAULT_SORT_SERIES_DATA,
    SORT_SERIES_CHOICES,
    defineSavedMetrics,
    getStandardizedControls,
} from '@superset-ui/chart-controls';
import { legendSection, xAxisLabelInterval, xAxisLabelRotation } from '../controls';
import {
    CONTAINER_BORDER_RADIUS_OPTIONS,
    KPI_TITLE_FONT_SIZE_OPTIONS,
    LINE_CHART_HEIGHT_OPTIONS,
    DEFAULT_CONTAINER_BORDER_RADIUS,
    DEFAULT_KPI_TITLE_FONT_SIZE,
    DEFAULT_LINE_CHART_HEIGHT,
} from './constants';
import KPICardsControl from './KPICardsControl';

export default {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                ['x_axis'],
                ['time_grain_sqla'],
                ['metrics'],
                ['adhoc_filters'],
            ],
        },
        {
            label: t('Container Options'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'container_border_radius',
                        config: {
                            type: 'SelectControl',
                            label: t('Container Border Radius'),
                            renderTrigger: true,
                            clearable: false,
                            default: DEFAULT_CONTAINER_BORDER_RADIUS,
                            options: CONTAINER_BORDER_RADIUS_OPTIONS,
                            description: t('Border radius of the container'),
                        },
                    },
                ],
                [
                    {
                        name: 'custom_container_border_radius',
                        config: {
                            type: 'TextControl',
                            label: t('Custom Border Radius'),
                            renderTrigger: true,
                            default: 12,
                            isInt: true,
                            description: t('Custom border radius value in pixels'),
                            visibility: ({ controls }) =>
                                controls?.container_border_radius?.value === 'custom',
                        },
                    },
                ],
            ],
        },
        {
            label: t('Line Chart Options'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'show_line_chart',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Line Chart'),
                            renderTrigger: true,
                            default: true,
                            description: t('Toggle the line chart visibility'),
                        },
                    },
                ],
                [
                    {
                        name: 'line_chart_height',
                        config: {
                            type: 'SelectControl',
                            label: t('Line Chart Height'),
                            renderTrigger: true,
                            clearable: false,
                            default: DEFAULT_LINE_CHART_HEIGHT,
                            options: LINE_CHART_HEIGHT_OPTIONS,
                            description: t('Height percentage of the line chart area'),
                        },
                    },
                ],
                ['y_axis_format'],
                ['currency_format'],
            ],
        },
        {
            label: t('Chart Options'),
            expanded: true,
            controlSetRows: [
                [<ControlSubSectionHeader>{t('Series Order')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'sort_series_type',
                        config: {
                            type: 'SelectControl',
                            freeForm: false,
                            label: t('Sort Series By'),
                            choices: SORT_SERIES_CHOICES,
                            default: DEFAULT_SORT_SERIES_DATA.sort_series_type,
                            renderTrigger: true,
                            description: t(
                                'Based on what should series be ordered on the ' +
                                'chart and legend',
                            ),
                        },
                    },
                ],
                [
                    {
                        name: 'sort_series_ascending',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Sort Series Ascending'),
                            default: DEFAULT_SORT_SERIES_DATA.sort_series_ascending,
                            renderTrigger: true,
                            description: t('Sort series in ascending order'),
                        },
                    },
                ],
                ...legendSection,
                [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'x_axis_title',
                        config: {
                            type: 'TextControl',
                            label: t('X Axis Title'),
                            renderTrigger: true,
                            default: '',
                            description: t('Title text for the X axis'),
                        },
                    },
                ],
                [xAxisLabelRotation],
                [xAxisLabelInterval],
                [<ControlSubSectionHeader>{t('Tooltip')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'rich_tooltip',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Rich tooltip'),
                            renderTrigger: true,
                            default: true,
                            description: t(
                                'Shows the values of every series at that point in ' +
                                'time. If disabled, only the hovered series is shown.',
                            ),
                        },
                    },
                ],
                [
                    {
                        name: 'tooltip_number_format',
                        config: {
                            type: 'SelectControl',
                            freeForm: true,
                            label: t('Tooltip Number Format'),
                            renderTrigger: true,
                            default: null,
                            choices: D3_FORMAT_OPTIONS,
                            clearable: true,
                            description: t(
                                'Number format for values shown in the tooltip. ' +
                                'Defaults to the chart Number format when left ' +
                                'empty. ',
                            ) + D3_FORMAT_DOCS,
                        },
                    },
                ],
                [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
                [
                    {
                        name: 'y_axis_title',
                        config: {
                            type: 'TextControl',
                            label: t('Y Axis Title'),
                            renderTrigger: true,
                            default: '',
                            description: t('Title text for the Y axis'),
                        },
                    },
                ],
                [
                    {
                        name: 'logAxis',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Logarithmic y-axis'),
                            renderTrigger: true,
                            default: false,
                            description: t('Logarithmic y-axis'),
                        },
                    },
                ],
                [
                    {
                        name: 'minorSplitLine',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Minor Split Line'),
                            renderTrigger: true,
                            default: false,
                            description: t('Draw split lines for minor y-axis ticks'),
                        },
                    },
                ],
                [
                    {
                        name: 'y_axis_bounds',
                        config: {
                            type: 'BoundsControl',
                            label: t('Y Axis Bounds'),
                            renderTrigger: true,
                            default: [null, null],
                            description: t(
                                'Bounds for the Y-axis. When left empty, the bounds ' +
                                'are dynamically defined based on the min/max of ' +
                                'the data.',
                            ),
                        },
                    },
                ],
                ['echart_options'],
            ],
        },
        {
            label: t('KPI Cards Options'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'kpiCards',
                        config: {
                            type: KPICardsControl,
                            label: t('KPI Cards'),
                            renderTrigger: true,
                            default: [],
                            description: t(
                                'Add, remove and reorder KPI cards. Each card displays the ' +
                                'value of the metric you select for it.',
                            ),
                            // NOTE: do NOT name these props `savedMetrics`/`columns`
                            // -- Explore's generic UPDATE_FORM_DATA_BY_DATASOURCE
                            // reducer treats any control whose state has a
                            // `savedMetrics` or `columns` key as a column/metric
                            // picker, and on datasource change re-validates its
                            // `value` against that list, filtering out anything
                            // that isn't a recognized metric/column shape. Since
                            // `kpiCards`'s value is a list of custom KPI card
                            // config objects, that check always fails and
                            // silently wipes the whole list back to `default`.
                            mapStateToProps: ({ datasource }: { datasource: any }) => ({
                                kpiSavedMetrics: defineSavedMetrics(datasource),
                                kpiColumns: datasource?.columns || [],
                            }),
                        },
                    },
                ],
                [
                    {
                        name: 'kpi_title_color',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('KPI Title Color'),
                            renderTrigger: true,
                            default: { r: 255, g: 255, b: 255, a: 1 },
                            description: t('Color of all KPI titles'),
                        },
                    },
                ],
                [
                    {
                        name: 'kpi_value_color',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('KPI Value Color'),
                            renderTrigger: true,
                            default: { r: 255, g: 255, b: 255, a: 1 },
                            description: t('Color of all KPI values'),
                        },
                    },
                ],
                [
                    {
                        name: 'kpi_title_font_size',
                        config: {
                            type: 'SelectControl',
                            label: t('KPI Title Font Size'),
                            renderTrigger: true,
                            clearable: false,
                            default: DEFAULT_KPI_TITLE_FONT_SIZE,
                            options: KPI_TITLE_FONT_SIZE_OPTIONS,
                            description: t('Font size of KPI titles'),
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
        x_axis: {
            label: t('X-Axis Column'),
        },
    },
    formDataOverrides: formData => ({
        ...formData,
        metrics: getStandardizedControls().shiftMetric(),
    }),
} as ControlPanelConfig;
