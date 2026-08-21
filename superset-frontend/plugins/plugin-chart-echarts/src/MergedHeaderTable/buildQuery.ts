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
import { buildQueryContext } from '@superset-ui/core';
import { MergedHeaderTableFormData } from './types';
import {
    collectPivotNodes,
    dedupeColumns,
    flattenLeafColumns,
    getPivotColumns,
    parseHeaderTree,
} from './headerTreeUtils';

const DEFAULT_PIVOT_ROW_LIMIT = 10000;

export default function buildQuery(formData: MergedHeaderTableFormData) {
    const {
        groupby = [],
        headerTreeJson,
        row_limit: rowLimit,
        pivotRowLimit,
    } = formData;
    const { columns: headerTree } = parseHeaderTree(headerTreeJson);
    const leafColumns = flattenLeafColumns(headerTree);
    const pivotNodes = collectPivotNodes(headerTree).filter(
        ({ node }) =>
            getPivotColumns(node.pivot).length > 0 && node.pivot?.valueColumn,
    );

    // Raw records query: every value is the column's own value on that row,
    // never an aggregate — no GROUP BY, so row header columns are just
    // regular selected columns alongside the leaf columns.
    const allColumns = dedupeColumns([...groupby, ...leafColumns]);

    return buildQueryContext(formData, baseQueryObject => [
        {
            ...baseQueryObject,
            metrics: [],
            columns: allColumns,
            groupby: [],
            orderby: groupby.map(column => [column, true]),
            row_limit: rowLimit || 1000,
            series_columns: undefined,
        } as any,
        // One extra "long format" query per dynamic pivot group: one row
        // per (row header, pivot value) combination. transformProps pivots
        // this into wide format (one auto-generated column per distinct
        // pivot value) and merges it into the base query's rows.
        ...pivotNodes.map(({ node }) => {
            const nodePivotColumns = getPivotColumns(node.pivot);
            const pivotColumns = dedupeColumns([
                ...groupby,
                ...nodePivotColumns,
                node.pivot!.valueColumn!,
            ]);
            return {
                ...baseQueryObject,
                metrics: [],
                columns: pivotColumns,
                groupby: [],
                orderby: [...groupby, ...nodePivotColumns].map(column => [
                    column,
                    true,
                ]),
                row_limit: pivotRowLimit || DEFAULT_PIVOT_ROW_LIMIT,
                series_columns: undefined,
            } as any;
        }),
    ]);
}
