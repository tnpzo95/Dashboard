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
import { SummaryStatsRowConfig } from './types';

export function getValue(row: Record<string, unknown> | undefined, colName: string): string {
    if (!row || !colName) return '—';
    const val = row[colName];
    if (val === null || val === undefined) return '—';
    const num = parseFloat(String(val));
    if (!isNaN(num)) {
        // Format numbers nicely
        return num % 1 === 0
            ? num.toLocaleString()
            : num.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    }
    return String(val);
}

function cell(label: string, value: string) {
    return { label, value };
}

export const DEFAULT_ROWS: SummaryStatsRowConfig[] = [
    {
        cells: [
            cell('Mean', 'MEAN'),
            cell('Sigma', 'SIGMA'),
            cell('Sample Count', 'SAMPLE_COUNT'),
            cell('Lot/Res Count', 'LOT_RES_COUNT'),
        ],
    },
    {
        cells: [
            cell('Max Value', 'MAX_VALUE'),
            cell('Min Value', 'MIN_VALUE'),
            cell('OOC Count', 'OOC_COUNT'),
            cell('OOC2 Count', 'OOC2_COUNT'),
        ],
    },
    {
        cells: [
            cell('CP', 'CP'),
            cell('CPK', 'CPK'),
            cell('CPL', 'CPL'),
            cell('CPU', 'CPU'),
        ],
    },
    {
        cells: [
            cell('PP', 'PP'),
            cell('PPK', 'PPK'),
            cell('PPL', 'PPL'),
            cell('PPU', 'PPU'),
        ],
    },
];

export function createEmptyRow(): SummaryStatsRowConfig {
    return {
        cells: [
            { label: '', value: '' },
            { label: '', value: '' },
            { label: '', value: '' },
            { label: '', value: '' },
        ],
    };
}