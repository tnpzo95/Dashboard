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
    isAdhocColumn,
    isPhysicalColumn,
    validateNonEmpty,
} from '@superset-ui/core';
import {
    D3_FORMAT_DOCS,
    D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
    D3_FORMAT_OPTIONS,
    D3_TIME_FORMAT_OPTIONS,
    sections,
    ControlPanelConfig,
    getStandardizedControls,
    ControlState,
    ControlPanelState,
    getTemporalColumns,
    sharedControls,
    ControlComponentProps,
    CustomControlItem,
} from '@superset-ui/chart-controls';
import { ReferenceLineConfig } from './types';

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
        field: 'CL',
        show: true,
        label: 'CL',
        color: { r: 0, g: 170, b: 0, a: 1 },
        lineStyle: 'solid',
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
                    <div style={{ ...rowSectionStyle, minWidth: 120 }}>
                        <span style={rowLabelStyle}>{t('Field')}</span>
                        <input
                            type="text"
                            value={line.field}
                            placeholder={t('Column name')}
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
            'Add and configure reference lines (LSL, Target, USL, LCL, CL, UCL, Mean, etc.). Each line reads from a numeric column in your datasource.',
        ),
    },
};

const config: ControlPanelConfig = {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                ['columns'],
                [
                    {
                        name: 'time_grain_sqla',
                        config: {
                            ...sharedControls.time_grain_sqla,
                            visibility: ({ controls }: any) => {
                                const dttmLookup = Object.fromEntries(
                                    ensureIsArray(controls?.columns?.options).map(
                                        (option: any) => [
                                            option.column_name,
                                            option.is_dttm,
                                        ],
                                    ),
                                );

                                return ensureIsArray(controls?.columns.value)
                                    .map((selection: any) => {
                                        if (isAdhocColumn(selection)) {
                                            return true;
                                        }
                                        if (isPhysicalColumn(selection)) {
                                            return !!dttmLookup[selection];
                                        }
                                        return false;
                                    })
                                    .some(Boolean);
                            },
                        },
                    },
                    'temporal_columns_lookup',
                ],
                ['groupby'],
                ['metrics'],
                ['adhoc_filters'],
                ['series_limit'],
                ['series_limit_metric'],
                ['row_limit'],
                [
                    {
                        name: 'whiskerOptions',
                        config: {
                            clearable: false,
                            type: 'SelectControl',
                            freeForm: true,
                            label: t('Whisker/outlier options'),
                            default: 'Tukey',
                            description: t(
                                'Determines how whiskers and outliers are calculated.',
                            ),
                            choices: [
                                ['Tukey', t('Tukey')],
                                ['Min/max (no outliers)', t('Min/max (no outliers)')],
                                ['2/98 percentiles', t('2/98 percentiles')],
                                ['5/95 percentiles', t('5/95 percentiles')],
                                ['9/91 percentiles', t('9/91 percentiles')],
                                ['10/90 percentiles', t('10/90 percentiles')],
                            ],
                        },
                    },
                ],
            ],
        },
        {
            label: t('Reference Lines'),
            expanded: true,
            controlSetRows: [[referenceLinesControl]],
        },
        sections.titleControls,
        {
            label: t('Chart Options'),
            expanded: true,
            controlSetRows: [
                ['color_scheme'],
                ['showLegend'],
                [
                    {
                        name: 'x_ticks_layout',
                        config: {
                            type: 'SelectControl',
                            label: t('X Tick Layout'),
                            choices: [
                                ['auto', t('auto')],
                                ['flat', t('flat')],
                                ['45°', '45°'],
                                ['90°', '90°'],
                                ['staggered', t('staggered')],
                            ],
                            default: 'auto',
                            clearable: false,
                            renderTrigger: true,
                            description: t('The way the ticks are laid out on the X-axis'),
                        },
                    },
                ],
                [
                    {
                        name: 'number_format',
                        config: {
                            type: 'SelectControl',
                            freeForm: true,
                            label: t('Number format'),
                            renderTrigger: true,
                            default: 'SMART_NUMBER',
                            choices: D3_FORMAT_OPTIONS,
                            description: `${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`,
                        },
                    },
                ],
                [
                    {
                        name: 'date_format',
                        config: {
                            type: 'SelectControl',
                            freeForm: true,
                            label: t('Date format'),
                            renderTrigger: true,
                            choices: D3_TIME_FORMAT_OPTIONS,
                            default: 'smart_date',
                            description: D3_FORMAT_DOCS,
                        },
                    },
                ],
                ['zoomable'],
            ],
        },
    ],
    controlOverrides: {
        groupby: {
            label: t('Dimensions'),
            description: t('Categories to group by on the x-axis.'),
        },
        columns: {
            label: t('Distribute across'),
            multi: true,
            description: t('Columns to calculate distribution across.'),
            initialValue: (
                control: ControlState,
                state: ControlPanelState | null,
            ) => {
                if (
                    state &&
                    (!control?.value ||
                        (Array.isArray(control?.value) && control.value.length === 0))
                ) {
                    return [getTemporalColumns(state.datasource).defaultTemporalColumn];
                }
                return control.value;
            },
            validators: [validateNonEmpty],
        },
    },
    formDataOverrides: (formData: any) => {
        const groupby = getStandardizedControls().controls.columns.filter(
            (col: any) => !ensureIsArray(formData.columns).includes(col),
        );
        getStandardizedControls().controls.columns =
            getStandardizedControls().controls.columns.filter(
                (col: any) => !groupby.includes(col),
            );

        return {
            ...formData,
            metrics: getStandardizedControls().popAllMetrics(),
            groupby,
        };
    },
};

export default config;