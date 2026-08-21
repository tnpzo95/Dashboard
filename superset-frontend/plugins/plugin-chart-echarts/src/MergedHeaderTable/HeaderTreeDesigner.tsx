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
import { ChangeEvent, useState } from 'react';
import { QueryFormColumn } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Input, InputNumber, Select, Switch } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { HeaderNode } from './types';
import {
    getFormatOptionsForColumn,
    getPivotColumns,
    insertNode,
    moveNode,
    removeNode,
    TypedColumnOption,
    updateNode,
} from './headerTreeUtils';

export type ColumnOption = TypedColumnOption;

export interface HeaderTreeDesignerProps {
    tree: HeaderNode[];
    onChange: (tree: HeaderNode[]) => void;
    columnOptions: ColumnOption[];
}

type NodeType = 'leaf' | 'group' | 'pivot';

// An empty `children` array still counts as "group" for the designer's own
// editing purposes, even though the runtime (collectLeaves/buildColumns)
// only treats a group as such once it has at least one child -- see those
// functions' `node.children?.length` checks.
const nodeTypeOf = (node: HeaderNode): NodeType => {
    if (node.pivot) return 'pivot';
    if (Array.isArray(node.children)) return 'group';
    return 'leaf';
};

const patchForType = (type: NodeType): Partial<HeaderNode> => {
    if (type === 'group') {
        return { children: [], pivot: undefined, column: undefined };
    }
    if (type === 'pivot') {
        return { pivot: {}, children: undefined, column: undefined };
    }
    return { column: undefined, pivot: undefined, children: undefined };
};

const createDefaultNode = (existingCount: number): HeaderNode => ({
    label: t('Column %s', existingCount + 1),
});

const ALIGN_OPTIONS = [
    { label: t('Left'), value: 'left' },
    { label: t('Center'), value: 'center' },
    { label: t('Right'), value: 'right' },
];

const TYPE_OPTIONS = [
    { label: t('Leaf column'), value: 'leaf' },
    { label: t('Group'), value: 'group' },
    { label: t('Pivot (dynamic)'), value: 'pivot' },
];

const TYPE_ICON = {
    leaf: Icons.TagOutlined,
    group: Icons.FolderOutlined,
    pivot: Icons.FunctionOutlined,
};

// Consistent accent color per node type -- lets the eye scan the tree and
// tell leaf/group/pivot apart at a glance instead of reading every dropdown.
const accentColor = (theme: any, type: NodeType) => {
    if (type === 'group') return theme.colorWarning;
    if (type === 'pivot') return theme.colorSuccess;
    return theme.colorPrimary;
};

const Wrapper = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 3}px;
    `}
`;

const EmptyText = styled.div`
    ${({ theme }) => css`
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextTertiary};
        font-style: italic;
        padding: ${theme.sizeUnit * 2}px 0;
        text-align: center;
    `}
`;

const NodeBox = styled.div<{ nodeType: NodeType }>`
    ${({ theme, nodeType }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 2}px;
        background: ${theme.colorBgContainer};
        border: 1px solid ${theme.colorBorderSecondary};
        border-left: 3px solid ${accentColor(theme, nodeType)};
        border-radius: ${theme.borderRadius}px;
        padding: ${theme.sizeUnit * 2}px;
        box-shadow: ${theme.boxShadowTertiary};
    `}
`;

const NodeHeaderRow = styled.div`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
    `}
`;

const MoveButtons = styled.div`
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
`;

const IconButton = styled.button`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        cursor: pointer;
        color: ${theme.colorTextTertiary};
        padding: 0;
        line-height: ${theme.sizeUnit * 2}px;
        &:hover:not(:disabled) {
            color: ${theme.colorPrimary};
        }
        &:disabled {
            opacity: 0.25;
            cursor: default;
        }
    `}
`;

const CollapseButton = styled.button`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        cursor: pointer;
        color: ${theme.colorTextSecondary};
        padding: 0;
        flex-shrink: 0;
    `}
`;

const TypeIconBadge = styled.div<{ nodeType: NodeType }>`
    ${({ theme, nodeType }) => css`
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: ${accentColor(theme, nodeType)};
    `}
`;

const DeleteButton = styled.button`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        border: none;
        background: transparent;
        cursor: pointer;
        color: ${theme.colorTextTertiary};
        flex-shrink: 0;
        &:hover {
            color: ${theme.colorError};
        }
    `}
`;

const LabelInput = styled(Input)`
    flex: 1;
    min-width: 0;
    font-weight: 500;
`;

const TypeSelectSlot = styled.div`
    width: 150px;
    flex-shrink: 0;
