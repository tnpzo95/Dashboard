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
import { Workbook } from 'exceljs';
import transformProps from './transformProps';
import {
    computeRowSpans,
    getFormColumnLabel,
    getSmartFormatter,
    renderFormattedValue,
    ROW_TYPE_KEY,
} from './headerTreeUtils';
import { HeaderNode, MergedHeaderTableChartProps } from './types';

const HEADER_FILL_COLOR = 'FF1F6FEB';
const HEADER_FONT_COLOR = 'FFFFFFFF';
const BORDER_COLOR = 'FFB0B0B0';
const SUBTOTAL_FILL_COLOR = 'FFF0F0F0';
const TOTAL_FILL_COLOR = 'FFE0E0E0';
const MIN_COL_WIDTH = 8;
const MAX_COL_WIDTH = 60;

const THIN_BORDER = {
    top: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
    left: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
    right: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
};

interface HeaderCellLayout {
    label: string;
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
}

interface LeafColumnInfo {
    node: HeaderNode;
    col: number;
    dataIndex: string;
}

function computeTreeDepth(nodes: HeaderNode[]): number {
    if (!nodes.length) return 0;
    return (
        1 +
        Math.max(
            0,
            ...nodes.map(node =>
                node.children?.length ? computeTreeDepth(node.children) : 0,
            ),
        )
    );
}

// Walk the header tree and produce a flat list of header cells (with the
// row/col/rowSpan/colSpan an Excel sheet needs to merge them), plus the
// ordered list of leaf/pivot-generated columns those header cells sit above.
function layoutTree(
    nodes: HeaderNode[],
    depth: number,
    maxDepth: number,
    colStart: number,
): { cells: HeaderCellLayout[]; leaves: LeafColumnInfo[]; width: number } {
    const cells: HeaderCellLayout[] = [];
    const leaves: LeafColumnInfo[] = [];
    let col = colStart;
    nodes.forEach(node => {
        if (node.children?.length) {
            const child = layoutTree(node.children, depth + 1, maxDepth, col);
            cells.push({
                label: node.label,
                row: depth,
                col,
                rowSpan: 1,
                colSpan: child.width,
            });
            cells.push(...child.cells);
            leaves.push(...child.leaves);
            col += child.width;
        } else {
            const dataIndex = node.column
                ? getFormColumnLabel(node.column)
                : `col-${depth}-${col}`;
            cells.push({
                label: node.label,
                row: depth,
                col,
                rowSpan: maxDepth - depth,
                colSpan: 1,
            });
            leaves.push({ node, col, dataIndex });
            col += 1;
        }
    });
    return { cells, leaves, width: Math.max(col - colStart, 0) };
}

/**
 * Builds and downloads an .xlsx file that mirrors exactly what's rendered
 * on screen -- same multi-row merged header (group/leaf/pivot columns),
 * same merged row-header cells, same formatted values -- built directly
 * from the chart's own data rather than scraping the DOM (which AntD
 * splits into separate header/body <table> elements once horizontal
 * scroll is enabled, so DOM-based export can't capture both at once).
 */
