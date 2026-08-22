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
import { styled, css, isThemeDark } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Table, ColumnsType, TableSize } from '@superset-ui/core/components';
import {
    computeRowSpans,
    getFormColumnLabel,
    getSmartFormatter,
    renderFormattedValue,
    ROW_TYPE_KEY,
} from './headerTreeUtils';
import {
    HeaderNode,
    MergedHeaderTableDatum,
    MergedHeaderTableVizProps,
    RowHeaderColumnFormats,
} from './types';

// Background for the grand-Total row (not the per-group Subtotal). The
// light-theme blue reads well with dark text on a white surface, but is too
// pale to stand out against a dark surface with light text -- swap to a
// deeper blue in dark mode so it stays clearly visible either way.
const TOTAL_BG_COLOR_LIGHT = 'rgb(158, 199, 244)';
const TOTAL_BG_COLOR_DARK = 'rgb(30, 64, 110)';

const Wrapper = styled.div<{
    height: number;
    width: number;
    fontSize?: number;
}>`
    ${({ theme, height, width, fontSize }) => {
        const totalBgColor = isThemeDark(theme)
            ? TOTAL_BG_COLOR_DARK
            : TOTAL_BG_COLOR_LIGHT;
        return css`
        height: ${height}px;
        width: ${width}px;
        overflow: auto;
        font-size: ${fontSize ?? 12}px;

        .ant-table-thead > tr > th,
        .ant-table-tbody > tr > td {
            border-color: ${theme.colorBorder} !important;
        }
        .ant-table-container {
            border-color: ${theme.colorBorder} !important;
        }
        .ant-table-thead > tr > th {
            text-align: center !important;
            font-weight: ${theme.fontWeightStrong};
        }
        .ant-table-thead > tr > th .ant-table-column-title {
            text-align: center;
        }
        .ant-table-tbody > tr > td {
            text-align: center;
            /* Pinned (sticky) columns rely on their cell having an opaque
               background -- otherwise unpinned columns scrolled underneath
               show through and their text visually overlaps the pinned
               column's text. Set it explicitly (with !important below for
               subtotal/total rows) instead of relying on antd's default,
               which doesn't always resolve to an opaque color here. */
            background: ${theme.colorBgContainer};
        }
        .ant-table-tbody > tr.mht-subtotal-row > td {
            font-weight: ${theme.fontWeightStrong};
            /* colorFillTertiary is a translucent "fill" token (e.g.
               rgba(255,255,255,0.08) in dark mode) meant to be layered on
               top of a background, not used standalone -- alone it lets
               pinned columns' underlying scrolled content show through.
               Painting it as a background-image layer over an opaque
               background-color flattens both into one opaque result. */
            background-color: ${theme.colorBgContainer} !important;
            background-image: linear-gradient(
                ${theme.colorFillTertiary},
                ${theme.colorFillTertiary}
            ) !important;
        }
        /* Grand-total row: fixed light-blue background, normal (unrecolored)
           text, kept opaque (not the translucent gradient trick above) so
           pinned columns don't show scrolled content bleeding through. */
        .ant-table-tbody > tr.mht-total-row > td {
            font-weight: ${theme.fontWeightStrong};
            background-color: ${totalBgColor} !important;
            background-image: none !important;
        }
        /* Auto-inserted "Subtotal" column of a multi-level pivot, and the
           grand-"Total" column -- bold them so they stand out from the
           regular leaf columns next to them (no background highlight). */
        .ant-table-tbody > tr > td.mht-subtotal-col,
        .ant-table-thead > tr > th.mht-subtotal-col,
        .ant-table-tbody > tr > td.mht-total-col,
        .ant-table-thead > tr > th.mht-total-col {
            font-weight: ${theme.fontWeightStrong};
        }
    `;
    }}
`;

const ErrorMessage = styled.div`
    ${({ theme }) => css`
        padding: ${theme.sizeUnit * 4}px;
        color: ${theme.colorError};
    `}
`;

// Compares two rows by `dataIndex`'s value, but only within the same
// sort-scope group (every column in `groupColumns` matching -- an empty
// array means "the whole table is one group", i.e. sort freely). Rows in
// different groups, and any subtotal/total row (which repeats its group's
// own values, so it would otherwise look "same group" too), are left in
// their original relative order by returning 0, which a stable sort
// (guaranteed by the spec since ES2019) keeps exactly where they were. This
// lets a user sort within a block without breaking that block's position,
// its rowSpan merge, or subtotal/total rows.
function makeGroupSorter(
    dataIndex: string,
    groupColumns: string[],
): (a: MergedHeaderTableDatum, b: MergedHeaderTableDatum) => number {
    return (a, b) => {
        if (a[ROW_TYPE_KEY] || b[ROW_TYPE_KEY]) {
            return 0;
        }
        const sameGroup = groupColumns.every(col => a[col] === b[col]);
        if (!sameGroup) {
            return 0;
        }
        const av = a[dataIndex];
        const bv = b[dataIndex];
        if (typeof av === 'number' && typeof bv === 'number') {
            return av - bv;
        }
        return String(av ?? '').localeCompare(String(bv ?? ''));
    };
}

