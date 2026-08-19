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
import { getMetricLabel, QueryFormMetric } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { InputNumber } from '@superset-ui/core/components';
import { MetricColumnWidths } from '../types';

export interface MetricColumnWidthControlProps {
  label?: string;
  description?: string;
  value?: MetricColumnWidths;
  onChange?: (value: MetricColumnWidths) => void;
  metrics?: QueryFormMetric[];
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

const MetricCard = styled.div`
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

const MetricLabel = styled.div`
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

export default function MetricColumnWidthControl({
  label,
  description,
  value,
  onChange,
  metrics = [],
}: MetricColumnWidthControlProps) {
  const config = value || {};
  const metricLabels = metrics.map(getMetricLabel);

  const handleChange = (metric: string, width: number | undefined) => {
    const next = { ...config };
    if (width === undefined) {
      delete next[metric];
    } else {
      next[metric] = width;
    }
    onChange?.(next);
  };

  return (
    <Wrapper>
      {label && <div>{label}</div>}
      {description && <EmptyText>{description}</EmptyText>}
      {metricLabels.length === 0 ? (
        <EmptyText>{t('Select one or more Metrics above first.')}</EmptyText>
      ) : (
        metricLabels.map(metric => (
          <MetricCard key={metric}>
            <MetricLabel title={metric}>{metric}</MetricLabel>
            <InputNumber
              aria-label={t('Width (px)')}
              placeholder={t('Width (px)')}
              min={1}
              value={config[metric]}
              onChange={selected =>
                handleChange(metric, (selected as number) ?? undefined)
              }
              style={{ width: 110 }}
            />
          </MetricCard>
        ))
      )}
    </Wrapper>
  );
}
