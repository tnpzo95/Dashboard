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
    buildQueryContext,
    getMetricLabel,
    QueryFormMetric,
} from '@superset-ui/core';
import { LineAndKPIFormData } from './types';

const getFormMetricLabel = (metric: QueryFormMetric): string =>
    typeof metric === 'string'
        ? metric
        : metric.label || getMetricLabel(metric);

export default function buildQuery(formData: LineAndKPIFormData) {
    const { metrics, x_axis: xAxis, kpiCards } = formData;
    const xAxisCols = xAxis ? (Array.isArray(xAxis) ? xAxis : [xAxis]) : [];
    // KPI cards may reference a metric that isn't part of the shared
    // "metrics" control used by the line chart, so make sure every card's
    // metric is fetched too. Two different cards (or a card and the shared
    // "metrics" control) can resolve to the same label (e.g. two cards both
    // using MAX(LIMIT_QTY)) even though they're different object instances,
    // so dedupe by the computed label rather than by reference/value.
    const seenLabels = new Set<string>();
    const allMetrics: QueryFormMetric[] = [];
    [...(metrics || []), ...(kpiCards || []).map(card => card.metric)].forEach(
        metric => {
            if (!metric) {
                return;
            }
            const label = getFormMetricLabel(metric);
            if (!seenLabels.has(label)) {
                seenLabels.add(label);
                allMetrics.push(metric);
            }
        },
    );
    return buildQueryContext(formData, baseQueryObject => [
        // Query 1: Time series data for line chart
        {
            ...baseQueryObject,
            metrics: allMetrics,
            columns: xAxisCols,
            groupby: xAxisCols,
            orderby: xAxisCols.length > 0 ? [[xAxisCols[0], true]] : [],
            series_columns: undefined,
        } as any,
        // Query 2: Aggregated data for KPI cards (no time dimension)
        {
            ...baseQueryObject,
            metrics: allMetrics,
            columns: [],
            groupby: [],
            orderby: [],
            row_limit: 1,
            series_columns: undefined,
        } as any,
    ]);
}
