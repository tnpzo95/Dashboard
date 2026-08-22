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
import { t } from '@apache-superset/core/translation';
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
    getPivotColumns,
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

// A blank pivot value (null/undefined/empty-or-whitespace string) would
// otherwise render as an empty header cell -- skip generating a column (or
// group, together with its whole subtree) for it entirely.
const isBlankPivotValue = (value: unknown): boolean =>
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '');

const sortPivotValues = (values: unknown[], descending?: boolean) => {
    const sorted = [...values].sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') {
            return a - b;
        }
        return String(a).localeCompare(String(b));
    });
    return descending ? sorted.reverse() : sorted;
};

// Separator used to join a pivot value-path (one value per pivot level)
// into a single lookup key. Distinct from buildRowKey's separator since
// these key two unrelated maps.
const PIVOT_PATH_SEPARATOR = '__/__';

type PivotValueTree = Map<unknown, PivotValueTree>;

// Groups a pivot query's rows into a tree of distinct value combinations,
// one level per pivot column (e.g. month -> week -> date), so each level
// can be sorted and rendered as its own nested group header.
function buildPivotValueTree(
    rows: MergedHeaderTableDatum[],
    pivotColumnLabels: string[],
): PivotValueTree {
    const root: PivotValueTree = new Map();
    rows.forEach(row => {
        let cursor = root;
        pivotColumnLabels.forEach(label => {
            const val = row[label];
            let next = cursor.get(val);
            if (!next) {
                next = new Map();
                cursor.set(val, next);
            }
            cursor = next;
        });
    });
    return root;
}

interface PivotLeafPath {
    values: unknown[];
    syntheticKey: string;
}

// A dynamically-inserted "Subtotal" column under one intermediate group
// (e.g. one Week's Subtotal, or one Month's Subtotal), plus the synthetic
// leaf-column keys it needs to sum per row.
interface PivotSubtotalGroup {
    syntheticKey: string;
    leafKeys: string[];
}

// Recursively turns one level of the distinct-value tree into HeaderNodes:
// intermediate levels become static group headers (children = next level,
// plus a trailing "Subtotal" leaf when `node.pivot.colSubtotals` is on),
// the deepest level becomes the actual leaf columns bound to synthetic keys.
function buildPivotHeaderLevel(
    tree: PivotValueTree,
    level: number,
    pivotColumnLabels: string[],
    node: HeaderNode,
    pivotIndex: number,
    parentValues: unknown[],
    leaves: PivotLeafPath[],
    subtotalGroups: PivotSubtotalGroup[],
): HeaderNode[] {
    const isLeafLevel = level === pivotColumnLabels.length - 1;
    const sortedValues = sortPivotValues(
        Array.from(tree.keys()).filter(value => !isBlankPivotValue(value)),
        node.pivot!.sortDescending,
    );
    return sortedValues.map(value => {
        const values = [...parentValues, value];
        if (isLeafLevel) {
            const syntheticKey = `__pivot_${pivotIndex}_${leaves.length}`;
            leaves.push({ values, syntheticKey });
            return {
                label: formatPivotLabel(value, node.pivot!.labelFormat),
                column: syntheticKey,
                numberFormat: node.numberFormat,
                align: node.align,
                width: node.width,
            };
        }
        const leafStart = leaves.length;
        const children = buildPivotHeaderLevel(
            tree.get(value)!,
            level + 1,
            pivotColumnLabels,
            node,
            pivotIndex,
            values,
            leaves,
            subtotalGroups,
        );
        if (node.pivot!.colSubtotals) {
            const groupLeafKeys = leaves
                .slice(leafStart)
                .map(({ syntheticKey }) => syntheticKey);
            const subtotalKey = `__pivot_${pivotIndex}_subtotal_${subtotalGroups.length}`;
            subtotalGroups.push({ syntheticKey: subtotalKey, leafKeys: groupLeafKeys });
            children.push({
                label: t('Subtotal'),
                column: subtotalKey,
                numberFormat: node.numberFormat,
                align: node.align,
                width: node.width,
                isSubtotalColumn: true,
            });
        }
        return {
            label: String(value),
            children,
        };
    });
}

