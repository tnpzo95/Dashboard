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
    getColumnLabel,
    getNumberFormatter,
    getTimeFormatter,
    QueryFormColumn,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
    D3_FORMAT_DOCS,
    D3_FORMAT_OPTIONS,
    D3_TIME_FORMAT_DOCS,
    D3_TIME_FORMAT_OPTIONS,
} from '@superset-ui/chart-controls';
import {
    HeaderNode,
    HeaderPivotConfig,
    HeaderTreeConfig,
    MergedHeaderTableDatum,
    RowHeaderColumnFormats,
    RowHighlightRule,
} from './types';

export const getFormColumnLabel = (column: QueryFormColumn): string =>
    getColumnLabel(column);

// Resolves a pivot config's ordered list of pivot-by columns, falling back
// to the deprecated single `pivotColumn` field for header trees saved
// before multi-level pivot was added.
export function getPivotColumns(
    pivot: HeaderPivotConfig | undefined,
): QueryFormColumn[] {
    if (!pivot) {
        return [];
    }
    if (pivot.pivotColumns && pivot.pivotColumns.length > 0) {
        return pivot.pivotColumns;
    }
    return pivot.pivotColumn ? [pivot.pivotColumn] : [];
}

// D3 time-format specifiers always start with `%` (e.g. "%Y-%m-%d %H:%M:%S"),
// while D3 number-format specifiers never do -- since a single numberFormat
// field can hold either kind depending on the column's type (see
// getFormatOptionsForColumn), this is how call sites pick the right
// formatter instead of always running a time string through
// getNumberFormatter (which can't parse it and falls back to
// "<raw value> (Invalid format: ...)").
export function getSmartFormatter(formatString?: string) {
    if (formatString?.startsWith('%')) {
        return getTimeFormatter(formatString);
    }
    return getNumberFormatter(formatString);
}

// A column option carrying its generic data type, so format pickers can
// offer date/time formats for temporal columns instead of always showing
// the number-format list regardless of the column's actual type.
export interface TypedColumnOption {
    label: string;
    value: string;
    type_generic?: GenericDataType;
    is_dttm?: boolean;
}

const numberFormatSelectOptions = D3_FORMAT_OPTIONS.map(([value, label]) => ({
    value,
    label,
}));
const timeFormatSelectOptions = D3_TIME_FORMAT_OPTIONS.map(([value, label]) => ({
    value,
    label,
}));

// Picks the right D3 format option list (+ docs) for a given column, based
// on its generic data type -- temporal columns get date/time formats,
// everything else (numeric, string, unknown) gets the number-format list,
// since string columns can still hold numeric-looking values worth
// formatting (see renderFormattedValue's numeric-string handling).
export function getFormatOptionsForColumn(
    columnName: string | undefined,
    columns: TypedColumnOption[],
) {
    const column = columns.find(c => c.value === columnName);
    const isTemporal =
        Boolean(column?.is_dttm) ||
        column?.type_generic === GenericDataType.Temporal;
    return isTemporal
        ? { options: timeFormatSelectOptions, docs: D3_TIME_FORMAT_DOCS }
        : { options: numberFormatSelectOptions, docs: D3_FORMAT_DOCS };
}

// Marks a synthetic row inserted by augmentDataWithSubtotals -- checked by
// both MergedHeaderTableViz (for bold/background styling) and exportExcel
// (for the same styling in the .xlsx output).
export const ROW_TYPE_KEY = '__merged_header_table_row_type';
export type SpecialRowType = 'subtotal' | 'total';

// Shared by the on-screen table (MergedHeaderTableViz) and the Excel export
// (exportExcel) so both render the exact same text for a cell value.
export function renderFormattedValue(
    value: unknown,
    formatter: (n: number) => string,
): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    if (typeof value === 'number') {
        try {
            return formatter(value);
        } catch {
            return String(value);
        }
    }
    // Some sources (e.g. Oracle NUMBER columns via the driver, or a
    // computed rate) come back as a numeric-looking string rather than a
    // JS number -- still worth running through the formatter instead of
    // showing the raw unformatted string.
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed !== '' && Number.isFinite(Number(trimmed))) {
            try {
                return formatter(Number(trimmed));
            } catch {
                return value;
            }
        }
    }
    return String(value);
}

