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
import { useState } from 'react';
import { QueryFormColumn } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { styled, css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import {
    Button,
    InputNumber,
    JsonEditor,
    ModalTrigger,
    Select,
} from '@superset-ui/core/components';
import { DEFAULT_HEADER_TREE_JSON } from './constants';
import HeaderTreeDesigner from './HeaderTreeDesigner';
import { HeaderNode } from './types';
import {
    collectLeaves,
    getFormatOptionsForColumn,
    getPivotColumns,
    parseHeaderTree,
    updateLeafColumn,
    updateLeafPivot,
    updateNodeNumberFormat,
    updateNodeWidth,
} from './headerTreeUtils';

interface DatasourceColumn {
    column_name: string;
    verbose_name?: string | null;
    type_generic?: GenericDataType;
    is_dttm?: boolean;
}

export interface HeaderStructureControlProps {
    label?: string;
    description?: string;
    value?: string;
    onChange?: (value: string) => void;
    datasource?: {
        columns?: DatasourceColumn[];
    } | null;
    datasourceColumns?: DatasourceColumn[] | null;
}

const Wrapper = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit}px;
    `}
`;

const HeaderLabel = styled.div`
    ${({ theme }) => css`
        font-weight: ${theme.fontWeightStrong};
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorText};
        margin-bottom: ${theme.sizeUnit}px;
    `}
`;

const HeaderDescription = styled.div`
    ${({ theme }) => css`
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextTertiary};
        margin-bottom: ${theme.sizeUnit * 2}px;
    `}
`;

const EditorBorder = styled.div`
    ${({ theme }) => css`
        border: 1px solid ${theme.colorBorder};
        border-radius: ${theme.borderRadius}px;
        overflow: hidden;
    `}
`;

const ButtonRow = styled.div`
    ${({ theme }) => css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
    `}
`;

const ModeToggle = styled.div`
    ${({ theme }) => css`
        display: flex;
        border: 1px solid ${theme.colorBorder};
        border-radius: ${theme.borderRadius}px;
        overflow: hidden;
        flex-shrink: 0;
    `}
`;

const ModeButton = styled.button<{ active?: boolean }>`
    ${({ theme, active }) => css`
        border: none;
        cursor: pointer;
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 3}px;
        font-size: ${theme.fontSizeSM}px;
        background: ${active ? theme.colorPrimary : 'transparent'};
        color: ${active ? theme.colorWhite : theme.colorText};
    `}
`;

const ModalEditorWrapper = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 2}px;
    `}
`;

const ErrorText = styled.div`
    ${({ theme }) => css`
        color: ${theme.colorError};
        font-size: ${theme.fontSizeSM}px;
        margin-top: ${theme.sizeUnit}px;
    `}
`;

const LeafSection = styled.div`
    ${({ theme }) => css`
        margin-top: ${theme.sizeUnit * 3}px;
        padding-top: ${theme.sizeUnit * 3}px;
        border-top: 1px solid ${theme.colorBorderSecondary};
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 2}px;
    `}
`;

const SectionTitle = styled.div`
    ${({ theme }) => css`
        font-weight: ${theme.fontWeightStrong};
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorText};
    `}
`;

const LeafRow = styled.div`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 3}px;
        padding: ${theme.sizeUnit}px 0;
    `}
`;

const SelectSlot = styled.div`
    width: 220px;
    flex-shrink: 0;
`;

const PivotFieldsWrapper = styled.div`
    ${({ theme }) => css`
        display: flex;
        gap: ${theme.sizeUnit}px;
        flex-shrink: 0;
    `}
`;

const PivotSelectSlot = styled.div`
    width: 160px;
    flex-shrink: 0;
`;

const WidthSlot = styled.div`
    width: 90px;
    flex-shrink: 0;
`;

const FormatSlot = styled.div`
    width: 200px;
    flex-shrink: 0;
`;

const LeafLabel = styled.div`
    ${({ theme }) => css`
        flex: 1;
        min-width: 0;
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextSecondary};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        span.tag {
            margin-left: ${theme.sizeUnit}px;
            font-size: ${theme.fontSizeXS}px;
            color: ${theme.colorPrimary};
            border: 1px solid ${theme.colorPrimaryBorder};
            border-radius: ${theme.borderRadius}px;
            padding: 0 ${theme.sizeUnit}px;
        }
    `}
`;

