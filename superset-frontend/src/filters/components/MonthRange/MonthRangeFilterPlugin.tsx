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
import { useCallback, useEffect, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import dayjs, { Dayjs } from 'dayjs';
import { DatePicker } from '@superset-ui/core/components';
import { FilterPluginStyle } from '../common';
import { PluginFilterMonthRangeProps } from './types';

const MonthRangeStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: visible;
`;

const MonthRangeFieldsContainer = styled.div<{
    validateStatus?: 'error' | 'warning' | 'info';
}>`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  max-width: 100%;
  width: 100%;

  & > .ant-picker,
  & > .ant-picker:hover {
    ${({ validateStatus, theme }) => {
        if (!validateStatus) return '';
        switch (validateStatus) {
            case 'error':
                return `border-color: ${theme.colorError}`;
            case 'warning':
                return `border-color: ${theme.colorWarning}`;
            case 'info':
                return `border-color: ${theme.colorInfo}`;
            default:
                return `border-color: ${theme.colorError}`;
        }
    }}
  }

  &:focus > .ant-picker {
    border-color: ${({ theme }) => theme.colorPrimary};
    box-shadow: ${({ theme }) => `0 0 0 2px ${theme.controlOutline}`};
    outline: 0;
  }
`;

const StyledDatePicker = styled(DatePicker)`
  min-width: 0;
  flex: 1;
`;

const RangeSeparator = styled.span`
  flex-shrink: 0;
  color: ${({ theme }) => theme.colorTextSecondary};
`;

// Superset time_range format: "since : until", either side may be empty
// (open-ended). Matches the backend separator in utils/date_parser.py.
const SEPARATOR = ' : ';

function timeRangeToValues(
    timeRange: string | undefined,
): [Dayjs | null, Dayjs | null] {
    if (!timeRange) return [null, null];
    const parts = timeRange.split(SEPARATOR);
    if (parts.length !== 2) return [null, null];
    const [startPart, endPart] = parts.map(part => part.trim());
    const start = startPart ? dayjs(startPart) : null;
    const end = endPart ? dayjs(endPart) : null;
    return [
        start && start.isValid() ? start : null,
        end && end.isValid() ? end : null,
    ];
}

function valuesToTimeRange(
    start: Dayjs | null,
    end: Dayjs | null,
): string | undefined {
    if (!start && !end) return undefined;
    // Use first day of start month → last day of end month
    const startStr = start ? start.startOf('month').format('YYYY-MM-DD') : '';
    const endStr = end ? end.endOf('month').format('YYYY-MM-DD') : '';
    return `${startStr}${SEPARATOR}${endStr}`;
}

export default function MonthRangeFilterPlugin(
    props: PluginFilterMonthRangeProps,
) {
    const {
        setDataMask,
        setHoveredFilter,
        unsetHoveredFilter,
        setFocusedFilter,
        unsetFocusedFilter,
        filterState,
        inputRef,
        formData,
    } = props;

    const {
        defaultFillterTimeNow,
        defaultFillterMonthsAgo,
        defaultFillterMonthsAgoNumber,
    } = formData;
    const [start, end] = timeRangeToValues(filterState.value as string | undefined);

    const applyTimeRange = useCallback(
        (timeRange?: string) => {
            if (!timeRange) {
                setDataMask({ extraFormData: {}, filterState: { value: undefined } });
                return;
            }
            setDataMask({
                extraFormData: { time_range: timeRange },
                filterState: { value: timeRange },
            });
        },
        [setDataMask],
    );

    const handleChange = useCallback(
        (nextStart: Dayjs | null, nextEnd: Dayjs | null) => {
            applyTimeRange(valuesToTimeRange(nextStart, nextEnd));
        },
        [applyTimeRange],
    );

    const isFirstRun = useRef(true);
    const prevDefaultConfig = useRef('');

    useEffect(() => {
        const hasAnyDefault = !!defaultFillterTimeNow || !!defaultFillterMonthsAgo;

        const currentDefaultConfig = [
            defaultFillterTimeNow,
            defaultFillterMonthsAgo,
            defaultFillterMonthsAgoNumber,
        ].join('|');
        const configChanged = prevDefaultConfig.current !== currentDefaultConfig;
        prevDefaultConfig.current = currentDefaultConfig;

        if (
            hasAnyDefault &&
            (isFirstRun.current || configChanged) &&
            (!filterState.value || hasAnyDefault)
        ) {
            const now = dayjs();
            let startMonth: Dayjs;
            let endMonth: Dayjs;
            if (defaultFillterTimeNow) {
                startMonth = now.startOf('month');
                endMonth = now.endOf('month');
            } else {
                const months = defaultFillterMonthsAgoNumber ?? 3;
                startMonth = now.subtract(months, 'month').startOf('month');
                endMonth = now.endOf('month');
            }
            applyTimeRange(valuesToTimeRange(startMonth, endMonth));
        } else if (isFirstRun.current && (start || end)) {
            applyTimeRange(valuesToTimeRange(start, end));
        }
        isFirstRun.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        defaultFillterTimeNow,
        defaultFillterMonthsAgo,
        defaultFillterMonthsAgoNumber,
    ]);

    return props.formData?.inView ? (
        <MonthRangeStyles width={props.width} height={props.height}>
            <MonthRangeFieldsContainer
                validateStatus={filterState.validateStatus}
            >
                <StyledDatePicker
                    ref={inputRef as any}
                    picker="month"
                    format="MM-YYYY"
                    value={start ?? undefined}
                    onChange={date => handleChange(date, end)}
                    placeholder={t('Start month')}
                    onFocus={setFocusedFilter}
                    onBlur={unsetFocusedFilter}
                    onMouseEnter={setHoveredFilter}
                    onMouseLeave={unsetHoveredFilter}
                    allowClear
                />
                <RangeSeparator>~</RangeSeparator>
                <StyledDatePicker
                    picker="month"
                    format="MM-YYYY"
                    value={end ?? undefined}
                    onChange={date => handleChange(start, date)}
                    placeholder={t('End month')}
                    onFocus={setFocusedFilter}
                    onBlur={unsetFocusedFilter}
                    onMouseEnter={setHoveredFilter}
                    onMouseLeave={unsetHoveredFilter}
                    allowClear
                />
            </MonthRangeFieldsContainer>
        </MonthRangeStyles>
    ) : null;
}
