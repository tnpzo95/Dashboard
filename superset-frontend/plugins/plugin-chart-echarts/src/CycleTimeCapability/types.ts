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
import { QueryFormColumn, QueryFormData, QueryFormMetric } from '@superset-ui/core';
import { BaseChartProps, BaseTransformedProps } from '../types';

export interface ReferenceLineConfig {
    field: string;
    show: boolean;
    label: string;
    color: { r: number; g: number; b: number; a: number };
    lineStyle: 'solid' | 'dashed' | 'dotted';
    width: number;
    opacity: number;
    showValue: boolean;
    showLabel: boolean;
    labelPosition: 'start' | 'middle' | 'end';
}

export type CycleTimeCapabilityFormData = QueryFormData & {
    bins: number;
    column: QueryFormColumn;
    customColumns: QueryFormColumn[];
    metrics: QueryFormMetric[];
    sliceId: number;
    showLegend: boolean;
    showValue: boolean;
    xAxisFormat: string;
    xAxisTitle: string;
    yAxisFormat: string;
    yAxisTitle: string;
    referenceLines: ReferenceLineConfig[];
    showNormalCurve: boolean;
    normalCurveColor: any;
    normalCurveOpacity: number;
};

export type CycleTimeCapabilityChartProps = BaseChartProps<CycleTimeCapabilityFormData> & {
    formData: CycleTimeCapabilityFormData;
};

export type CycleTimeCapabilityTransformedProps = BaseTransformedProps<CycleTimeCapabilityFormData> & {
    onFocusedSeries: (index?: number | undefined) => void;
    capabilityMetrics: {
        cp: number | null;
        cpk: number | null;
        pp: number | null;
        ppk: number | null;
        mean: number;
        stdDev: number;
        n: number;
        lsl: number | null;
        usl: number | null;
        target: number | null;
        ucl: number | null;
        lcl: number | null;
        custom: Record<string, number>;
    };
};