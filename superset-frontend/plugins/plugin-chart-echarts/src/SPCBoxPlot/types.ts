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
import {
    BaseChartProps,
    BaseTransformedProps,
    ContextMenuTransformedProps,
    CrossFilterTransformedProps,
} from '../types';

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

export type SPCBoxPlotQueryFormData = QueryFormData & {
    groupby: QueryFormColumn[];
    metrics: QueryFormMetric[];
    whiskerOptions?: string;
    numberFormat?: string;
    xTicksLayout?: string;
    showLegend: boolean;
    xAxisTitle?: string;
    yAxisTitle?: string;
    referenceLines: ReferenceLineConfig[];
};

export interface EchartsSPCBoxPlotChartProps
    extends BaseChartProps<SPCBoxPlotQueryFormData> {
    formData: SPCBoxPlotQueryFormData;
}

export type SPCBoxPlotTransformedProps =
    BaseTransformedProps<SPCBoxPlotQueryFormData> &
    CrossFilterTransformedProps &
    ContextMenuTransformedProps;