export default async function exportMergedHeaderTableToExcel(
    chartProps: MergedHeaderTableChartProps,
    fileName: string,
): Promise<void> {
    const vizProps = transformProps(chartProps);
    if (vizProps.error) {
        return;
    }
    const {
        data,
        headerTree,
        rowHeaderColumns,
        rowHeaderColumnFormats = {},
        mergeRowHeaders,
    } = vizProps;

    const maxDepth = Math.max(1, computeTreeDepth(headerTree));
    const rowHeaderColOffset = rowHeaderColumns.length;
    const { cells: treeCells, leaves } = layoutTree(
        headerTree,
        0,
        maxDepth,
        rowHeaderColOffset,
    );
    const rowHeaderCells: HeaderCellLayout[] = rowHeaderColumns.map(
        (key, index) => ({
            label: rowHeaderColumnFormats[key]?.label || key,
            row: 0,
            col: index,
            rowSpan: maxDepth,
            colSpan: 1,
        }),
    );
    const headerCells = [...rowHeaderCells, ...treeCells];
    const totalCols = rowHeaderColOffset + leaves.length;

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data');

    // Header cells + merges.
    headerCells.forEach(cell => {
        const startRow = cell.row + 1;
        const startCol = cell.col + 1;
        if (cell.rowSpan > 1 || cell.colSpan > 1) {
            worksheet.mergeCells(
                startRow,
                startCol,
                startRow + cell.rowSpan - 1,
                startCol + cell.colSpan - 1,
            );
        }
        worksheet.getCell(startRow, startCol).value = cell.label;
    });

    // Style every header cell (including ones covered by a merge) so the
    // fill/border/font are consistent across the whole merged block.
    for (let row = 1; row <= maxDepth; row += 1) {
        for (let col = 1; col <= totalCols; col += 1) {
            const cell = worksheet.getCell(row, col);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: HEADER_FILL_COLOR },
            };
            cell.font = { color: { argb: HEADER_FONT_COLOR }, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = THIN_BORDER;
        }
    }

    // Body rows.
    const colTexts: string[][] = Array.from({ length: totalCols }, () => []);
    data.forEach((rowData, rowIndex) => {
        const excelRow = maxDepth + rowIndex + 1;
        rowHeaderColumns.forEach((key, colIndex) => {
            const formatter = getSmartFormatter(
                rowHeaderColumnFormats[key]?.numberFormat,
            );
            const text = renderFormattedValue(rowData[key], formatter);
            worksheet.getCell(excelRow, colIndex + 1).value = text;
            colTexts[colIndex].push(text);
        });
        leaves.forEach(leaf => {
            const formatter = getSmartFormatter(leaf.node.numberFormat);
            const text = renderFormattedValue(rowData[leaf.dataIndex], formatter);
            worksheet.getCell(excelRow, leaf.col + 1).value = text;
            colTexts[leaf.col].push(text);
        });
    });

    // Style every body cell; subtotal/total rows get a bold, tinted look
    // matching the on-screen table's .mht-subtotal-row/.mht-total-row.
    for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
        const excelRow = maxDepth + rowIndex + 1;
        const rowType = data[rowIndex][ROW_TYPE_KEY];
        const fillColor =
            rowType === 'total'
                ? TOTAL_FILL_COLOR
                : rowType === 'subtotal'
                    ? SUBTOTAL_FILL_COLOR
                    : undefined;
        for (let col = 1; col <= totalCols; col += 1) {
            const cell = worksheet.getCell(excelRow, col);
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = THIN_BORDER;
            if (fillColor) {
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: fillColor },
                };
            }
        }
    }

    // Merge row-header cells exactly like the on-screen table does, honoring
    // each column's own merge override (falls back to mergeRowHeaders).
    const spans = computeRowSpans(data, rowHeaderColumns);
    rowHeaderColumns.forEach((key, colIndex) => {
        const effectiveMerge = rowHeaderColumnFormats[key]?.merge ?? mergeRowHeaders;
        if (!effectiveMerge) return;
        let row = 0;
        while (row < data.length) {
            const span = spans[colIndex][row];
            if (span > 1) {
                const startRow = maxDepth + row + 1;
                worksheet.mergeCells(
                    startRow,
                    colIndex + 1,
                    startRow + span - 1,
                    colIndex + 1,
                );
            }
            row += Math.max(span, 1);
        }
    });

    // Auto-fit column widths based on the widest header label or cell text.
    const headerLabelByCol = new Map<number, string>();
    rowHeaderColumns.forEach((key, index) =>
        headerLabelByCol.set(index, rowHeaderColumnFormats[key]?.label || key),
    );
    leaves.forEach(leaf => headerLabelByCol.set(leaf.col, leaf.node.label));

    for (let col = 0; col < totalCols; col += 1) {
        const headerLen = (headerLabelByCol.get(col) || '').length;
        const maxBodyLen = colTexts[col].reduce(
            (max, text) => Math.max(max, text.length),
            0,
        );
        const width = Math.min(
            Math.max(headerLen, maxBodyLen, MIN_COL_WIDTH - 2) + 2,
            MAX_COL_WIDTH,
        );
        worksheet.getColumn(col + 1).width = width;
    }

    worksheet.views = [{ state: 'frozen', ySplit: maxDepth }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.xlsx`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } finally {
        window.URL.revokeObjectURL(url);
    }
}