// Reshape one pivot query's "long format" rows — one row per (row header,
// pivot value path) — into a (possibly nested) set of dynamically generated
// header groups/leaf columns, plus the wide-format values merged into
// `data`, keyed by a synthetic column name unique to each generated leaf.
function resolvePivotNode(
    node: HeaderNode,
    pivotIndex: number,
    pivotRows: MergedHeaderTableDatum[],
    data: MergedHeaderTableDatum[],
    rowHeaderColumns: string[],
): HeaderNode[] {
    const pivotColumnLabels = getPivotColumns(node.pivot).map(getFormColumnLabel);
    const valueColumnLabel = getFormColumnLabel(node.pivot!.valueColumn!);
    if (pivotColumnLabels.length === 0) {
        return [];
    }

    const tree = buildPivotValueTree(pivotRows, pivotColumnLabels);
    const leaves: PivotLeafPath[] = [];
    const subtotalGroups: PivotSubtotalGroup[] = [];
    const headerNodes = buildPivotHeaderLevel(
        tree,
        0,
        pivotColumnLabels,
        node,
        pivotIndex,
        [],
        leaves,
        subtotalGroups,
    );

    // The outermost level (e.g. Month) has no enclosing group to attach its
    // own subtotal to -- buildPivotHeaderLevel only appends a group's
    // subtotal from within its *parent's* recursive call, and the top level
    // has none. Append the equivalent here: one "Total" column summing
    // every leaf in the whole pivot.
    if (node.pivot!.colGrandTotal) {
        const grandTotalKey = `__pivot_${pivotIndex}_grandtotal`;
        subtotalGroups.push({
            syntheticKey: grandTotalKey,
            leafKeys: leaves.map(({ syntheticKey }) => syntheticKey),
        });
        const grandTotalNode: HeaderNode = {
            label: t('Total'),
            column: grandTotalKey,
            numberFormat: node.numberFormat,
            align: node.align,
            width: node.width,
            isGrandTotalColumn: true,
        };
        if (node.pivot!.colGrandTotalPosition === 'start') {
            headerNodes.unshift(grandTotalNode);
        } else {
            headerNodes.push(grandTotalNode);
        }
    }

    const valuesByRowKey = new Map<string, Map<string, unknown>>();
    pivotRows.forEach(row => {
        const key = buildRowKey(row, rowHeaderColumns);
        const pathKey = pivotColumnLabels
            .map(label => String(row[label]))
            .join(PIVOT_PATH_SEPARATOR);
        const valueMap = valuesByRowKey.get(key) || new Map();
        valueMap.set(pathKey, row[valueColumnLabel]);
        valuesByRowKey.set(key, valueMap);
    });

    data.forEach(row => {
        const key = buildRowKey(row, rowHeaderColumns);
        const valueMap = valuesByRowKey.get(key);
        leaves.forEach(({ values, syntheticKey }) => {
            const pathKey = values.map(v => String(v)).join(PIVOT_PATH_SEPARATOR);
            const value = valueMap?.get(pathKey);
            // eslint-disable-next-line no-param-reassign
            row[syntheticKey] = value === undefined ? null : (value as any);
        });
    });

    // Subtotal columns sum their group's leaf columns per row -- computed
    // after the leaf values above are merged in, since they read those.
    subtotalGroups.forEach(({ syntheticKey, leafKeys }) => {
        data.forEach(row => {
            let sum = 0;
            let hasNumber = false;
            leafKeys.forEach(leafKey => {
                const value = row[leafKey];
                if (typeof value === 'number') {
                    sum += value;
                    hasNumber = true;
                }
            });
            // eslint-disable-next-line no-param-reassign
            row[syntheticKey] = hasNumber ? sum : null;
        });
    });

    return headerNodes;
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
        grandTotalRowPosition,
        enableColumnSort,
        rowHighlightRules,
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
        ({ node }) =>
            getPivotColumns(node.pivot).length > 0 && node.pivot?.valueColumn,
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
        grandTotalRowPosition,
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
        enableColumnSort,
        rowHighlightRules,
        error,
    };
}
