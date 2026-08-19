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

export const DEFAULT_CONTAINER_BORDER_RADIUS = 12;
export const DEFAULT_KPI_TITLE_FONT_SIZE = 14;
export const DEFAULT_LINE_CHART_HEIGHT = 60;
export const DEFAULT_AXIS_LABEL_COLOR = '#ffffff';

export const CONTAINER_BORDER_RADIUS_OPTIONS = [
    { label: 'None', value: 0 },
    { label: 'Small (4px)', value: 4 },
    { label: 'Medium (8px)', value: 8 },
    { label: 'Large (12px)', value: 12 },
    { label: 'Extra Large (16px)', value: 16 },
    { label: 'Round (20px)', value: 20 },
    { label: 'Custom', value: 'custom' },
];

export const KPI_TITLE_FONT_SIZE_OPTIONS = [
    { label: 'Tiny (10px)', value: 10 },
    { label: 'Small (12px)', value: 12 },
    { label: 'Normal (14px)', value: 14 },
    { label: 'Medium (16px)', value: 16 },
    { label: 'Large (18px)', value: 18 },
];

export const LINE_CHART_HEIGHT_OPTIONS = [
    { label: 'Small (40%)', value: 40 },
    { label: 'Medium (50%)', value: 50 },
    { label: 'Large (60%)', value: 60 },
    { label: 'Extra Large (70%)', value: 70 },
];

export const KPI_QUERY_SOURCE_OPTIONS = [
    { label: 'Latest value (Line Chart Query)', value: 0 },
    { label: 'Aggregated value (Total Query)', value: 1 },
];

export const KPI_AGGREGATE_OPTIONS = [
    { label: 'MAX', value: 'MAX' },
    { label: 'MIN', value: 'MIN' },
    { label: 'SUM', value: 'SUM' },
    { label: 'AVG', value: 'AVG' },
    { label: 'COUNT', value: 'COUNT' },
    { label: 'COUNT DISTINCT', value: 'COUNT_DISTINCT' },
];

export const DEFAULT_KPI_BORDER_COLORS = [
    '#4CAF50',
    '#FFC107',
    '#F44336',
    '#2196F3',
    '#9C27B0',
    '#00BCD4',
];