export default function HeaderStructureControl({
    label,
    description,
    value,
    onChange,
    datasource,
    datasourceColumns,
}: HeaderStructureControlProps) {
    const [mode, setMode] = useState<'design' | 'json'>('design');
    const jsonText = value ?? DEFAULT_HEADER_TREE_JSON;
    const { columns: tree, error } = parseHeaderTree(jsonText);
    const leaves = collectLeaves(tree);
    const resolvedColumns = datasourceColumns || datasource?.columns || [];
    const columnOptions = resolvedColumns.map(column => ({
        label: column.verbose_name || column.column_name,
        value: column.column_name,
        type_generic: column.type_generic,
        is_dttm: column.is_dttm,
    }));

    const handleTextChange = (newValue: string) => {
        onChange?.(newValue);
    };

    const handleTreeChange = (newTree: HeaderNode[]) => {
        onChange?.(JSON.stringify({ columns: newTree }, null, 2));
    };

    const handleFormat = () => {
        try {
            const parsed = JSON.parse(jsonText);
            onChange?.(JSON.stringify(parsed, null, 2));
        } catch {
            // Invalid JSON -- leave the text as-is, the error is shown below.
        }
    };

    const handleLeafColumnChange = (
        path: number[],
        column: QueryFormColumn | undefined,
    ) => {
        const newTree = updateLeafColumn(tree, path, column);
        onChange?.(JSON.stringify({ columns: newTree }, null, 2));
    };

    const handlePivotColumnChange = (
        path: number[],
        field: 'valueColumn',
        column: QueryFormColumn | undefined,
    ) => {
        const newTree = updateLeafPivot(tree, path, { [field]: column });
        onChange?.(JSON.stringify({ columns: newTree }, null, 2));
    };

    const handlePivotColumnsChange = (
        path: number[],
        columns: QueryFormColumn[] | undefined,
    ) => {
        const newTree = updateLeafPivot(tree, path, {
            pivotColumn: undefined,
            pivotColumns: columns,
        });
        onChange?.(JSON.stringify({ columns: newTree }, null, 2));
    };

    const handleWidthChange = (path: number[], width: number | null) => {
        const newTree = updateNodeWidth(tree, path, width ?? undefined);
        onChange?.(JSON.stringify({ columns: newTree }, null, 2));
    };

    const handleNumberFormatChange = (
        path: number[],
        numberFormat: string | undefined,
    ) => {
        const newTree = updateNodeNumberFormat(tree, path, numberFormat);
        onChange?.(JSON.stringify({ columns: newTree }, null, 2));
    };

    return (
        <Wrapper>
            {label && <HeaderLabel>{label}</HeaderLabel>}
            {description && <HeaderDescription>{description}</HeaderDescription>}
            <ButtonRow>
                <ModeToggle>
                    <ModeButton
                        type="button"
                        active={mode === 'design'}
                        onClick={() => setMode('design')}
                    >
                        {t('Design')}
                    </ModeButton>
                    <ModeButton
                        type="button"
                        active={mode === 'json'}
                        onClick={() => setMode('json')}
                    >
                        {t('JSON')}
                    </ModeButton>
                </ModeToggle>
                {mode === 'json' && (
                    <ButtonRow>
                        <Button buttonSize="small" onClick={handleFormat}>
                            {t('Format JSON')}
                        </Button>
                        <ModalTrigger
                            modalTitle={t('Header Structure (JSON)')}
                            width="900px"
                            responsive
                            triggerNode={
                                <Button buttonSize="small">
                                    {t('Edit JSON in popup')}
                                </Button>
                            }
                            modalBody={
                                <ModalEditorWrapper>
                                    <ButtonRow>
                                        <Button
                                            buttonSize="small"
                                            onClick={handleFormat}
                                        >
                                            {t('Format JSON')}
                                        </Button>
                                    </ButtonRow>
                                    <EditorBorder>
                                        <JsonEditor
                                            value={jsonText}
                                            onChange={handleTextChange}
                                            width="100%"
                                            height="65vh"
                                            minLines={30}
                                            maxLines={1000}
                                            showPrintMargin={false}
                                            wrapEnabled
                                        />
                                    </EditorBorder>
                                    {error && (
                                        <ErrorText>
                                            {t('Invalid JSON')}: {error}
                                        </ErrorText>
                                    )}
                                </ModalEditorWrapper>
                            }
                        />
                    </ButtonRow>
                )}
            </ButtonRow>
            {error && (
                <ErrorText>
                    {t('Invalid JSON')}: {error}
                </ErrorText>
            )}
            {mode === 'design' && !error && (
                <HeaderTreeDesigner
                    tree={tree}
                    onChange={handleTreeChange}
                    columnOptions={columnOptions}
                />
            )}
            {mode === 'json' && (
                <EditorBorder>
                    <JsonEditor
                        value={jsonText}
                        onChange={handleTextChange}
                        width="100%"
                        height="220px"
                        minLines={10}
                        maxLines={16}
                        showPrintMargin={false}
                        wrapEnabled
                    />
                </EditorBorder>
            )}
            {mode === 'json' && !error && leaves.length > 0 && (
                <LeafSection>
                    <SectionTitle>
                        {t(
                            'Set the value for each column (leaf), or the pivot ' +
                            'source for dynamic columns, plus an optional number ' +
                            'format and fixed width (px)',
                        )}
                    </SectionTitle>
                    {leaves.map(leaf =>
                        leaf.isPivot ? (
                            <LeafRow key={leaf.path.join('.')}>
                                <LeafLabel title={leaf.breadcrumb}>
                                    {leaf.breadcrumb}
                                    <span className="tag">{t('Pivot')}</span>
                                </LeafLabel>
                                <PivotFieldsWrapper>
                                    <PivotSelectSlot>
                                        <Select
                                            ariaLabel={t('Pivot by columns')}
                                            mode="multiple"
                                            options={columnOptions}
                                            value={getPivotColumns(
                                                leaf.node.pivot,
                                            ).filter(
                                                (col): col is string =>
                                                    typeof col === 'string',
                                            )}
                                            onChange={selected =>
                                                handlePivotColumnsChange(
                                                    leaf.path,
                                                    (selected as string[]) || undefined,
                                                )
                                            }
                                            placeholder={t(
                                                'Pivot by (order = group level, ' +
                                                'e.g. Month, Week, Date)',
                                            )}
                                            allowClear
                                        />
                                    </PivotSelectSlot>
                                    <PivotSelectSlot>
                                        <Select
                                            ariaLabel={t('Value column')}
                                            options={columnOptions}
                                            value={
                                                typeof leaf.node.pivot?.valueColumn ===
                                                'string'
                                                    ? leaf.node.pivot.valueColumn
                                                    : undefined
                                            }
                                            onChange={selected =>
                                                handlePivotColumnChange(
                                                    leaf.path,
                                                    'valueColumn',
                                                    (selected as string) || undefined,
                                                )
                                            }
                                            placeholder={t('Value column')}
                                            allowClear
                                        />
                                    </PivotSelectSlot>
                                </PivotFieldsWrapper>
                                {(() => {
                                    const { options, docs } = getFormatOptionsForColumn(
                                        typeof leaf.node.pivot?.valueColumn === 'string'
                                            ? leaf.node.pivot.valueColumn
                                            : undefined,
                                        columnOptions,
                                    );
                                    return (
                                        <FormatSlot title={docs}>
                                            <Select
                                                ariaLabel={t('Number format')}
                                                options={options}
                                                value={leaf.node.numberFormat}
                                                onChange={selected =>
                                                    handleNumberFormatChange(
                                                        leaf.path,
                                                        (selected as string) || undefined,
                                                    )
                                                }
                                                placeholder={t('Number format')}
                                                allowNewOptions
                                                allowClear
                                            />
                                        </FormatSlot>
                                    );
                                })()}
                                <WidthSlot>
                                    <InputNumber
                                        aria-label={t('Column width (px)')}
                                        placeholder={t('Width')}
                                        min={1}
                                        value={leaf.node.width}
                                        onChange={selected =>
                                            handleWidthChange(
                                                leaf.path,
                                                (selected as number) ?? null,
                                            )
                                        }
                                        style={{ width: '100%' }}
                                    />
                                </WidthSlot>
                            </LeafRow>
                        ) : (
                            <LeafRow key={leaf.path.join('.')}>
                                <LeafLabel title={leaf.breadcrumb}>
                                    {leaf.breadcrumb}
                                </LeafLabel>
                                <SelectSlot>
                                    <Select
                                        ariaLabel={t('Column')}
                                        options={columnOptions}
                                        value={
                                            typeof leaf.node.column === 'string'
                                                ? leaf.node.column
                                                : undefined
                                        }
                                        onChange={selected =>
                                            handleLeafColumnChange(
                                                leaf.path,
                                                (selected as string) || undefined,
                                            )
                                        }
                                        placeholder={t('Select a column')}
                                        allowClear
                                    />
                                </SelectSlot>
                                {(() => {
                                    const { options, docs } = getFormatOptionsForColumn(
                                        typeof leaf.node.column === 'string'
                                            ? leaf.node.column
                                            : undefined,
                                        columnOptions,
                                    );
                                    return (
                                        <FormatSlot title={docs}>
                                            <Select
                                                ariaLabel={t('Number format')}
                                                options={options}
                                                value={leaf.node.numberFormat}
                                                onChange={selected =>
                                                    handleNumberFormatChange(
                                                        leaf.path,
                                                        (selected as string) || undefined,
                                                    )
                                                }
                                                placeholder={t('Number format')}
                                                allowNewOptions
                                                allowClear
                                            />
                                        </FormatSlot>
                                    );
                                })()}
                                <WidthSlot>
                                    <InputNumber
                                        aria-label={t('Column width (px)')}
                                        placeholder={t('Width')}
                                        min={1}
                                        value={leaf.node.width}
                                        onChange={selected =>
                                            handleWidthChange(
                                                leaf.path,
                                                (selected as number) ?? null,
                                            )
                                        }
                                        style={{ width: '100%' }}
                                    />
                                </WidthSlot>
                            </LeafRow>
                        ),
                    )}
                </LeafSection>
            )}
        </Wrapper>
    );
}
