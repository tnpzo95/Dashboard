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
import { ChangeEvent } from 'react';
import { getColumnLabel, QueryFormColumn } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { styled, css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Input, InputNumber, Select, Switch } from '@superset-ui/core/components';
import { RowHeaderColumnFormat, RowHeaderColumnFormats } from './types';
import { getFormatOptionsForColumn } from './headerTreeUtils';

interface DatasourceColumn {
    column_name: string;
    verbose_name?: string | null;
    type_generic?: GenericDataType;
    is_dttm?: boolean;
}

export interface RowHeaderColumnFormatControlProps {
    label?: string;
    description?: string;
    value?: RowHeaderColumnFormats;
    onChange?: (value: RowHeaderColumnFormats) => void;
    groupby?: QueryFormColumn[];
    mergeRowHeaders?: boolean;
    datasourceColumns?: DatasourceColumn[] | null;
}

const Wrapper = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 2}px;
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

const EmptyText = styled.div`
    ${({ theme }) => css`
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextTertiary};
        font-style: italic;
    `}
`;

const ColumnCard = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 2}px;
        background: ${theme.colorBgContainer};
        border: 1px solid ${theme.colorBorderSecondary};
        border-left: 3px solid ${theme.colorPrimary};
        border-radius: ${theme.borderRadius}px;
        padding: ${theme.sizeUnit * 2}px;
    `}
`;

const ColumnLabel = styled.div`
    ${({ theme }) => css`
        font-size: ${theme.fontSizeSM}px;
        font-weight: ${theme.fontWeightStrong};
        color: ${theme.colorText};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    `}
`;

const FieldsRow = styled.div`
    ${({ theme }) => css`
        display: flex;
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
    `}
`;

const SwitchesRow = styled.div`
    ${({ theme }) => css`
        display: flex;
        gap: ${theme.sizeUnit * 4}px;
        padding-top: ${theme.sizeUnit}px;
        border-top: 1px dashed ${theme.colorBorderSecondary};
    `}
`;

const SwitchField = styled.label`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit}px;
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextSecondary};
        cursor: pointer;
    `}
`;

export default function RowHeaderColumnFormatControl({
    label,
    description,
    value,
    onChange,
    groupby = [],
    mergeRowHeaders = true,
    datasourceColumns = [],
}: RowHeaderColumnFormatControlProps) {
    const config = value || {};
    const columns = groupby.map(column => getColumnLabel(column));
    const columnOptions = (datasourceColumns || []).map(column => ({
        label: column.verbose_name || column.column_name,
        value: column.column_name,
        type_generic: column.type_generic,
        is_dttm: column.is_dttm,
    }));

    const handleChange = (
        column: string,
        patch: Partial<RowHeaderColumnFormat>,
    ) => {
        onChange?.({
            ...config,
            [column]: { ...config[column], ...patch },
        });
    };

    return (
        <Wrapper>
            {label && <HeaderLabel>{label}</HeaderLabel>}
            {description && <HeaderDescription>{description}</HeaderDescription>}
            {columns.length === 0 ? (
                <EmptyText>
                    {t('Select one or more Row Header Columns above first.')}
                </EmptyText>
            ) : (
                columns.map(column => (
                    <ColumnCard key={column}>
                        <ColumnLabel title={column}>{column}</ColumnLabel>
                        <Field>
                            <FieldLabel>{t('Display title')}</FieldLabel>
                            <Input
                                aria-label={t('Display title')}
                                placeholder={column}
                                value={config[column]?.label || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    handleChange(column, {
                                        label: e.target.value || undefined,
                                    })
                                }
                            />
                        </Field>
                        <FieldsRow>
                            {(() => {
                                const { options, docs } = getFormatOptionsForColumn(
                                    column,
                                    columnOptions,
                                );
                                return (
                                    <Field title={docs} style={{ flex: 1 }}>
                                        <FieldLabel>{t('Number format')}</FieldLabel>
                                        <Select
                                            ariaLabel={t('Number format')}
                                            options={options}
                                            value={config[column]?.numberFormat}
                                            onChange={selected =>
                                                handleChange(column, {
                                                    numberFormat:
                                                        (selected as string) || undefined,
                                                })
                                            }
                                            placeholder={t('Number format')}
                                            allowNewOptions
                                            allowClear
                                        />
                                    </Field>
                                );
                            })()}
                            <Field style={{ width: 90 }}>
                                <FieldLabel>{t('Width (px)')}</FieldLabel>
                                <InputNumber
                                    aria-label={t('Column width (px)')}
                                    placeholder={t('Width')}
                                    min={1}
                                    value={config[column]?.width}
                                    onChange={selected =>
                                        handleChange(column, {
                                            width: (selected as number) ?? undefined,
                                        })
                                    }
                                    style={{ width: '100%' }}
                                />
                            </Field>
                        </FieldsRow>
                        <SwitchesRow>
                            <SwitchField>
                                <Switch
                                    checked={Boolean(config[column]?.pinned)}
                                    onChange={checked =>
                                        handleChange(column, { pinned: checked })
                                    }
                                />
                                {t('Pin')}
                            </SwitchField>
                            <SwitchField
                                title={t(
                                    'Merge consecutive equal values in this ' +
                                    'column into one cell. Unset follows the ' +
                                    'chart-level Merge Row Headers option.',
                                )}
                            >
                                <Switch
                                    checked={
                                        config[column]?.merge ?? mergeRowHeaders
                                    }
                                    onChange={checked =>
                                        handleChange(column, { merge: checked })
                                    }
                                />
                                {t('Merge')}
                            </SwitchField>
                            <SwitchField
                                title={t(
                                    'Insert a subtotal row summing every ' +
                                    'numeric column each time this ' +
                                    "column's group ends.",
                                )}
                            >
                                <Switch
                                    checked={Boolean(config[column]?.subtotal)}
                                    onChange={checked =>
                                        handleChange(column, { subtotal: checked })
                                    }
                                />
                                {t('Subtotal')}
                            </SwitchField>
                        </SwitchesRow>
                    </ColumnCard>
                ))
            )}
        </Wrapper>
    );
}