`;

const CollapsedSummary = styled.div`
    ${({ theme }) => css`
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextTertiary};
    `}
`;

const FieldsStack = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 2}px;
        padding-top: ${theme.sizeUnit}px;
        border-top: 1px dashed ${theme.colorBorderSecondary};
    `}
`;

const FieldPairRow = styled.div`
    ${({ theme }) => css`
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: ${theme.sizeUnit * 2}px;
    `}
`;

const Field = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit}px;
        min-width: 0;
    `}
`;

const FieldLabel = styled.div`
    ${({ theme }) => css`
        font-size: ${theme.fontSizeXS}px;
        color: ${theme.colorTextTertiary};
        text-transform: uppercase;
        letter-spacing: 0.02em;
    `}
`;

const InlineSwitchField = styled.label`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextSecondary};
        cursor: pointer;
    `}
`;

const GroupChildren = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 2}px;
        margin-left: ${theme.sizeUnit * 3}px;
        padding-left: ${theme.sizeUnit * 3}px;
        border-left: 2px dashed ${theme.colorBorderSecondary};
    `}
`;

const DashedAddButton = styled.button`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        justify-content: center;
        gap: ${theme.sizeUnit}px;
        border: 1px dashed ${theme.colorBorder};
        border-radius: ${theme.borderRadius}px;
        background: transparent;
        color: ${theme.colorPrimary};
        cursor: pointer;
        padding: ${theme.sizeUnit * 2}px;
        font-size: ${theme.fontSizeSM}px;
        width: 100%;
        &:hover {
            border-color: ${theme.colorPrimary};
            background: ${theme.colorPrimaryBg};
        }
    `}
