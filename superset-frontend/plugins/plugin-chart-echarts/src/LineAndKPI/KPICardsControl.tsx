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
import { nanoid } from 'nanoid';
import { styled, css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import {
    Aggregate,
    AdhocMetricSimple,
    QueryFormMetric,
    isAdhocMetricSimple,
} from '@superset-ui/core';
import { Popover, Input, Select, Switch } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { D3_FORMAT_DOCS, D3_FORMAT_OPTIONS } from '@superset-ui/chart-controls';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    KPI_QUERY_SOURCE_OPTIONS,
    KPI_AGGREGATE_OPTIONS,
    DEFAULT_KPI_BORDER_COLORS,
} from './constants';
import { KPICardConfig } from './types';

const numberFormatOptions = D3_FORMAT_OPTIONS.map(([value, label]) => ({
    value,
    label,
}));

interface SavedMetric {
    metric_name: string;
    verbose_name?: string | null;
}

interface DatasourceColumn {
    column_name: string;
    verbose_name?: string | null;
}

export interface KPICardsControlProps {
    label?: string;
    description?: string;
    value?: KPICardConfig[];
    onChange?: (value: KPICardConfig[]) => void;
    datasource?: {
        metrics?: SavedMetric[];
        columns?: DatasourceColumn[];
    } | null;
    kpiSavedMetrics?: SavedMetric[] | null;
    kpiColumns?: DatasourceColumn[] | null;
}

export const createDefaultKPICard = (existingCount: number): KPICardConfig => ({
    id: nanoid(),
    title: `KPI #${existingCount + 1}`,
    metric: undefined,
    queryIndex: 1,
    borderColor:
        DEFAULT_KPI_BORDER_COLORS[existingCount % DEFAULT_KPI_BORDER_COLORS.length],
    enabled: true,
});

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

const Row = styled.div`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit}px;
        background: ${theme.colorBgContainer};
        border: 1px solid ${theme.colorBorderSecondary};
        border-radius: ${theme.borderRadius}px;
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    `}
`;

const DragHandle = styled.span`
    ${({ theme }) => css`
        display: flex;
        cursor: grab;
        color: ${theme.colorTextTertiary};
    `}
`;

const ColorDot = styled.span<{ color?: string }>`
    ${({ color }) => css`
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: ${color || '#ccc'};
        flex-shrink: 0;
    `}
`;

const RowLabel = styled.button`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
        flex: 1;
        min-width: 0;
        border: none;
        background: transparent;
        padding: ${theme.sizeUnit}px 0;
        text-align: left;
        cursor: pointer;
        color: ${theme.colorText};
        font-size: ${theme.fontSizeSM}px;

        span.title {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `}
`;

const DisabledTag = styled.span`
    ${({ theme }) => css`
        font-size: ${theme.fontSizeXS}px;
        color: ${theme.colorTextTertiary};
        border: 1px solid ${theme.colorBorderSecondary};
        border-radius: ${theme.borderRadius}px;
        padding: 0 ${theme.sizeUnit}px;
        flex-shrink: 0;
    `}
`;

const DeleteButton = styled.button`
    ${({ theme }) => css`
        display: flex;
        border: none;
        background: transparent;
        cursor: pointer;
        color: ${theme.colorTextTertiary};
        &:hover {
            color: ${theme.colorError};
        }
    `}
`;

const AddButton = styled.button`
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
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
        margin-top: ${theme.sizeUnit}px;
        &:hover {
            border-color: ${theme.colorPrimary};
        }
    `}
`;

const FormWrapper = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 2}px;
        width: 260px;
    `}
`;

const FormField = styled.label`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit}px;
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextSecondary};
    `}
`;

const InlineField = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const ColorInput = styled.input`
    width: 40px;
    height: 28px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
`;

const ModeToggle = styled.div`
    ${({ theme }) => css`
        display: flex;
        border: 1px solid ${theme.colorBorder};
        border-radius: ${theme.borderRadius}px;
        overflow: hidden;
    `}
`;

