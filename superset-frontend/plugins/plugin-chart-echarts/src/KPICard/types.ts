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
    DataRecordValue,
    QueryFormData,
    QueryFormMetric,
    ValueFormatter,
} from '@superset-ui/core';
import { ColorFormatters } from '@superset-ui/chart-controls';
import { BaseChartProps, Refs } from '../types';

export interface KPIDatum {
    [key: string]: number | string | null;
}

export type KPIFormData = QueryFormData & {
    metric?: QueryFormMetric;
    yAxisFormat?: string;
    currencyFormat?: string;
    titleFontSize?: number;
    valueFontSize?: number;
    titleColor?: { r: number; g: number; b: number; a?: number };
    valueColor?: { r: number; g: number; b: number; a?: number };
    backgroundColor?: { r: number; g: number; b: number; a?: number };
    borderRadius?: number | string;
    customBorderRadius?: number;
    padding?: string;
    conditionalFormatting?: unknown;
    hideDashboardHeader?: boolean;
};

export interface KPIChartDataResponseResult extends ChartDataResponseResult {
    data: KPIDatum[];
}

export type KPIChartProps = BaseChartProps<KPIFormData> & {
    formData: KPIFormData;
    queriesData: KPIChartDataResponseResult[];
};

export type KPIVizProps = {
    className?: string;
    width: number;
    height: number;
    bigNumber?: DataRecordValue;
    headerFormatter: ValueFormatter;
    metricName?: string;
    showMetricName?: boolean;
    titleFontSize?: number;
    valueFontSize?: number;
    titleColor?: string;
    valueColor?: string;
    backgroundColor?: string;
    borderRadius?: number;
    padding?: string;
    onContextMenu?: (
        clientX: number,
        clientY: number,
        filters?: ContextMenuFilters,
    ) => void;
    refs: Refs;
    colorThresholdFormatters?: ColorFormatters;
};