// Hierarchical rowSpan: a row-header column only merges with the row above
// it when every column to its left (inclusive) also matches, so nested
// groups (e.g. MODEL within FACTORY) merge the way they would in Excel.
// Shared by the on-screen table and the Excel export so both merge rows
// identically.
export function computeRowSpans(
    data: MergedHeaderTableDatum[],
    rowHeaderColumns: string[],
): number[][] {
    const spans = rowHeaderColumns.map(() =>
        Array.from({ length: data.length }, () => 1),
    );
    rowHeaderColumns.forEach((_col, col) => {
        let runStart = 0;
        for (let row = 1; row <= data.length; row += 1) {
            const sameAsPrev =
                row < data.length &&
                rowHeaderColumns
                    .slice(0, col + 1)
                    .every(key => data[row][key] === data[row - 1][key]);
            if (!sameAsPrev) {
                spans[col][runStart] = row - runStart;
                for (let r = runStart + 1; r < row; r += 1) {
                    spans[col][r] = 0;
                }
                runStart = row;
            }
        }
    });
    return spans;
}

export interface FlatLeafColumn {
    node: HeaderNode;
    dataIndex: string;
}

// Flatten the (already pivot-resolved) header tree into an ordered list of
// leaf columns with the exact `dataIndex` MergedHeaderTableViz's buildColumns
// uses, so subtotal/total aggregation sums the same columns the table shows.
export function collectFlatLeafColumns(
    nodes: HeaderNode[],
    parentPath = 'col',
): FlatLeafColumn[] {
    const result: FlatLeafColumn[] = [];
    nodes.forEach((node, index) => {
        const path = `${parentPath}-${index}`;
        if (node.children?.length) {
            result.push(...collectFlatLeafColumns(node.children, path));
        } else {
            const dataIndex = node.column ? getFormColumnLabel(node.column) : path;
            result.push({ node, dataIndex });
        }
    });
    return result;
}

function sumNumeric(
    rows: MergedHeaderTableDatum[],
    key: string,
): number | null {
    let sum = 0;
    let hasNumber = false;
    rows.forEach(row => {
        const value = row[key];
        if (typeof value === 'number') {
            sum += value;
            hasNumber = true;
        }
    });
    return hasNumber ? sum : null;
}

function buildSubtotalRow(
    groupRows: MergedHeaderTableDatum[],
    rowHeaderColumns: string[],
    triggerColIndex: number,
    leafColumns: FlatLeafColumn[],
): MergedHeaderTableDatum {
    const lastRow = groupRows[groupRows.length - 1];
    const row: MergedHeaderTableDatum = { [ROW_TYPE_KEY]: 'subtotal' };
    rowHeaderColumns.forEach((key, index) => {
        if (index < triggerColIndex) {
            row[key] = lastRow[key];
        } else if (index === triggerColIndex) {
            const label = lastRow[key];
            row[key] = `${label === null || label === undefined ? '' : label} (Total)`;
        } else {
            row[key] = '';
        }
    });
    leafColumns.forEach(({ dataIndex }) => {
        row[dataIndex] = sumNumeric(groupRows, dataIndex);
    });
    return row;
}

function buildTotalRow(
    data: MergedHeaderTableDatum[],
    rowHeaderColumns: string[],
    leafColumns: FlatLeafColumn[],
): MergedHeaderTableDatum {
    const row: MergedHeaderTableDatum = { [ROW_TYPE_KEY]: 'total' };
    rowHeaderColumns.forEach((key, index) => {
        row[key] = index === 0 ? 'Total' : '';
    });
    leafColumns.forEach(({ dataIndex }) => {
        row[dataIndex] = sumNumeric(data, dataIndex);
    });
    return row;
}

