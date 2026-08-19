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
import { getColumnLabel, getTimeFormatter } from '@superset-ui/core';
import {
    HeaderNode,
    MergedHeaderTableChartProps,
    MergedHeaderTableDatum,
    MergedHeaderTableVizProps,
} from './types';
import {
    augmentDataWithSubtotals,
    buildRowKey,
    collectFlatLeafColumns,
    collectPivotNodes,
    getFormColumnLabel,
    parseHeaderTree,
    updateNodeChildren,
} from './headerTreeUtils';

const formatPivotLabel = (value: unknown, labelFormat?: string): string => {
    if (labelFormat && value !== null && value !== undefined) {
        try {
            const formatter = getTimeFormatter(labelFormat);
            const date = new Date(value as string | number);
            if (!Number.isNaN(date.getTime())) {
                return formatter(date);
            }
        } catch {
            // fall through to plain string below
        }
    }
    return String(value);
};

const sortPivotValues = (values: unknown[], descending?: boolean) => {
    const sorted = [...values].sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') {
            return a - b;
        }
        return String(a).localeCompare(String(b));
    });
    return descending ? sorted.reverse() : sorted;
};

// Reshape one pivot query's "long format" rows — one row per (row header,
// pivot value) — into a set of dynamically generated leaf columns plus the
// wide-format values to merge into `data`, keyed by a synthetic column name
// unique to this pivot node.
function resolvePivotNode(
    node: HeaderNode,
    pivotIndex: number,
    pivotRows: MergedHeaderTableDatum[],
    data: MergedHeaderTableDatum[],
    rowHeaderColumns: string[],
): HeaderNode[] {
    const pivotColumnLabel = getFormColumnLabel(node.pivot!.pivotColumn!);
    const valueColumnLabel = getFormColumnLabel(node.pivot!.valueColumn!);

    const valuesByRowKey = new Map<string, Map<unknown, unknown>>();
    const distinctValues = new Set<unknown>();
    pivotRows.forEach(row => {
        const key = buildRowKey(row, rowHeaderColumns);
        const pivotValue = row[pivotColumnLabel];
        distinctValues.add(pivotValue);
        const valueMap = valuesByRowKey.get(key) || new Map();
        valueMap.set(pivotValue, row[valueColumnLabel]);
        valuesByRowKey.set(key, valueMap);
    });

    const sortedValues = sortPivotValues(
        Array.from(distinctValues),
        node.pivot!.sortDescending,
    );
    const syntheticKeys = sortedValues.map(
        (_, valueIndex) => `__pivot_${pivotIndex}_${valueIndex}`,
    );

    data.forEach(row => {
        const key = buildRowKey(row, rowHeaderColumns);
        const valueMap = valuesByRowKey.get(key);
        sortedValues.forEach((pivotValue, valueIndex) => {
            const value = valueMap?.get(pivotValue);
            // eslint-disable-next-line no-param-reassign
            row[syntheticKeys[valueIndex]] = value === undefined ? null : (value as any);
        });
    });

    return sortedValues.map((pivotValue, valueIndex) => ({
        label: formatPivotLabel(pivotValue, node.pivot!.labelFormat),
        column: syntheticKeys[valueIndex],
        numberFormat: node.numberFormat,
        align: node.align,
        width: node.width,
    }));
}

export default function transformProps(
    chartProps: MergedHeaderTableChartProps,
): MergedHeaderTableVizProps {
    const { width, height, queriesData, formData } = chartProps;
    const {
        groupby = [],
        headerTreeJson,
        mergeRowHeaders = true,
        bordered = true,
        cellFontSize,
        rowHeaderColumnFormats,
        showGrandTotal,
    } = formData;

    const rowHeaderColumns = groupby.map(column => getColumnLabel(column));
    const baseData: MergedHeaderTableDatum[] = queriesData[0]?.data || [];
    // Clone rows so pivoted values can be merged in without mutating the
    // query response cache.
    const data: MergedHeaderTableDatum[] = baseData.map(row => ({ ...row }));

    const parsedTree = parseHeaderTree(headerTreeJson);
    const { error } = parsedTree;
    let { columns: headerTree } = parsedTree;

    const pivotNodes = collectPivotNodes(headerTree).filter(
        ({ node }) => node.pivot?.pivotColumn && node.pivot?.valueColumn,
    );

    pivotNodes.forEach(({ path, node }, pivotIndex) => {
        const pivotRows: MergedHeaderTableDatum[] =
            queriesData[1 + pivotIndex]?.data || [];
        const generatedLeaves = resolvePivotNode(
            node,
            pivotIndex,
            pivotRows,
            data,
            rowHeaderColumns,
        );
        headerTree = updateNodeChildren(headerTree, path, generatedLeaves);
    });

    const leafColumns = collectFlatLeafColumns(headerTree);
    const displayData = augmentDataWithSubtotals(
        data,
        rowHeaderColumns,
        rowHeaderColumnFormats || {},
        leafColumns,
        showGrandTotal,
    );

    return {
        width,
        height,
        data: displayData,
        headerTree,
        rowHeaderColumns,
        rowHeaderColumnFormats,
        mergeRowHeaders,
        bordered,
        cellFontSize,
        error,
    };
}
