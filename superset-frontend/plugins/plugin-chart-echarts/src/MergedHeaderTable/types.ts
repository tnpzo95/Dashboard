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
    QueryFormColumn,
    QueryFormData,
} from '@superset-ui/core';
import { BaseChartProps } from '../types';

// Auto-generate one merged sub-column per distinct value found in
// `pivotColumn` (e.g. one column per day), each showing `valueColumn`'s
// value for that row/pivot-value combination — a dynamic alternative to
// manually listing every column in the JSON.
export interface HeaderPivotConfig {
    pivotColumn?: QueryFormColumn;
    valueColumn?: QueryFormColumn;
    // Optional time/number format applied to the pivot values themselves
    // when used as the auto-generated sub-column labels.
    labelFormat?: string;
    sortDescending?: boolean;
}

// A node in the manually-declared header tree.
// - A node with `children` is a static group header spanning all of its
//   descendants' leaf columns.
// - A node with `pivot` is a dynamic group header: its sub-columns are
//   generated at render time from the distinct values of `pivot.pivotColumn`.
// - Any other node is a leaf column bound to a raw (non-aggregated) column,
//   so the value shown is exactly what the row's data returns.
export interface HeaderNode {
    label: string;
    column?: QueryFormColumn;
    pivot?: HeaderPivotConfig;
    numberFormat?: string;
    align?: 'left' | 'center' | 'right';
    width?: number;
    children?: HeaderNode[];
}

export interface HeaderTreeConfig {
    columns: HeaderNode[];
}

// Per-column display config for the row header columns (the `groupby`
// columns rendered as merged headers on the left), keyed by column label --
// unlike the header tree's leaf columns, row headers aren't declared in the
// JSON, so their width/numberFormat live in this separate map instead.
export interface RowHeaderColumnFormat {
    // Custom header title shown on the table for this row header column.
    // Falls back to the raw column name when unset.
    label?: string;
    width?: number;
    numberFormat?: string;
    // Freeze this column on the left side of the table when scrolling
    // horizontally. Off by default -- only columns explicitly marked here
    // are pinned.
    pinned?: boolean;
    // Whether consecutive equal values in this column merge into one cell
    // (rowSpan). Undefined inherits the chart-level `mergeRowHeaders`
    // default; explicitly set true/false overrides it for this column only.
    merge?: boolean;
    // Insert a subtotal row every time this column's group (this column and
    // every row header column to its left) changes, summing every numeric
    // body column across that group's rows.
    subtotal?: boolean;
}

export type RowHeaderColumnFormats = Record<string, RowHeaderColumnFormat>;

export type MergedHeaderTableFormData = QueryFormData & {
    groupby?: QueryFormColumn[];
    headerTreeJson?: string;
    pivotRowLimit?: number;
    mergeRowHeaders?: boolean;
    bordered?: boolean;
    cellFontSize?: number;
    numberFormat?: string;
    rowHeaderColumnFormats?: RowHeaderColumnFormats;
    showGrandTotal?: boolean;
};

export interface MergedHeaderTableDatum {
    [key: string]: number | string | null;
}

export interface MergedHeaderTableChartDataResponseResult
    extends ChartDataResponseResult {
    data: MergedHeaderTableDatum[];
}

export type MergedHeaderTableChartProps =
    BaseChartProps<MergedHeaderTableFormData> & {
        formData: MergedHeaderTableFormData;
        queriesData: MergedHeaderTableChartDataResponseResult[];
    };

export interface MergedHeaderTableVizProps {
    width: number;
    height: number;
    data: MergedHeaderTableDatum[];
    headerTree: HeaderNode[];
    rowHeaderColumns: string[];
    rowHeaderColumnFormats?: RowHeaderColumnFormats;
    mergeRowHeaders?: boolean;
    bordered?: boolean;
    cellFontSize?: number;
    error?: string;
}