const ModeButton = styled.button<{ active?: boolean }>`
    ${({ theme, active }) => css`
        flex: 1;
        border: none;
        cursor: pointer;
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
        font-size: ${theme.fontSizeSM}px;
        background: ${active ? theme.colorPrimary : 'transparent'};
        color: ${active ? theme.colorWhite : theme.colorText};
    `}
`;

function KPICardEditForm({
    card,
    savedMetrics,
    columns,
    onChange,
}: {
    card: KPICardConfig;
    savedMetrics: SavedMetric[];
    columns: DatasourceColumn[];
    onChange: (patch: Partial<KPICardConfig>) => void;
}) {
    const metricOptions = savedMetrics.map(metric => ({
        label: metric.verbose_name || metric.metric_name,
        value: metric.metric_name,
    }));
    const columnOptions = columns.map(column => ({
        label: column.verbose_name || column.column_name,
        value: column.column_name,
    }));

    const { metric: cardMetric } = card;
    const isColumnMode = isAdhocMetricSimple(cardMetric);
    const selectedColumn = isColumnMode
        ? cardMetric.column.column_name || cardMetric.column.columnName
        : undefined;
    const selectedAggregate: Aggregate = isColumnMode
        ? cardMetric.aggregate
        : 'MAX';

    const setSavedMetric = (metricName?: string) => {
        onChange({ metric: (metricName as QueryFormMetric) || undefined });
    };

    const setColumnMetric = (columnName?: string, aggregate = selectedAggregate) => {
        if (!columnName) {
            onChange({ metric: undefined });
            return;
        }
        const metric: AdhocMetricSimple = {
            expressionType: 'SIMPLE',
            column: { column_name: columnName },
            aggregate,
        };
        onChange({ metric });
    };

    return (
        <FormWrapper>
            <FormField>
                {t('Title')}
                <Input
                    value={card.title}
                    onChange={e => onChange({ title: e.target.value })}
                    placeholder={t('KPI title')}
                />
            </FormField>
            <FormField>
                {t('Metric Source')}
                <ModeToggle>
                    <ModeButton
                        type="button"
                        active={!isColumnMode}
                        onClick={() => setSavedMetric(metricOptions[0]?.value)}
                    >
                        {t('Saved Metric')}
                    </ModeButton>
                    <ModeButton
                        type="button"
                        active={isColumnMode}
                        onClick={() => setColumnMetric(columnOptions[0]?.value, 'MAX')}
                    >
                        {t('Column + Aggregate')}
                    </ModeButton>
                </ModeToggle>
            </FormField>
            {isColumnMode ? (
                <>
                    <FormField>
                        {t('Column')}
                        <Select
                            ariaLabel={t('Column')}
                            options={columnOptions}
                            value={selectedColumn}
                            onChange={value => setColumnMetric(value as string)}
                            placeholder={t('Select a column')}
                        />
                    </FormField>
                    <FormField>
                        {t('Aggregate')}
                        <Select
                            ariaLabel={t('Aggregate')}
                            options={KPI_AGGREGATE_OPTIONS}
                            value={selectedAggregate}
                            onChange={value =>
                                setColumnMetric(selectedColumn, value as Aggregate)
                            }
                        />
                    </FormField>
                </>
            ) : (
                <FormField>
                    {t('Metric')}
                    <Select
                        ariaLabel={t('Metric')}
                        options={metricOptions}
                        value={typeof card.metric === 'string' ? card.metric : undefined}
                        onChange={value => setSavedMetric(value as string)}
                        placeholder={t('Select a metric')}
                        allowClear
                    />
                </FormField>
            )}
            <FormField>
                {t('Value Source')}
                <Select
                    ariaLabel={t('Value Source')}
                    options={KPI_QUERY_SOURCE_OPTIONS}
                    value={card.queryIndex}
                    onChange={value => onChange({ queryIndex: value as 0 | 1 })}
                />
            </FormField>
            <FormField title={D3_FORMAT_DOCS}>
                {t('Number Format')}
                <Select
                    ariaLabel={t('Number Format')}
                    options={numberFormatOptions}
                    value={card.numberFormat}
                    onChange={value =>
                        onChange({ numberFormat: (value as string) || undefined })
                    }
                    placeholder={t('Default (chart Number format)')}
                    allowNewOptions
                    allowClear
                />
            </FormField>
            <InlineField>
                <span>{t('Border Color')}</span>
                <ColorInput
                    type="color"
                    value={card.borderColor || '#4CAF50'}
                    onChange={e => onChange({ borderColor: e.target.value })}
                />
            </InlineField>
            <InlineField>
                <span>{t('Enabled')}</span>
                <Switch
                    checked={card.enabled}
                    onChange={checked => onChange({ enabled: checked })}
                />
            </InlineField>
        </FormWrapper>
    );
}

