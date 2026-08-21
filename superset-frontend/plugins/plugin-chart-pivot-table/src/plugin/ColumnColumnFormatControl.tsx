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
import { getColumnLabel, QueryFormColumn } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { InputNumber, Select } from '@superset-ui/core/components';
import { ColumnColumnFormat, ColumnColumnFormats } from '../types';

export interface ColumnColumnFormatControlProps {
  label?: string;
  description?: string;
  value?: ColumnColumnFormats;
  onChange?: (value: ColumnColumnFormats) => void;
  groupbyColumns?: QueryFormColumn[];
}

const Wrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
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
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorderSecondary};
    border-left: 3px solid ${theme.colorPrimary};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
  `}
`;

const ColumnLabel = styled.div`
  ${({ theme }) => css`
    flex: 1;
    min-width: 0;
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

const alignOptions = [
  { value: 'left', label: t('Left') },
  { value: 'center', label: t('Center') },
  { value: 'right', label: t('Right') },
];

export default function ColumnColumnFormatControl({
  label,
  description,
  value,
  onChange,
  groupbyColumns = [],
}: ColumnColumnFormatControlProps) {
  const config = value || {};
  const columns = groupbyColumns.map(column => getColumnLabel(column));

  const handleChange = (column: string, patch: Partial<ColumnColumnFormat>) => {
    onChange?.({
      ...config,
      [column]: { ...config[column], ...patch },
    });
  };

  return (
    <Wrapper>
      {label && <div>{label}</div>}
      {description && <EmptyText>{description}</EmptyText>}
      {columns.length === 0 ? (
        <EmptyText>
          {t('Select one or more Columns columns above first.')}
        </EmptyText>
      ) : (
        columns.map(column => (
          <ColumnCard key={column}>
            <ColumnLabel title={column}>{column}</ColumnLabel>
            <InputNumber
              aria-label={t('Width (px)')}
              placeholder={t('Width (px)')}
              min={1}
              value={config[column]?.width}
              onChange={selected =>
                handleChange(column, {
                  width: (selected as number) ?? undefined,
                })
              }
              style={{ width: 110 }}
            />
            <Select
              ariaLabel={t('Text align')}
              options={alignOptions}
              value={config[column]?.align || 'left'}
              onChange={selected =>
                handleChange(column, {
                  align: selected as ColumnColumnFormat['align'],
                })
              }
              css={{ width: 110 }}
            />
          </ColumnCard>
        ))
      )}
    </Wrapper>
  );
}
