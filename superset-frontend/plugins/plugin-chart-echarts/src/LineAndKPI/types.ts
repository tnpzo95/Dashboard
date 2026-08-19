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
    ChartDataResponseResult,
    ContextMenuFilters,
    QueryFormData,
    QueryFormMetric,
} from '@superset-ui/core';
import { BaseChartProps } from '../types';

export interface LineAndKPIDatum {
    [key: string]: number | string | null;
}

export interface KPICardConfig {
    id: string;
    title: string;
    // Either a saved metric name, or an adhoc metric (e.g. MAX of a
    // chosen column) whose value should be displayed on the card
    metric?: QueryFormMetric;
    // Which query result to read the metric value from:
    // 0 = line chart (time series) query, uses the latest row
    // 1 = aggregated query, uses the single aggregated row
    queryIndex: 0 | 1;
    borderColor?: string;
    enabled: boolean;
    // Per-card d3-format string; falls back to the chart-level Number
    // format (yAxisFormat) when unset.
    numberFormat?: string;
}

export type LineAndKPIFormData = QueryFormData & {
    metrics?: QueryFormMetric[];
    xAxis?: string;
    timeGrainSqla?: string;
    yAxisFormat?: string;
    currencyFormat?: string;
    // Raw JS object literal (from the "ECharts Options" control) safely
    // parsed and deep-merged into the generated line chart echarts options.
    echartOptions?: string;
    containerTitle?: string;
    containerTitleColor?: { r: number; g: number; b: number; a?: number };
    containerBackgroundColor?: { r: number; g: number; b: number; a?: number };
    containerBorderRadius?: number | string;
    customContainerBorderRadius?: number;
    kpiCards?: KPICardConfig[];
    kpiTitleColor?: { r: number; g: number; b: number; a?: number };
    kpiValueColor?: { r: number; g: number; b: number; a?: number };
    kpiTitleFontSize?: number;
    showLineChart?: boolean;
    showLegend?: boolean;
    showTrendLine?: boolean;
    lineColor?: { r: number; g: number; b: number; a?: number };
    lineChartHeight?: number;
    // Series Order
    sortSeriesType?: 'name' | 'sum' | 'min' | 'max' | 'avg';
    sortSeriesAscending?: boolean;
    // Legend
    legendType?: 'scroll' | 'plain';
    legendOrientation?: 'top' | 'bottom' | 'left' | 'right';
    legendMargin?: number | string | null;
    legendSort?: 'asc' | 'desc' | null;
    // X Axis
    xAxisTitle?: string;
    xAxisLabelRotation?: number | string;
    xAxisLabelInterval?: string;
    // Tooltip
    richTooltip?: boolean;
    tooltipNumberFormat?: string;
    // Y Axis
    yAxisTitle?: string;
    logAxis?: boolean;
    minorSplitLine?: boolean;
    yAxisBounds?: [number | null, number | null];
};

export interface LineAndKPIChartDataResponseResult extends ChartDataResponseResult {
    data: LineAndKPIDatum[];
}

export type LineAndKPIChartProps = BaseChartProps<LineAndKPIFormData> & {
    formData: LineAndKPIFormData;
    queriesData: LineAndKPIChartDataResponseResult[];
};

export interface KPIItem {
    title: string;
    value: string;
    borderColor?: string;
}

export type LineAndKPIVizProps = {
    className?: string;
    width: number;
    height: number;
    // Line chart data
    echartOptions?: any;
    chartRefs: any;
    // KPI data
    kpiItems: KPIItem[];
    // Container styling
    containerTitle?: string;
    containerTitleColor?: string;
    containerBackgroundColor?: string;
    containerBorderRadius?: number;
    // KPI styling
    kpiTitleColor?: string;
    kpiValueColor?: string;
    kpiTitleFontSize?: number;
    // Options
    showLineChart?: boolean;
    // Chart event handlers
    onContextMenu?: (
        clientX: number,
        clientY: number,
        filters?: ContextMenuFilters,
    ) => void;
};