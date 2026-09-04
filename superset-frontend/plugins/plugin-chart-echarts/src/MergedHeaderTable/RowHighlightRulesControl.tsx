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
import { getColumnLabel, getTimeFormatter, QueryFormColumn } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { styled, css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import dayjs from 'dayjs';
import {
    DatePicker,
    Icons,
    Input,
    InputNumber,
    Select,
} from '@superset-ui/core/components';
import { RowHighlightRule } from './types';
import {
    getFormatOptionsForColumn,
    getSmartFormatter,
    TypedColumnOption,
} from './headerTreeUtils';

interface DatasourceColumn {
    column_name: string;
    verbose_name?: string | null;
    type_generic?: GenericDataType;
    is_dttm?: boolean;
}

export interface RowHighlightRulesControlProps {
    label?: string;
    description?: string;
    value?: RowHighlightRule[];
    onChange?: (value: RowHighlightRule[]) => void;
    groupby?: QueryFormColumn[];
    datasourceColumns?: DatasourceColumn[] | null;
}

const VALUE_DATE_FORMAT = 'YYYY-MM-DD';

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

const RuleCard = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit}px;
        background: ${theme.colorBgContainer};
        border: 1px solid ${theme.colorBorderSecondary};
        border-left: 3px solid ${theme.colorPrimary};
        border-radius: ${theme.borderRadius}px;
        padding: ${theme.sizeUnit * 2}px;
    `}
`;

// All fields sit on one row, bottom-aligned so labels of differing height
// (e.g. "Format" wrapping) don't push inputs out of line with each other.
const MainRow = styled.div`
    ${({ theme }) => css`
        display: flex;
        align-items: flex-end;
        gap: ${theme.sizeUnit * 2}px;
    `}
`;

const Field = styled.div`
    ${({ theme }) => css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit}px;
        min-width: 0;
        flex: 1;
    `}
`;

const ColorField = styled(Field)`
    flex: 0 0 56px;
`;

const FieldLabel = styled.div`
    ${({ theme }) => css`
        font-size: ${theme.fontSizeXS}px;
        color: ${theme.colorTextTertiary};
    `}
`;

const ColorInput = styled.input`
    ${({ theme }) => css`
        width: 100%;
        height: 32px;
        padding: 2px;
        border: 1px solid ${theme.colorBorder};
        border-radius: ${theme.borderRadius}px;
        cursor: pointer;
        background: transparent;
    `}