// Inserts a subtotal row after every group whose row-header column has
// `subtotal: true` (the group being that column plus every column to its
// left -- so nested groups, e.g. MODEL within FACTORY, get their own
// subtotal), and optionally one grand-total row at the very end. Subtotal
// rows deliberately repeat the group's real value in columns to the left of
// the trigger column so they merge upward into that group's existing
// merged cell (see computeRowSpans); the trigger column itself gets a
// distinct "(Total)" label so it starts its own cell.
export function augmentDataWithSubtotals(
    data: MergedHeaderTableDatum[],
    rowHeaderColumns: string[],
    columnFormats: RowHeaderColumnFormats,
    leafColumns: FlatLeafColumn[],
    showGrandTotal?: boolean,
    grandTotalRowPosition: 'top' | 'bottom' = 'bottom',
): MergedHeaderTableDatum[] {
    if (data.length === 0) {
        return showGrandTotal
            ? [buildTotalRow(data, rowHeaderColumns, leafColumns)]
            : data;
    }
    const hasAnySubtotal = rowHeaderColumns.some(
        key => columnFormats[key]?.subtotal,
    );
    if (!hasAnySubtotal && !showGrandTotal) {
        return data;
    }

    const groupStart = rowHeaderColumns.map(() => 0);
    const result: MergedHeaderTableDatum[] = [];
    data.forEach((row, rowIndex) => {
        result.push(row);
        const isLastRow = rowIndex === data.length - 1;
        for (let col = rowHeaderColumns.length - 1; col >= 0; col -= 1) {
            const changesHere =
                !isLastRow &&
                rowHeaderColumns
                    .slice(0, col + 1)
                    .some(key => data[rowIndex][key] !== data[rowIndex + 1][key]);
            const groupEnds = isLastRow || changesHere;
            if (groupEnds) {
                if (columnFormats[rowHeaderColumns[col]]?.subtotal) {
                    const groupRows = data.slice(groupStart[col], rowIndex + 1);
                    result.push(
                        buildSubtotalRow(
                            groupRows,
                            rowHeaderColumns,
                            col,
                            leafColumns,
                        ),
                    );
                }
                groupStart[col] = rowIndex + 1;
            }
        }
    });
    if (showGrandTotal) {
        const totalRow = buildTotalRow(data, rowHeaderColumns, leafColumns);
        if (grandTotalRowPosition === 'top') {
            result.unshift(totalRow);
        } else {
            result.push(totalRow);
        }
    }
    return result;
}

// Returns the first rule whose `column` value on this row exactly equals
// `value` (as a string), or undefined if none match / no rules configured.
export function matchRowHighlightRule(
    row: MergedHeaderTableDatum,
    rules: RowHighlightRule[] | undefined,
): RowHighlightRule | undefined {
    if (!rules || rules.length === 0) {
        return undefined;
    }
    return rules.find(
        rule =>
            rule.column &&
            rule.value !== undefined &&
            rule.value !== '' &&
            String(row[rule.column] ?? '') === rule.value,
    );
}

export function parseHeaderTree(json?: string): {
    columns: HeaderNode[];
    error?: string;
} {
    if (!json || !json.trim()) {
        return { columns: [] };
    }
    try {
        const parsed = JSON.parse(json) as HeaderTreeConfig;
        if (!Array.isArray(parsed?.columns)) {
            return {
                columns: [],
                error: 'JSON must have a top-level "columns" array',
            };
        }
        return { columns: parsed.columns };
    } catch (err) {
        return { columns: [], error: (err as Error).message };
    }
}

// Static (non-pivot) leaf columns only -- pivot nodes fetch their own
// columns via a separate query, so they're excluded here.
export function flattenLeafColumns(nodes: HeaderNode[]): QueryFormColumn[] {
    const result: QueryFormColumn[] = [];
    const visit = (list: HeaderNode[]) => {
        list.forEach(node => {
            if (node.pivot) {
                return;
            }
            if (node.children?.length) {
                visit(node.children);
            } else if (node.column) {
                result.push(node.column);
            }
        });
    };
    visit(nodes);
    return result;
}

export function dedupeColumns(columns: QueryFormColumn[]): QueryFormColumn[] {
    const seen = new Set<string>();
    const out: QueryFormColumn[] = [];
    columns.forEach(column => {
        const label = getFormColumnLabel(column);
        if (!seen.has(label)) {
            seen.add(label);
            out.push(column);
        }
    });
    return out;
}

