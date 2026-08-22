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
import { ControlPanelConfig } from '@superset-ui/chart-controls';
import {
    CELL_FONT_SIZE_OPTIONS,
    DEFAULT_CELL_FONT_SIZE,
    DEFAULT_HEADER_TREE_JSON,
} from './constants';
import HeaderStructureControl from './HeaderStructureControl';
import RowHeaderColumnFormatControl from './RowHeaderColumnFormatControl';
import RowHighlightRulesControl from './RowHighlightRulesControl';

export default {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                ['groupby'],
                [
                    {
                        name: 'rowHeaderColumnFormats',
                        config: {
                            type: RowHeaderColumnFormatControl,
                            label: t('Row Header Column Format'),
                            default: {},
                            description: t(
                                'Optionally set a number format, fixed width ' +
                                '(px), pin, per-column merge override, and/or ' +
                                'subtotal row for each Row Header Column.',
                            ),
                            mapStateToProps: ({
                                controls,
                                datasource,
                            }: {
                                controls: any;
                                datasource: any;
                            }) => ({
                                groupby: controls?.groupby?.value || [],
                                mergeRowHeaders:
                                    controls?.mergeRowHeaders?.value ?? true,
                                // NOTE: keep this named `datasourceColumns`, not
                                // `columns` -- see the comment on headerTreeJson's
                                // mapStateToProps above for why.
                                datasourceColumns: datasource?.columns || [],
                            }),
                            rerender: ['groupby', 'mergeRowHeaders'],
                        },
                    },
                ],
                ['adhoc_filters'],
                ['row_limit'],
                [
                    {
                        name: 'pivotRowLimit',
                        config: {
                            type: 'TextControl',
                            label: t('Pivot Row Limit'),
                            isInt: true,
                            default: 10000,
                            description: t(
                                'Row limit for each dynamic pivot column group (e.g. one ' +
                                'row per row header × distinct pivot value, such as one ' +
                                'row per FACTORY/MODEL/DIVISION × date). Raise this if a ' +
                                'pivoted date range gets cut off.',
                            ),
                        },
                    },
                ],
            ],
        },
        {
            label: t('Header Structure'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'headerTreeJson',
                        config: {
                            type: HeaderStructureControl,
                            label: t('Header Structure (JSON)'),
                            default: DEFAULT_HEADER_TREE_JSON,
                            description: t(
                                'Declare the multi-level, merged table header as JSON. Each ' +
                                'entry is one of: a static group ("label" + "children": ' +
                                '[...]), a static leaf column ("label", optionally ' +
                                '"numberFormat", "align" or "width"), or a dynamic pivot ' +
                                'group ("label" + "pivot": {}) that auto-generates one ' +
                                'merged sub-column per distinct value of a chosen column ' +
                                '(e.g. pivot by date). Once you have leaf/pivot columns, ' +
                                'use the pickers below the JSON box to pick which raw ' +
                                'column (or pivot source) each one uses — values shown are ' +
                                'always the exact value from that row, never an aggregate.',
                            ),
                            // NOTE: do NOT name this prop `columns` -- Explore's
                            // generic UPDATE_FORM_DATA_BY_DATASOURCE reducer
                            // treats ANY control whose state has a `columns` key
                            // as a column/metric-referencing control, and on
                            // datasource change re-validates its `value` against
                            // that list via getControlValuesCompatibleWithDatasource.
                            // Since this control's value is a JSON string (not a
                            // column/metric shape), that check always fails and
                            // silently resets the value back to `default`,
                            // wiping out the user's saved Header Structure JSON.
                            mapStateToProps: ({ datasource }: { datasource: any }) => ({
                                datasourceColumns: datasource?.columns || [],
                            }),
                        },
                    },
                ],
            ],
        },
        {
            label: t('Style Options'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'mergeRowHeaders',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Merge Row Headers'),
                            renderTrigger: true,
                            default: true,
                            description: t(
                                'Merge consecutive rows that share the same value in the ' +
                                'row header columns (like merged cells in Excel).',
                            ),
                        },
                    },
                ],
                [
                    {
                        name: 'showGrandTotal',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Total Row'),
                            renderTrigger: true,
                            default: false,
                            description: t(
                                'Add a grand-total row at the very bottom, ' +
                                'summing every numeric column across all rows.',
                            ),
                        },
                    },
                ],
                [
                    {
                        name: 'grandTotalRowPosition',
                        config: {
                            type: 'SelectControl',
                            label: t('Total Row Position'),
                            renderTrigger: true,
                            clearable: false,
                            default: 'bottom',
                            options: [
                                { label: t('Bottom (default)'), value: 'bottom' },
                                { label: t('Top'), value: 'top' },
                            ],
                            description: t(
                                'Where the Total Row appears when "Show Total ' +
                                'Row" is enabled.',
                            ),
                            visibility: ({ controls }: { controls: any }) =>
                                Boolean(controls?.showGrandTotal?.value),
                        },
                    },
                ],
                [
                    {
                        name: 'enableColumnSort',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Enable Column Sort'),
                            renderTrigger: true,
                            default: false,
                            description: t(
                                'Let users click a data column\'s header to sort. ' +
                                'If any Row Header Column has "Subtotal" enabled ' +
                                '(Row Header Column Format), sorting only reorders ' +
                                'rows within that same subtotal group, leaving ' +
                                'groups, merged cells and subtotal/total rows in ' +
                                'place. With no Subtotal configured, sorting ' +
                                'applies to the whole table.',
                            ),
                        },
                    },
                ],
                [
                    {
                        name: 'bordered',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Cell Borders'),
                            renderTrigger: true,
                            default: true,
                            description: t('Show borders around every cell'),
                        },
                    },
                ],
                [
                    {
                        name: 'cellFontSize',
                        config: {
                            type: 'SelectControl',
                            label: t('Cell Font Size'),
                            renderTrigger: true,
                            clearable: false,
                            default: DEFAULT_CELL_FONT_SIZE,
                            options: CELL_FONT_SIZE_OPTIONS,
                            description: t('Font size of table cells'),
                        },
                    },
                ],
                [
                    {
                        name: 'rowHighlightRules',
                        config: {
                            type: RowHighlightRulesControl,
                            label: t('Row Highlight Rules'),
                            renderTrigger: true,
                            default: [],
                            description: t(
                                'Paint an entire row with a custom background/text ' +
                                'color whenever a chosen Row Header Column equals a ' +
                                'given value (e.g. ROW_TYPE = "Rate Bin 2"). The ' +
                                'first matching rule wins.',
                            ),
                            mapStateToProps: ({
                                controls,
                                datasource,
                            }: {
                                controls: any;
                                datasource: any;
                            }) => ({
                                groupby: controls?.groupby?.value || [],
                                datasourceColumns: datasource?.columns || [],
                            }),
                            rerender: ['groupby'],
                        },
                    },
                ],
            ],
        },
    ],
    controlOverrides: {
        groupby: {
            label: t('Row Header Columns'),
            description: t(
                'Columns shown as merged row headers on the left side of the table ' +
                '(e.g. FACTORY, MODEL, DIVISION)',
            ),
        },
        row_limit: {
            default: 1000,
        },
    },
} as ControlPanelConfig;
