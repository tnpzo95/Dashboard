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
import { styled, css } from '@apache-superset/core/theme';
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

const Wrapper = styled.div<{
    height: number;
    width: number;
    fontSize?: number;
}>`
    ${({ theme, height, width, fontSize }) => css`
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
        }
        .mht-subtotal-row > td {
            font-weight: ${theme.fontWeightStrong};
            background: ${theme.colorFillTertiary};
        }
        .mht-total-row > td {
            font-weight: ${theme.fontWeightStrong};
            background: ${theme.colorFillSecondary};
        }
    `}
`;

const ErrorMessage = styled.div`
    ${({ theme }) => css`
        padding: ${theme.sizeUnit * 4}px;
        color: ${theme.colorError};
    `}
`;

function buildColumns(
    nodes: HeaderNode[],
    parentPath: string,
): ColumnsType<MergedHeaderTableDatum> {
    return nodes.map((node, index) => {
        const path = `${parentPath}-${index}`;
        if (node.children?.length) {
            return {
                title: node.label,
                key: path,
                align: node.align || 'center',
                children: buildColumns(node.children, path),
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
    error,
}: MergedHeaderTableVizProps) {
    if (error) {
        return (
            <ErrorMessage>
                {t('Invalid header structure JSON')}: {error}
            </ErrorMessage>
        );
    }

    const columns: ColumnsType<MergedHeaderTableDatum> = [
        ...buildRowHeaderColumns(
            rowHeaderColumns,
            Boolean(mergeRowHeaders),
            data,
            rowHeaderColumnFormats || {},
        ),
        ...buildColumns(headerTree, 'col'),
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
