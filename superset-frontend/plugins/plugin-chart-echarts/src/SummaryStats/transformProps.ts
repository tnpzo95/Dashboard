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
    SummaryStatsChartProps,
    SummaryStatsVizProps,
    StatRow,
    StatCell,
    SummaryStatsRowConfig,
} from './types';
import { DEFAULT_ROWS, getValue } from './cellConfigs';

export default function transformProps(
    chartProps: SummaryStatsChartProps,
): SummaryStatsVizProps {
    const { width, height, formData, queriesData } = chartProps;

    const data = queriesData[0]?.data || [];
    const row = data[0] as Record<string, unknown> | undefined;

    const rowConfigs: SummaryStatsRowConfig[] =
        formData.rows && formData.rows.length > 0 ? formData.rows : DEFAULT_ROWS;

    const rows: StatRow[] = rowConfigs.map(configRow => {
        const rowCells = configRow.cells || [
            { label: '', value: '' },
            { label: '', value: '' },
            { label: '', value: '' },
            { label: '', value: '' },
        ];
        const cells: [StatCell, StatCell, StatCell, StatCell] = rowCells.map(
            cell => ({
                label: cell.label,
                value: getValue(row, cell.value),
            }),
        ) as [StatCell, StatCell, StatCell, StatCell];
        return { cells };
    });

    return {
        width,
        height,
        rows,
    };
}