function SortableKpiRow({
    card,
    savedMetrics,
    columns,
    editingId,
    setEditingId,
    onChange,
    onDelete,
}: {
    card: KPICardConfig;
    savedMetrics: SavedMetric[];
    columns: DatasourceColumn[];
    editingId: string | null;
    setEditingId: (id: string | null) => void;
    onChange: (patch: Partial<KPICardConfig>) => void;
    onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: card.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <Row ref={setNodeRef} style={style}>
            <DragHandle {...attributes} {...listeners}>
                <Icons.MenuOutlined iconSize="s" />
            </DragHandle>
            <Popover
                trigger="click"
                placement="right"
                open={editingId === card.id}
                onOpenChange={open => setEditingId(open ? card.id : null)}
                content={
                    <KPICardEditForm
                        card={card}
                        savedMetrics={savedMetrics}
                        columns={columns}
                        onChange={onChange}
                    />
                }
            >
                <RowLabel type="button">
                    <ColorDot color={card.borderColor} />
                    <span className="title">{card.title || t('Untitled KPI')}</span>
                    {!card.enabled && <DisabledTag>{t('Hidden')}</DisabledTag>}
                </RowLabel>
            </Popover>
            <DeleteButton type="button" onClick={onDelete} aria-label={t('Remove')}>
                <Icons.DeleteOutlined iconSize="s" />
            </DeleteButton>
        </Row>
    );
}

export default function KPICardsControl({
    label,
    description,
    value,
    onChange,
    datasource,
    kpiSavedMetrics,
    kpiColumns,
}: KPICardsControlProps) {
    const cards = value || [];
    const [editingId, setEditingId] = useState<string | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    );
    const metrics = kpiSavedMetrics || datasource?.metrics || [];
    const datasourceColumns = kpiColumns || datasource?.columns || [];

    const updateCard = (id: string, patch: Partial<KPICardConfig>) => {
        onChange?.(
            cards.map(card => (card.id === id ? { ...card, ...patch } : card)),
        );
    };

    const addCard = () => {
        const newCard = createDefaultKPICard(cards.length);
        onChange?.([...cards, newCard]);
        setEditingId(newCard.id);
    };

    const deleteCard = (id: string) => {
        onChange?.(cards.filter(card => card.id !== id));
        if (editingId === id) {
            setEditingId(null);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = cards.findIndex(card => card.id === active.id);
            const newIndex = cards.findIndex(card => card.id === over.id);
            onChange?.(arrayMove(cards, oldIndex, newIndex));
        }
    };

    return (
        <Wrapper>
            {label && <HeaderLabel>{label}</HeaderLabel>}
            {description && <HeaderDescription>{description}</HeaderDescription>}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={cards.map(card => card.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {cards.map(card => (
                        <SortableKpiRow
                            key={card.id}
                            card={card}
                            savedMetrics={metrics}
                            columns={datasourceColumns}
                            editingId={editingId}
                            setEditingId={setEditingId}
                            onChange={patch => updateCard(card.id, patch)}
                            onDelete={() => deleteCard(card.id)}
                        />
                    ))}
                </SortableContext>
            </DndContext>
            <AddButton type="button" onClick={addCard}>
                <Icons.PlusOutlined iconSize="s" />
                {t('Add KPI Card')}
            </AddButton>
        </Wrapper>
    );
}
