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
import { ChartDataResponseResult, QueryFormData } from '@superset-ui/core';
import { BaseChartProps } from '../types';

export interface SummaryStatsDatum {
    [key: string]: number | string | null;
}

export interface CellConfig {
    label: string;
    value: string;
}

export interface SummaryStatsRowConfig {
    cells: [CellConfig, CellConfig, CellConfig, CellConfig];
}

export type SummaryStatsFormData = QueryFormData & {
    rows?: SummaryStatsRowConfig[];
};

export interface SummaryStatsChartDataResponseResult
    extends ChartDataResponseResult {
    data: SummaryStatsDatum[];
}

export type SummaryStatsChartProps = BaseChartProps<SummaryStatsFormData> & {
    formData: SummaryStatsFormData;
    queriesData: SummaryStatsChartDataResponseResult[];
};

export interface StatCell {
    label: string;
    value: string;
}

export interface StatRow {
    cells: [StatCell, StatCell, StatCell, StatCell];
}

export type SummaryStatsVizProps = {
    className?: string;
    width: number;
    height: number;
    rows: StatRow[];
};