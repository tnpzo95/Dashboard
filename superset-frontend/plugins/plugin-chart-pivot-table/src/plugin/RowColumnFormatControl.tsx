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
import { InputNumber, Switch } from '@superset-ui/core/components';
import { RowColumnFormat, RowColumnFormats } from '../types';

export interface RowColumnFormatControlProps {
  label?: string;
  description?: string;
  value?: RowColumnFormats;
  onChange?: (value: RowColumnFormats) => void;
  groupbyRows?: QueryFormColumn[];
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

const SwitchField = styled.label`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    cursor: pointer;
    flex-shrink: 0;
  `}
`;

export default function RowColumnFormatControl({
  label,
  description,
  value,
  onChange,
  groupbyRows = [],
}: RowColumnFormatControlProps) {
  const config = value || {};
  const columns = groupbyRows.map(column => getColumnLabel(column));

  const handleChange = (column: string, patch: Partial<RowColumnFormat>) => {
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
        <EmptyText>{t('Select one or more Rows columns above first.')}</EmptyText>
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
            <SwitchField>
              <Switch
                checked={Boolean(config[column]?.pinned)}
                onChange={checked => handleChange(column, { pinned: checked })}
              />
              {t('Pin')}
            </SwitchField>
          </ColumnCard>
        ))
      )}
    </Wrapper>
  );
}