export interface LeafInfo {
    // Index path from the root `columns` array down to this leaf node,
    // e.g. [0, 1, 0] means columns[0].children[1].children[0].
    path: number[];
    breadcrumb: string;
    node: HeaderNode;
    isPivot: boolean;
}

// Walk the tree and return every leaf (a node without static `children`),
// together with the path needed to locate/replace it and a human-readable
// breadcrumb of its ancestor labels, so a UI can list "which cell am I
// setting a value for" without the user having to read the raw JSON. Pivot
// nodes are reported as leaves too (`isPivot: true`) since their
// sub-columns are generated dynamically, not declared in the JSON.
export function collectLeaves(
    nodes: HeaderNode[],
    path: number[] = [],
    breadcrumb: string[] = [],
): LeafInfo[] {
    const result: LeafInfo[] = [];
    nodes.forEach((node, index) => {
        const nodePath = [...path, index];
        const nodeBreadcrumb = [...breadcrumb, node.label || `#${index + 1}`];
        if (node.pivot) {
            result.push({
                path: nodePath,
                breadcrumb: nodeBreadcrumb.join(' > '),
                node,
                isPivot: true,
            });
        } else if (node.children?.length) {
            result.push(...collectLeaves(node.children, nodePath, nodeBreadcrumb));
        } else {
            result.push({
                path: nodePath,
                breadcrumb: nodeBreadcrumb.join(' > '),
                node,
                isPivot: false,
            });
        }
    });
    return result;
}

// Immutably replace the `column` of the leaf located at `path`.
export function updateLeafColumn(
    nodes: HeaderNode[],
    path: number[],
    column: QueryFormColumn | undefined,
): HeaderNode[] {
    const [index, ...rest] = path;
    return nodes.map((node, i) => {
        if (i !== index) {
            return node;
        }
        if (rest.length === 0) {
            return { ...node, column };
        }
        return {
            ...node,
            children: updateLeafColumn(node.children || [], rest, column),
        };
    });
}

// Immutably replace the `width` of the node at `path` (applies to both
// static leaf columns and pivot group nodes -- pivot width is inherited by
// every dynamically-generated sub-column, see resolvePivotNode).
export function updateNodeWidth(
    nodes: HeaderNode[],
    path: number[],
    width: number | undefined,
): HeaderNode[] {
    const [index, ...rest] = path;
    return nodes.map((node, i) => {
        if (i !== index) {
            return node;
        }
        if (rest.length === 0) {
            return { ...node, width };
        }
        return {
            ...node,
            children: updateNodeWidth(node.children || [], rest, width),
        };
    });
}

// Immutably replace the `numberFormat` (d3-format string) of the node at
// `path` -- applies to both static leaf columns and pivot group nodes, since
// pivot's numberFormat is inherited by every dynamically-generated
// sub-column, see resolvePivotNode.
export function updateNodeNumberFormat(
    nodes: HeaderNode[],
    path: number[],
    numberFormat: string | undefined,
): HeaderNode[] {
    const [index, ...rest] = path;
    return nodes.map((node, i) => {
        if (i !== index) {
            return node;
        }
        if (rest.length === 0) {
            return { ...node, numberFormat };
        }
        return {
            ...node,
            children: updateNodeNumberFormat(node.children || [], rest, numberFormat),
        };
    });
}

// Immutably merge a patch into the `pivot` config of the node at `path`.
export function updateLeafPivot(
    nodes: HeaderNode[],
    path: number[],
    patch: Partial<NonNullable<HeaderNode['pivot']>>,
): HeaderNode[] {
    const [index, ...rest] = path;
    return nodes.map((node, i) => {
        if (i !== index) {
            return node;
        }
        if (rest.length === 0) {
            return { ...node, pivot: { ...node.pivot, ...patch } };
        }
        return {
            ...node,
            children: updateLeafPivot(node.children || [], rest, patch),
        };
    });
}