function buildColumns(
    nodes: HeaderNode[],
    parentPath: string,
    sortGroupColumns?: string[],
): ColumnsType<MergedHeaderTableDatum> {
    return nodes.map((node, index) => {
        const path = `${parentPath}-${index}`;
        if (node.children?.length) {
            return {
                title: node.label,
                key: path,
                align: node.align || 'center',
                children: buildColumns(node.children, path, sortGroupColumns),
            };
        }
        const dataIndex = node.column ? getFormColumnLabel(node.column) : path;
        const formatter = getSmartFormatter(node.numberFormat);
        return {
            title: node.label,
            key: dataIndex,
            dataIndex,
            align: node.align || 'right',
            width: node.width,
            className: node.isGrandTotalColumn
                ? 'mht-total-col'
                : node.isSubtotalColumn
                    ? 'mht-subtotal-col'
                    : undefined,
            sorter: sortGroupColumns
                ? makeGroupSorter(dataIndex, sortGroupColumns)
                : undefined,
            render: (value: unknown) => renderFormattedValue(value, formatter),
        };
    });
}

// AntD requires fixed columns to have an explicit pixel width to lay out
// correctly (an unset width collapses/misaligns the frozen pane), so fall
// back to this when the user hasn't set one via Row Header Column Format.
const DEFAULT_ROW_HEADER_WIDTH = 120;

function buildRowHeaderColumns(
    rowHeaderColumns: string[],
    mergeRowHeaders: boolean,
    data: MergedHeaderTableDatum[],
    columnFormats: RowHeaderColumnFormats,
): ColumnsType<MergedHeaderTableDatum> {
    const spans = computeRowSpans(data, rowHeaderColumns);
    return rowHeaderColumns.map((key, col) => {
        const formatter = getSmartFormatter(columnFormats[key]?.numberFormat);
        const pinned = Boolean(columnFormats[key]?.pinned);
        // Per-column override of the chart-level "Merge Row Headers" default
        // -- lets e.g. FACTORY stay merged while MODEL doesn't, or vice versa.
        const effectiveMerge = columnFormats[key]?.merge ?? mergeRowHeaders;
        return {
            title: columnFormats[key]?.label || key,
            key,
            dataIndex: key,
            align: 'center' as const,
            fixed: pinned ? ('left' as const) : undefined,
            width:
                columnFormats[key]?.width ??
                (pinned ? DEFAULT_ROW_HEADER_WIDTH : undefined),
            render: (value: unknown) => renderFormattedValue(value, formatter),
            onCell: effectiveMerge
                ? (_record: MergedHeaderTableDatum, rowIndex?: number) => ({
                      rowSpan: spans[col][rowIndex ?? 0],
                  })
                : undefined,
        };
    });
}

function MergedHeaderTableViz({
    width,
    height,
    data,
    headerTree,
    rowHeaderColumns,
    rowHeaderColumnFormats,
    mergeRowHeaders,
    bordered,
    cellFontSize,
    enableColumnSort,
    error,
}: MergedHeaderTableVizProps) {
    if (error) {
        return (
            <ErrorMessage>
                {t('Invalid header structure JSON')}: {error}
            </ErrorMessage>
        );
    }

    // Sorting is scoped to whichever Row Header group the user has already
    // marked meaningful via "Subtotal" (Row Header Column Format) -- rows
    // are only reordered among others sharing the same values for every
    // column up to and including that leftmost subtotal-triggering column,
    // since that's exactly the group a subtotal row sums (order-independent)
    // and its boundary the subtotal row already sits at. If no column has
    // Subtotal enabled, there's no boundary to respect, so sort applies
    // across the whole table.
    const subtotalBoundaryIndex = rowHeaderColumns.findIndex(
        col => rowHeaderColumnFormats?.[col]?.subtotal,
    );
    const sortGroupColumns = enableColumnSort
        ? rowHeaderColumns.slice(
              0,
              subtotalBoundaryIndex === -1 ? 0 : subtotalBoundaryIndex + 1,
          )
        : undefined;

    const columns: ColumnsType<MergedHeaderTableDatum> = [
        ...buildRowHeaderColumns(
            rowHeaderColumns,
            Boolean(mergeRowHeaders),
            data,
            rowHeaderColumnFormats || {},
        ),
        ...buildColumns(headerTree, 'col', sortGroupColumns),
    ];

    return (
        <Wrapper height={height} width={width} fontSize={cellFontSize}>
            <Table
                data={data}
                columns={columns}
                bordered={bordered}
                pagination={false}
                size={TableSize.Small}
                rowKey={(_record, index) => `${index}`}
                scroll={{ x: 'max-content' }}
                onRow={(record: MergedHeaderTableDatum) => {
                    const rowType = record[ROW_TYPE_KEY];
                    if (rowType === 'subtotal') {
                        return { className: 'mht-subtotal-row' };
                    }
                    if (rowType === 'total') {
                        return { className: 'mht-total-row' };
                    }
                    return {};
                }}
            />
        </Wrapper>
    );
}

export default MergedHeaderTableViz;
