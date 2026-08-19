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
import React, { useEffect, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import {
    ensureIsArray,
    validateNonEmpty,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
    ControlPanelConfig,
    dndGroupByControl,
    columnsByType,
    D3_FORMAT_OPTIONS,
    D3_FORMAT_DOCS,
    D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
    ControlComponentProps,
    CustomControlItem,
} from '@superset-ui/chart-controls';
import { showLegendControl, showValueControl } from '../controls';
import { ReferenceLineConfig } from './types';

// Pre-computed statistics columns fetched by default; kept as the control's
// default value so existing charts keep working, but can now be edited from
// the UI instead of requiring a code change.
const DEFAULT_CUSTOM_COLUMNS = [
    'MEAN',
    'SIGMA',
    'N',
    'LSL',
    'USL',
    'TARGET',
    'PLUS_3_SIGMA',
    'MINUS_3_SIGMA',
    'CP',
    'CPK',
    'FACTORY',
    'CHART_ID',
    'CHAR_ID',
];

const DEFAULT_REF_LINES: ReferenceLineConfig[] = [
    {
        field: 'LSL',
        show: true,
        label: 'LSL',
        color: { r: 255, g: 0, b: 0, a: 1 },
        lineStyle: 'dashed',
        width: 2,
        opacity: 1,
        showValue: true,
        showLabel: true,
        labelPosition: 'start',
    },
    {
        field: 'USL',
        show: true,
        label: 'USL',
        color: { r: 255, g: 0, b: 0, a: 1 },
        lineStyle: 'dashed',
        width: 2,
        opacity: 1,
        showValue: true,
        showLabel: true,
        labelPosition: 'start',
    },
    {
        field: 'TARGET',
        show: true,
        label: 'Target',
        color: { r: 0, g: 170, b: 0, a: 1 },
        lineStyle: 'dashed',
        width: 2,
        opacity: 1,
        showValue: true,
        showLabel: true,
        labelPosition: 'start',
    },
    {
        field: 'MEAN',
        show: true,
        label: 'Mean',
        color: { r: 0, g: 0, b: 255, a: 1 },
        lineStyle: 'solid',
        width: 2,
        opacity: 1,
        showValue: true,
        showLabel: true,
        labelPosition: 'start',
    },
    {
        field: 'PLUS_3_SIGMA',
        show: true,
        label: 'UCL',
        color: { r: 255, g: 136, b: 0, a: 1 },
        lineStyle: 'dashed',
        width: 2,
        opacity: 1,
        showValue: true,
        showLabel: true,
        labelPosition: 'start',
    },
    {
        field: 'MINUS_3_SIGMA',
        show: true,
        label: 'LCL',
        color: { r: 255, g: 136, b: 0, a: 1 },
        lineStyle: 'dashed',
        width: 2,
        opacity: 1,
        showValue: true,
        showLabel: true,
        labelPosition: 'start',
    },
];

const LINE_STYLE_OPTIONS: [string, string][] = [
    ['solid', 'Solid'],
    ['dashed', 'Dashed'],
    ['dotted', 'Dotted'],
];

const LABEL_POSITION_OPTIONS: [string, string][] = [
    ['start', 'Start'],
    ['middle', 'Middle'],
    ['end', 'End'],
];

function createEmptyRefLine(): ReferenceLineConfig {
    return {
        field: '',
        show: true,
        label: '',
        color: { r: 255, g: 0, b: 0, a: 1 },
        lineStyle: 'dashed',
        width: 2,
        opacity: 1,
        showValue: true,
        showLabel: true,
        labelPosition: 'start',
    };
}

// ---- Inline styles ----
const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
};
const rowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    background: '#fafafa',
};
const rowSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 80,
};
const rowLabelStyle: React.CSSProperties = {
    fontSize: 10,
    color: '#999',
    textTransform: 'uppercase',
};
const addButtonRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-start',
    marginTop: 4,
};
const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 32,
    padding: '0 8px',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
};
const selectStyle: React.CSSProperties = {
    height: 32,
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    background: '#fff',
};
const checkboxStyle: React.CSSProperties = {
    marginTop: 6,
};
const removeBtnStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'red',
    fontSize: 16,
    padding: '4px 8px',
};
const addBtnStyle: React.CSSProperties = {
    border: '1px dashed #ccc',
    background: 'transparent',
    cursor: 'pointer',
    padding: '6px 16px',
    borderRadius: 4,
    color: '#666',
};

function SimpleColorPicker({
    value,
    onChange,
}: {
    value: { r: number; g: number; b: number; a: number };
    onChange: (color: { r: number; g: number; b: number; a: number }) => void;
}) {
    const hex = `#${((1 << 24) + (value.r << 16) + (value.g << 8) + value.b)
        .toString(16)
        .slice(1)}`;
    return (
        <input
            type="color"
            value={hex}
            style={{ width: 32, height: 32, border: 'none', cursor: 'pointer' }}
            onChange={e => {
                const h = e.target.value;
                onChange({
                    r: parseInt(h.substring(1, 3), 16),
                    g: parseInt(h.substring(3, 5), 16),
                    b: parseInt(h.substring(5, 7), 16),
                    a: value.a,
                });
            }}
        />
    );
}