`;

const DeleteButton = styled.button`
    ${({ theme }) => css`
        display: flex;
        align-items: center;
        height: 32px;
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

const DEFAULT_BACKGROUND_COLOR = '#ffe0b2';
const DEFAULT_TEXT_COLOR = '#d32f2f';

const PreviewText = styled.div`
    ${({ theme }) => css`
        font-size: ${theme.fontSizeXS}px;
        color: ${theme.colorTextTertiary};
    `}
`;

// Formats the raw "Value equals" string per the picked D3 format, purely as
// a UI preview -- matching itself always compares the raw, unformatted
// string against the row's value (see matchRowHighlightRule).
function formatPreviewValue(
    rawValue: string | undefined,
    format: string | undefined,
    inputType: 'number' | 'date' | 'text',
): string {
    if (!format || !rawValue) return '';
    try {
        if (inputType === 'date') {
            const parsed = dayjs(rawValue);
            return parsed.isValid()
                ? getTimeFormatter(format)(parsed.toDate())
                : '';
        }
        // 'number' columns, and 'text' columns whose value still happens to
        // be numeric-looking (e.g. a Str-typed MAT_ID like "12345") -- the
        // Format field offers number formats for both, matching how
        // Row Header Column Format's own Number format picker behaves.
        const num = Number(rawValue);
        return Number.isNaN(num) ? '' : getSmartFormatter(format)(num);
    } catch {
        return '';
    }
}

export default function RowHighlightRulesControl({
    label,
    description,
    value,
    onChange,
    groupby = [],
    datasourceColumns = [],
}: RowHighlightRulesControlProps) {
    const rules = value || [];
    const columnOptions = groupby.map(column => {
        const columnLabel = getColumnLabel(column);
        return { label: columnLabel, value: columnLabel };
    });
    // Keyed by column_name, matching how getColumnLabel(groupby column)
    // resolves for plain (non-adhoc) columns -- the same convention
    // getFormatOptionsForColumn/RowHeaderColumnFormatControl already rely on.
    const typedColumnOptions: TypedColumnOption[] = (datasourceColumns || []).map(
        column => ({
            label: column.verbose_name || column.column_name,
            value: column.column_name,
            type_generic: column.type_generic,
            is_dttm: column.is_dttm,
        }),
    );
    const columnTypeByName = new Map(
        typedColumnOptions.map(column => [column.value, column]),
    );
    const getColumnInputType = (
        columnName: string | undefined,
    ): 'number' | 'date' | 'text' => {
        const column = columnName ? columnTypeByName.get(columnName) : undefined;
        if (!column) return 'text';
        if (column.is_dttm || column.type_generic === GenericDataType.Temporal) {
            return 'date';
        }
        if (column.type_generic === GenericDataType.Numeric) {
            return 'number';
        }
        return 'text';
    };

    const handleChange = (index: number, patch: Partial<RowHighlightRule>) => {
        const next = rules.map((rule, i) =>
            i === index ? { ...rule, ...patch } : rule,
        );
        onChange?.(next);
    };

    const handleAdd = () => {
        onChange?.([
            ...rules,
            {
                column: columnOptions[0]?.value,
                value: '',
                backgroundColor: DEFAULT_BACKGROUND_COLOR,
                textColor: DEFAULT_TEXT_COLOR,
            },
        ]);
    };

    const handleDelete = (index: number) => {
        onChange?.(rules.filter((_rule, i) => i !== index));
    };

    return (
        <Wrapper>
            {label && <HeaderLabel>{label}</HeaderLabel>}
            {description && <HeaderDescription>{description}</HeaderDescription>}
            {columnOptions.length === 0 ? (
                <EmptyText>
                    {t('Select one or more Row Header Columns above first.')}
                </EmptyText>
            ) : (
                rules.map((rule, index) => {
                    const inputType = getColumnInputType(rule.column);
                    const { options: formatOptions, docs: formatDocs } =
                        getFormatOptionsForColumn(rule.column, typedColumnOptions);
                    const preview = formatPreviewValue(
                        rule.value,
                        rule.format,
                        inputType,
                    );
                    return (
                        // eslint-disable-next-line react/no-array-index-key
                        <RuleCard key={index}>
                            <MainRow>
                                <Field>
                                    <FieldLabel>{t('Column')}</FieldLabel>
                                    <Select
                                        ariaLabel={t('Column')}
                                        options={columnOptions}
                                        value={rule.column}
                                        onChange={selected =>
                                            handleChange(index, {
                                                column:
                                                    (selected as string) || undefined,
                                            })
                                        }
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel>{t('Value equals')}</FieldLabel>
                                    {inputType === 'number' && (
                                        <InputNumber
                                            aria-label={t('Value equals')}
                                            placeholder={t('e.g. 42')}
                                            value={
                                                rule.value === undefined ||
                                                rule.value === ''
                                                    ? undefined
                                                    : Number(rule.value)
                                            }
                                            onChange={selected =>
                                                handleChange(index, {
                                                    value:
                                                        selected === null ||
                                                        selected === undefined
                                                            ? ''
                                                            : String(selected),
                                                })
                                            }
                                            style={{ width: '100%' }}
                                        />
                                    )}
                                    {inputType === 'date' && (
                                        <DatePicker
                                            aria-label={t('Value equals')}
                                            value={
                                                rule.value
                                                    ? dayjs(rule.value)
                                                    : undefined
                                            }
                                            format={VALUE_DATE_FORMAT}
                                            onChange={selected =>
                                                handleChange(index, {
                                                    value: selected
                                                        ? selected.format(
                                                              VALUE_DATE_FORMAT,
                                                          )
                                                        : '',
                                                })
                                            }
                                            style={{ width: '100%' }}
                                        />
                                    )}
                                    {inputType === 'text' && (
                                        <Input
                                            aria-label={t('Value equals')}
                                            placeholder={t('e.g. Rate Bin 2')}
                                            value={rule.value || ''}
                                            onChange={(
                                                e: ChangeEvent<HTMLInputElement>,
                                            ) =>
                                                handleChange(index, {
                                                    value: e.target.value,
                                                })
                                            }
                                        />
                                    )}
                                </Field>
                                <Field title={formatDocs}>
                                    <FieldLabel>{t('Format')}</FieldLabel>
                                    <Select
                                        ariaLabel={t('Format')}
                                        options={formatOptions}
                                        value={rule.format}
                                        onChange={selected =>
                                            handleChange(index, {
                                                format:
                                                    (selected as string) || undefined,
                                            })
                                        }
                                        placeholder={t('Format')}
                                        allowNewOptions
                                        allowClear
                                    />
                                </Field>
                                <ColorField>
                                    <FieldLabel>{t('Background')}</FieldLabel>
                                    <ColorInput
                                        type="color"
                                        aria-label={t('Background color')}
                                        value={
                                            rule.backgroundColor ||
                                            DEFAULT_BACKGROUND_COLOR
                                        }
                                        onChange={(
                                            e: ChangeEvent<HTMLInputElement>,
                                        ) =>
                                            handleChange(index, {
                                                backgroundColor: e.target.value,
                                            })
                                        }
                                    />
                                </ColorField>
                                <ColorField>
                                    <FieldLabel>{t('Text')}</FieldLabel>
                                    <ColorInput
                                        type="color"
                                        aria-label={t('Text color')}
                                        value={rule.textColor || DEFAULT_TEXT_COLOR}
                                        onChange={(
                                            e: ChangeEvent<HTMLInputElement>,
                                        ) =>
                                            handleChange(index, {
                                                textColor: e.target.value,
                                            })
                                        }
                                    />
                                </ColorField>
                                <DeleteButton
                                    type="button"
                                    aria-label={t('Delete rule')}
                                    onClick={() => handleDelete(index)}
                                >
                                    <Icons.DeleteOutlined iconSize="s" />
                                </DeleteButton>
                            </MainRow>
                            {preview && (
                                <PreviewText>
                                    {t('Preview')}: {preview}
                                </PreviewText>
                            )}
                        </RuleCard>
                    );
                })
            )}
            <DashedAddButton type="button" onClick={handleAdd}>
                <Icons.PlusOutlined iconSize="xs" />
                {t('Add row highlight rule')}
            </DashedAddButton>
        </Wrapper>
    );
}