// Immutably replace the `children` of the node at `path` (used to expand a
// pivot node into its dynamically-generated sub-columns at render time).
export function updateNodeChildren(
    nodes: HeaderNode[],
    path: number[],
    children: HeaderNode[],
): HeaderNode[] {
    const [index, ...rest] = path;
    return nodes.map((node, i) => {
        if (i !== index) {
            return node;
        }
        if (rest.length === 0) {
            return { ...node, children, pivot: undefined };
        }
        return {
            ...node,
            children: updateNodeChildren(node.children || [], rest, children),
        };
    });
}

// Immutably patch arbitrary fields of the node at `path` -- the general
// version of updateLeafColumn/updateNodeWidth/etc, used by the visual
// designer where a single edit (e.g. switching node type) can touch several
// fields (column/pivot/children) at once.
export function updateNode(
    nodes: HeaderNode[],
    path: number[],
    patch: Partial<HeaderNode>,
): HeaderNode[] {
    const [index, ...rest] = path;
    return nodes.map((node, i) => {
        if (i !== index) {
            return node;
        }
        if (rest.length === 0) {
            return { ...node, ...patch };
        }
        return {
            ...node,
            children: updateNode(node.children || [], rest, patch),
        };
    });
}

// Immutably append `newNode` as a top-level column (parentPath === null) or
// as the last child of the group node at `parentPath`.
export function insertNode(
    nodes: HeaderNode[],
    parentPath: number[] | null,
    newNode: HeaderNode,
): HeaderNode[] {
    if (parentPath === null) {
        return [...nodes, newNode];
    }
    const [index, ...rest] = parentPath;
    return nodes.map((node, i) => {
        if (i !== index) {
            return node;
        }
        if (rest.length === 0) {
            return { ...node, children: [...(node.children || []), newNode] };
        }
        return {
            ...node,
            children: insertNode(node.children || [], rest, newNode),
        };
    });
}

// Immutably remove the node at `path`.
export function removeNode(nodes: HeaderNode[], path: number[]): HeaderNode[] {
    const [index, ...rest] = path;
    if (rest.length === 0) {
        return nodes.filter((_, i) => i !== index);
    }
    return nodes.map((node, i) => {
        if (i !== index) {
            return node;
        }
        return {
            ...node,
            children: removeNode(node.children || [], rest),
        };
    });
}

// Immutably swap the node at `path` with its previous (-1) or next (+1)
// sibling, for reordering columns within the designer.
export function moveNode(
    nodes: HeaderNode[],
    path: number[],
    direction: -1 | 1,
): HeaderNode[] {
    const [index, ...rest] = path;
    if (rest.length === 0) {
        const target = index + direction;
        if (target < 0 || target >= nodes.length) {
            return nodes;
        }
        const copy = [...nodes];
        [copy[index], copy[target]] = [copy[target], copy[index]];
        return copy;
    }
    return nodes.map((node, i) => {
        if (i !== index) {
            return node;
        }
        return {
            ...node,
            children: moveNode(node.children || [], rest, direction),
        };
    });
}

export interface PivotNodeInfo {
    path: number[];
    node: HeaderNode;
}

// Find every node that declares `pivot` (dynamic column generation).
// Pivot nodes are never descended into -- their sub-columns don't exist in
// the JSON yet, they're generated from query results.
export function collectPivotNodes(
    nodes: HeaderNode[],
    path: number[] = [],
): PivotNodeInfo[] {
    const result: PivotNodeInfo[] = [];
    nodes.forEach((node, index) => {
        const nodePath = [...path, index];
        if (node.pivot) {
            result.push({ path: nodePath, node });
        } else if (node.children?.length) {
            result.push(...collectPivotNodes(node.children, nodePath));
        }
    });
    return result;
}

const ROW_KEY_SEPARATOR = '__|__';

// Build a stable string key identifying a row by its row-header column
// values, used to correlate the base query's rows with a pivot query's
// (row-header, pivot-value) rows.
export function buildRowKey(
    row: Record<string, unknown>,
    rowHeaderColumns: string[],
): string {
    return rowHeaderColumns.map(col => String(row[col])).join(ROW_KEY_SEPARATOR);
}