interface ReferenceLinesControlProps
    extends ControlComponentProps<ReferenceLineConfig[]> { }

export function ReferenceLinesControl(props: ReferenceLinesControlProps) {
    const { value, onChange } = props;
    const arr = ensureIsArray(value);
    const refLines: ReferenceLineConfig[] = arr.length > 0 ? arr : DEFAULT_REF_LINES;
    const hasInitialized = useRef(false);

    // Persist defaults to formData on first render when value is empty
    useEffect(() => {
        if (!hasInitialized.current && onChange && arr.length === 0) {
            onChange(DEFAULT_REF_LINES);
        }
        hasInitialized.current = true;
    }, []);

    const updateLine = (index: number, updates: Partial<ReferenceLineConfig>) => {
        if (onChange) {
            const next = [...refLines];
            next[index] = { ...next[index], ...updates };
            onChange(next);
        }
    };

    const addLine = () => {
        if (onChange) {
            onChange([...refLines, createEmptyRefLine()]);
        }
    };

    const removeLine = (index: number) => {
        if (onChange) {
            onChange(refLines.filter((_, i) => i !== index));
        }
    };

    return (
        <div style={containerStyle}>
            {refLines.map((line, idx) => (
                <div key={idx} style={rowStyle}>
                    <div style={{ ...rowSectionStyle, minWidth: 100 }}>
                        <span style={rowLabelStyle}>{t('Field')}</span>
                        <input
                            type="text"
                            value={line.field}
                            placeholder={t('Backend column')}
                            style={inputStyle}
                            onChange={e => updateLine(idx, { field: e.target.value })}
                        />
                    </div>

                    <div style={{ ...rowSectionStyle, minWidth: 60 }}>
                        <span style={rowLabelStyle}>{t('Enable')}</span>
                        <input
                            type="checkbox"
                            checked={line.show}
                            style={checkboxStyle}
                            onChange={e => updateLine(idx, { show: e.target.checked })}
                        />
                    </div>

                    <div style={{ ...rowSectionStyle, flex: 1, minWidth: 100 }}>
                        <span style={rowLabelStyle}>{t('Label')}</span>
                        <input
                            type="text"
                            value={line.label}
                            placeholder={t('Display label')}
                            style={inputStyle}
                            onChange={e => updateLine(idx, { label: e.target.value })}
                        />
                    </div>

                    <div style={{ ...rowSectionStyle, minWidth: 40 }}>
                        <span style={rowLabelStyle}>{t('Color')}</span>
                        <SimpleColorPicker
                            value={line.color}
                            onChange={color => updateLine(idx, { color })}
                        />
                    </div>

                    <div style={{ ...rowSectionStyle, minWidth: 80 }}>
                        <span style={rowLabelStyle}>{t('Style')}</span>
                        <select
                            value={line.lineStyle}
                            style={selectStyle}
                            onChange={e =>
                                updateLine(idx, {
                                    lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted',
                                })
                            }
                        >
                            {LINE_STYLE_OPTIONS.map(([val, lbl]) => (
                                <option key={val} value={val}>
                                    {lbl}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ ...rowSectionStyle, minWidth: 60 }}>
                        <span style={rowLabelStyle}>{t('Width')}</span>
                        <input
                            type="number"
                            value={line.width}
                            min={1}
                            max={10}
                            style={inputStyle}
                            onChange={e =>
                                updateLine(idx, { width: parseInt(e.target.value, 10) || 1 })
                            }
                        />
                    </div>

                    <div style={{ ...rowSectionStyle, minWidth: 60 }}>
                        <span style={rowLabelStyle}>{t('Opacity')}</span>
                        <input
                            type="number"
                            value={line.opacity}
                            min={0}
                            max={1}
                            step={0.1}
                            style={inputStyle}
                            onChange={e =>
                                updateLine(idx, {
                                    opacity: parseFloat(e.target.value) || 0,
                                })
                            }
                        />
                    </div>

                    <div style={{ ...rowSectionStyle, minWidth: 50 }}>
                        <span style={rowLabelStyle}>{t('Show Value')}</span>
                        <input
                            type="checkbox"
                            checked={line.showValue}
                            style={checkboxStyle}
                            onChange={e =>
                                updateLine(idx, { showValue: e.target.checked })
                            }
                        />
                    </div>

                    <div style={{ ...rowSectionStyle, minWidth: 50 }}>
                        <span style={rowLabelStyle}>{t('Show Label')}</span>
                        <input
                            type="checkbox"
                            checked={line.showLabel}
                            style={checkboxStyle}
                            onChange={e =>
                                updateLine(idx, { showLabel: e.target.checked })
                            }
                        />
                    </div>

                    <div style={{ ...rowSectionStyle, minWidth: 80 }}>
                        <span style={rowLabelStyle}>{t('Label Pos')}</span>
                        <select
                            value={line.labelPosition}
                            style={selectStyle}
                            onChange={e =>
                                updateLine(idx, {
                                    labelPosition: e.target.value as
                                        | 'start'
                                        | 'middle'
                                        | 'end',
                                })
                            }
                        >
                            {LABEL_POSITION_OPTIONS.map(([val, lbl]) => (
                                <option key={val} value={val}>
                                    {lbl}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div
                        style={{
                            ...rowSectionStyle,
                            minWidth: 30,
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                        }}
                    >
                        <span style={rowLabelStyle}>&nbsp;</span>
                        <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            style={removeBtnStyle}
                            title={t('Remove reference line')}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            ))}

            <div style={addButtonRowStyle}>
                <button
                    type="button"
                    onClick={addLine}
                    style={addBtnStyle}
                >
                    + {t('Add Reference Line')}
                </button>
            </div>
        </div>
    );
}

const referenceLinesControl: CustomControlItem = {
    name: 'referenceLines',
    config: {
        type: ReferenceLinesControl,
        label: t('Reference Lines'),
        default: DEFAULT_REF_LINES,
        renderTrigger: true,
        description: t(
            'Add and configure reference lines (LSL, USL, Target, Mean, UCL, LCL, etc.). Each line reads from a computed backend column.',
        ),
    },
};

const config: ControlPanelConfig = {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'column',
                        config: {
                            ...dndGroupByControl,
                            label: t('Column'),
                            multi: false,
                            default: null,
                            description: t('Numeric column for cycle time data.'),
                            validators: [validateNonEmpty],
                            freeForm: false,
                            disabledTabs: new Set(['saved', 'sqlExpression']),
                            mapStateToProps: ({ datasource }) => ({
                                options: columnsByType(datasource, GenericDataType.Numeric),
                            }),
                        },
                    },
                ],
                [
                    {
                        name: 'customColumns',
                        config: {
                            ...dndGroupByControl,
                            label: t('Custom Columns'),
                            multi: true,
                            default: DEFAULT_CUSTOM_COLUMNS,
                            freeForm: true,
                            description: t(
                                'Additional pre-computed columns to fetch from the dataset (e.g. MEAN, LSL, CP...). Add or remove without editing code.',
                            ),
                            mapStateToProps: ({ datasource }) => ({
                                options: columnsByType(datasource),
                            }),
                        },
                    },
                ],
                ['metrics'],
                ['adhoc_filters'],
                ['row_limit'],
            ],
        },
        {
            label: t('Reference Lines'),
            expanded: true,
            controlSetRows: [[referenceLinesControl]],
        },
        {
            label: t('Normal Distribution Curve'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'showNormalCurve',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Normal Curve'),
                            default: true,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'normalCurveColor',
                        config: {
                            type: 'ColorPickerControl',
                            label: t('Curve Color'),
                            default: { r: 255, g: 102, b: 0, a: 1 },
                            renderTrigger: true,
                        },
                    },
                    {
                        name: 'normalCurveOpacity',
                        config: {
                            type: 'TextControl',
                            label: t('Opacity'),
                            default: 0.8,
                            isFloat: true,
                            renderTrigger: true,
                        },
                    },
                ],
            ],
        },
        {
            label: t('Chart Options'),
            expanded: true,
            controlSetRows: [
                ['color_scheme'],
                [showValueControl],
                [showLegendControl],
                [
                    {
                        name: 'x_axis_title',
                        config: {
                            type: 'TextControl',
                            label: t('X Axis Title'),
                            renderTrigger: true,
                            default: 'Cycle Time',
                        },
                    },
                ],
                [
                    {
                        name: 'x_axis_format',
                        config: {
                            type: 'SelectControl',
                            freeForm: true,
                            label: t('X Axis Format'),
                            renderTrigger: true,
                            default: 'SMART_NUMBER',
                            choices: D3_FORMAT_OPTIONS,
                            description: `${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`,
                        },
                    },
                ],
                [
                    {
                        name: 'y_axis_title',
                        config: {
                            type: 'TextControl',
                            label: t('Y Axis Title'),
                            renderTrigger: true,
                            default: 'Frequency',
                        },
                    },
                ],
                [
                    {
                        name: 'y_axis_format',
                        config: {
                            type: 'SelectControl',
                            freeForm: true,
                            label: t('Y Axis Format'),
                            renderTrigger: true,
                            default: 'SMART_NUMBER',
                            choices: D3_FORMAT_OPTIONS,
                            description: `${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`,
                        },
                    },
                ],
            ],
        },
    ],
    controlOverrides: {
        metrics: {
            validators: [],
            default: [],
            description: t(
                'Optional. Add aggregated metrics on top of the pre-computed statistics. When set, data is grouped by the columns above instead of being passed through row by row.',
            ),
        },
    },
};

export default config;