`;

// Recursively count every leaf/pivot column under a node, so a collapsed
// group can show "3 columns" instead of just hiding everything silently.
function countColumns(node: HeaderNode): number {
    if (node.pivot) return 1;
    if (Array.isArray(node.children)) {
        return node.children.reduce((sum, child) => sum + countColumns(child), 0);
    }
    return 1;
}

interface NodeEditorProps {
    node: HeaderNode;
    path: number[];
    isFirst: boolean;
    isLast: boolean;
    columnOptions: ColumnOption[];
    onUpdate: (path: number[], patch: Partial<HeaderNode>) => void;
    onRemove: (path: number[]) => void;
    onMove: (path: number[], direction: -1 | 1) => void;
    onAddChild: (parentPath: number[]) => void;
}

function NodeEditor({
    node,
    path,
    isFirst,
    isLast,
    columnOptions,
    onUpdate,
    onRemove,
    onMove,
    onAddChild,
}: NodeEditorProps) {
    const type = nodeTypeOf(node);
    const [collapsed, setCollapsed] = useState(false);
    const TypeIcon = TYPE_ICON[type];
    const childCount = type === 'group' ? (node.children || []).length : 0;

    return (
        <NodeBox nodeType={type}>
            <NodeHeaderRow>
                <MoveButtons>
                    <IconButton
                        type="button"
                        disabled={isFirst}
                        onClick={() => onMove(path, -1)}
                        aria-label={t('Move up')}
                    >
                        <Icons.UpOutlined iconSize="xs" />
                    </IconButton>
                    <IconButton
                        type="button"
                        disabled={isLast}
                        onClick={() => onMove(path, 1)}
                        aria-label={t('Move down')}
                    >
                        <Icons.DownOutlined iconSize="xs" />
                    </IconButton>
                </MoveButtons>
                {type === 'group' ? (
                    <CollapseButton
                        type="button"
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label={collapsed ? t('Expand') : t('Collapse')}
                    >
                        {collapsed ? (
                            <Icons.CaretRightOutlined iconSize="s" />
                        ) : (
                            <Icons.CaretDownOutlined iconSize="s" />
                        )}
                    </CollapseButton>
                ) : (
                    <TypeIconBadge nodeType={type}>
                        <TypeIcon iconSize="s" />
                    </TypeIconBadge>
                )}
                <LabelInput
                    value={node.label}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        onUpdate(path, { label: e.target.value })
                    }
                    placeholder={t('Column label')}
                />
                <TypeSelectSlot>
                    <Select
                        ariaLabel={t('Type')}
                        options={TYPE_OPTIONS}
                        value={type}
                        onChange={value =>
                            onUpdate(path, patchForType(value as NodeType))
                        }
                        allowClear={false}
                    />
                </TypeSelectSlot>
                <DeleteButton
                    type="button"
                    onClick={() => onRemove(path)}
                    aria-label={t('Remove')}
                >
                    <Icons.DeleteOutlined iconSize="s" />
                </DeleteButton>
            </NodeHeaderRow>

            {type === 'group' && collapsed && (
                <CollapsedSummary>
                    {childCount === 0
                        ? t('Empty group')
                        : t('%s column(s) inside', countColumns(node))}
                </CollapsedSummary>
            )}

            {type === 'leaf' && (
                <FieldsStack>
                    <Field>
                        <FieldLabel>{t('Column')}</FieldLabel>
                        <Select
                            ariaLabel={t('Column')}
                            options={columnOptions}
                            value={
                                typeof node.column === 'string'
                                    ? node.column
                                    : undefined
                            }
                            onChange={value =>
                                onUpdate(path, {
                                    column: (value as string) || undefined,
                                })
                            }
                            placeholder={t('Select a column')}
                            allowClear
                        />
                    </Field>
                    {(() => {
                        const { options, docs } = getFormatOptionsForColumn(
                            typeof node.column === 'string' ? node.column : undefined,
                            columnOptions,
                        );
                        return (
                            <Field title={docs}>
                                <FieldLabel>{t('Number format')}</FieldLabel>
                                <Select
                                    ariaLabel={t('Number format')}
                                    options={options}
                                    value={node.numberFormat}
                                    onChange={value =>
                                        onUpdate(path, {
                                            numberFormat: (value as string) || undefined,
                                        })
                                    }
                                    placeholder={t('Number format')}
                                    allowNewOptions
                                    allowClear
                                />
                            </Field>
                        );
                    })()}
                    <FieldPairRow>
                        <Field>
                            <FieldLabel>{t('Align')}</FieldLabel>
                            <Select
                                ariaLabel={t('Align')}
                                options={ALIGN_OPTIONS}
                                value={node.align}
                                onChange={value =>
                                    onUpdate(path, {
                                        align:
                                            (value as HeaderNode['align']) || undefined,
                                    })
                                }
                                allowClear
                            />
                        </Field>
                        <Field>
                            <FieldLabel>{t('Width (px)')}</FieldLabel>
                            <InputNumber
                                aria-label={t('Width (px)')}
                                min={1}
                                value={node.width}
                                onChange={value =>
                                    onUpdate(path, {
                                        width: (value as number) ?? undefined,
                                    })
                                }
                                style={{ width: '100%' }}
                            />
                        </Field>
                    </FieldPairRow>
                </FieldsStack>
            )}

            {type === 'pivot' && (
                <FieldsStack>
                    <Field>
                        <FieldLabel>
                            {t(
                                'Pivot by (order = group level, outermost first, ' +
                                'e.g. Month, Week, Date)',
                            )}
                        </FieldLabel>
                        <Select
                            ariaLabel={t('Pivot by columns')}
                            mode="multiple"
                            options={columnOptions}
                            value={getPivotColumns(node.pivot).filter(
                                (col): col is string => typeof col === 'string',
                            )}
                            onChange={value =>
                                onUpdate(path, {
                                    pivot: {
                                        ...node.pivot,
                                        pivotColumn: undefined,
                                        pivotColumns:
                                            (value as QueryFormColumn[]) || undefined,
                                    },
                                })
                            }
                            placeholder={t('Pivot by column(s)')}
                            allowClear
                        />
                    </Field>
                    <Field>
                        <FieldLabel>{t('Value column')}</FieldLabel>
                        <Select
                            ariaLabel={t('Value column')}
                            options={columnOptions}
                            value={
                                typeof node.pivot?.valueColumn === 'string'
                                    ? node.pivot.valueColumn
                                    : undefined
                            }
                            onChange={value =>
                                onUpdate(path, {
                                    pivot: {
                                        ...node.pivot,
                                        valueColumn:
                                            (value as QueryFormColumn) || undefined,
                                    },
                                })
                            }
                            placeholder={t('Value column')}
                            allowClear
                        />
                    </Field>
                    <Field>
                        <FieldLabel>{t('Label format (date/number)')}</FieldLabel>
                        <Input
                            value={node.pivot?.labelFormat || ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                onUpdate(path, {
                                    pivot: {
                                        ...node.pivot,
                                        labelFormat: e.target.value || undefined,
                                    },
                                })
                            }
                            placeholder="%Y-%m-%d"
                        />
                    </Field>
                    <InlineSwitchField>
                        <Switch
                            checked={Boolean(node.pivot?.sortDescending)}
                            onChange={checked =>
                                onUpdate(path, {
                                    pivot: { ...node.pivot, sortDescending: checked },
                                })
                            }
                        />
                        {t('Sort descending')}
                    </InlineSwitchField>
                    <InlineSwitchField>
                        <Switch
                            checked={Boolean(node.pivot?.colSubtotals)}
                            onChange={checked =>
                                onUpdate(path, {
                                    pivot: { ...node.pivot, colSubtotals: checked },
                                })
                            }
                        />
                        {t('Show column subtotal per group (multi-level pivot)')}
                    </InlineSwitchField>
                    <InlineSwitchField>
                        <Switch
                            checked={Boolean(node.pivot?.colGrandTotal)}
                            onChange={checked =>
                                onUpdate(path, {
                                    pivot: { ...node.pivot, colGrandTotal: checked },
                                })
                            }
                        />
                        {t('Show grand total column (sums the whole pivot)')}
                    </InlineSwitchField>
                    {(() => {
                        const { options, docs } = getFormatOptionsForColumn(
                            typeof node.pivot?.valueColumn === 'string'
                                ? node.pivot.valueColumn
                                : undefined,
                            columnOptions,
                        );
                        return (
                            <Field title={docs}>
                                <FieldLabel>{t('Number format')}</FieldLabel>
                                <Select
                                    ariaLabel={t('Number format')}
                                    options={options}
                                    value={node.numberFormat}
                                    onChange={value =>
                                        onUpdate(path, {
                                            numberFormat: (value as string) || undefined,
                                        })
                                    }
                                    placeholder={t('Number format')}
                                    allowNewOptions
                                    allowClear
                                />
                            </Field>
                        );
                    })()}
                    <FieldPairRow>
                        <Field>
                            <FieldLabel>{t('Align')}</FieldLabel>
                            <Select
                                ariaLabel={t('Align')}
                                options={ALIGN_OPTIONS}
                                value={node.align}
                                onChange={value =>
                                    onUpdate(path, {
                                        align:
                                            (value as HeaderNode['align']) || undefined,
                                    })
                                }
                                allowClear
                            />
                        </Field>
                        <Field>
                            <FieldLabel>{t('Width (px)')}</FieldLabel>
                            <InputNumber
                                aria-label={t('Width (px)')}
                                min={1}
                                value={node.width}
                                onChange={value =>
                                    onUpdate(path, {
                                        width: (value as number) ?? undefined,
                                    })
                                }
                                style={{ width: '100%' }}
                            />
                        </Field>
                    </FieldPairRow>
                </FieldsStack>
            )}

            {type === 'group' && !collapsed && (
                <GroupChildren>
                    {(node.children || []).length === 0 && (
                        <EmptyText>
                            {t('No child columns yet -- add one below.')}
                        </EmptyText>
                    )}
                    {(node.children || []).map((child, childIndex) => (
                        <NodeEditor
                            // eslint-disable-next-line react/no-array-index-key
                            key={childIndex}
                            node={child}
                            path={[...path, childIndex]}
                            isFirst={childIndex === 0}
                            isLast={childIndex === (node.children?.length || 0) - 1}
                            columnOptions={columnOptions}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                            onMove={onMove}
                            onAddChild={onAddChild}
                        />
                    ))}
                    <DashedAddButton type="button" onClick={() => onAddChild(path)}>
                        <Icons.PlusOutlined iconSize="xs" />
                        {t('Add Child Column')}
                    </DashedAddButton>
                </GroupChildren>
            )}
        </NodeBox>
    );
}

export default function HeaderTreeDesigner({
    tree,
    onChange,
    columnOptions,
}: HeaderTreeDesignerProps) {
    const handleUpdate = (path: number[], patch: Partial<HeaderNode>) => {
        onChange(updateNode(tree, path, patch));
    };
    const handleRemove = (path: number[]) => {
        onChange(removeNode(tree, path));
    };
    const handleMove = (path: number[], direction: -1 | 1) => {
        onChange(moveNode(tree, path, direction));
    };
    const handleAddChild = (parentPath: number[]) => {
        onChange(insertNode(tree, parentPath, createDefaultNode(0)));
    };
    const handleAddColumn = () => {
        onChange(insertNode(tree, null, createDefaultNode(tree.length)));
    };

    return (
        <Wrapper>
            {tree.length === 0 && (
                <EmptyText>
                    {t('No columns yet -- add one below to get started.')}
                </EmptyText>
            )}
            {tree.map((node, index) => (
                <NodeEditor
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    node={node}
                    path={[index]}
                    isFirst={index === 0}
                    isLast={index === tree.length - 1}
                    columnOptions={columnOptions}
                    onUpdate={handleUpdate}
                    onRemove={handleRemove}
                    onMove={handleMove}
                    onAddChild={handleAddChild}
                />
            ))}
            <DashedAddButton type="button" onClick={handleAddColumn}>
                <Icons.PlusOutlined iconSize="xs" />
                {t('Add Column')}
            </DashedAddButton>
        </Wrapper>
    );
}
