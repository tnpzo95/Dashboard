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
import { ensureIsArray } from '@superset-ui/core';
import {
    ControlPanelConfig,
    ControlComponentProps,
    CustomControlItem,
} from '@superset-ui/chart-controls';
import { SummaryStatsRowConfig, CellConfig } from './types';
import { DEFAULT_ROWS, createEmptyRow } from './cellConfigs';

// ---- Inline styles ----
const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
};
const rowContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: 8,
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    background: '#fafafa',
    gap: 6,
};
const cellRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    alignItems: 'flex-start',
};
const cellStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
};
const rowLabelStyle: React.CSSProperties = {
    fontSize: 10,
    color: '#999',
    textTransform: 'uppercase',
};
const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 32,
    padding: '0 8px',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
};
const removeBtnStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'red',
    fontSize: 16,
    padding: '4px 8px',
    marginLeft: 'auto',
};
const addBtnStyle: React.CSSProperties = {
    border: '1px dashed #ccc',
    background: 'transparent',
    cursor: 'pointer',
    padding: '6px 16px',
    borderRadius: 4,
    color: '#666',
};

interface SummaryStatsRowsControlProps
    extends ControlComponentProps<SummaryStatsRowConfig[]> { }

export function SummaryStatsRowsControl(
    props: SummaryStatsRowsControlProps,
) {
    const { value, onChange } = props;
    const arr = ensureIsArray<SummaryStatsRowConfig>(value);
    const rows: SummaryStatsRowConfig[] = arr.length > 0 ? arr : DEFAULT_ROWS;
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (!hasInitialized.current && onChange && arr.length === 0) {
            onChange(DEFAULT_ROWS);
        }
        hasInitialized.current = true;
    }, []);

    const updateCell = (
        rowIndex: number,
        cellIndex: number,
        cellUpdates: Partial<CellConfig>,
    ) => {
        if (onChange) {
            const next = [...rows];
            const cells = [...next[rowIndex].cells] as [
                CellConfig,
                CellConfig,
                CellConfig,
                CellConfig,
            ];
            cells[cellIndex] = { ...cells[cellIndex], ...cellUpdates };
            next[rowIndex] = { ...next[rowIndex], cells };
            onChange(next);
        }
    };

    const addRow = () => {
        if (onChange) {
            onChange([...rows, createEmptyRow()]);
        }
    };

    const removeRow = (index: number) => {
        if (onChange) {
            onChange(rows.filter((_, i) => i !== index));
        }
    };

    return (
        <div style={containerStyle}>
            {rows.map((row, rowIdx) => (
                <div key={rowIdx} style={rowContainerStyle}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={() => removeRow(rowIdx)}
                            style={removeBtnStyle}
                            title={t('Remove row')}
                        >
                            ✕
                        </button>
                    </div>
                    <div style={cellRowStyle}>
                        {(row.cells || []).map((cell, cellIdx) => (
                            <div key={cellIdx} style={cellStyle}>
                                <span style={rowLabelStyle}>
                                    {t('Label')} {cellIdx + 1}
                                </span>
                                <input
                                    type="text"
                                    value={cell.label}
                                    placeholder={t('Display label')}
                                    style={inputStyle}
                                    onChange={e =>
                                        updateCell(rowIdx, cellIdx, {
                                            label: e.target.value,
                                        })
                                    }
                                />
                                <span style={rowLabelStyle}>
                                    {t('Column')} {cellIdx + 1}
                                </span>
                                <input
                                    type="text"
                                    value={cell.value}
                                    placeholder={t('Column name')}
                                    style={inputStyle}
                                    onChange={e =>
                                        updateCell(rowIdx, cellIdx, {
                                            value: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div>
                <button type="button" onClick={addRow} style={addBtnStyle}>
                    + {t('Add Row')}
                </button>
            </div>
        </div>
    );
}

const rowsControl: CustomControlItem = {
    name: 'rows',
    config: {
        type: SummaryStatsRowsControl,
        label: t('Data Rows'),
        default: DEFAULT_ROWS,
        renderTrigger: true,
        description: t(
            'Configure rows for the summary statistics table. Each row has 4 columns with a display label and a column name binding.',
        ),
    },
};

export default {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [['columns'], ['adhoc_filters']],
        },
        {
            label: t('Row Configuration'),
            expanded: true,
            controlSetRows: [[rowsControl]],
        },
    ],
} as ControlPanelConfig;