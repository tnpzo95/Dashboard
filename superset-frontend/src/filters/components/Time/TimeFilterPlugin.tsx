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
import { NO_TIME_RANGE } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { DatePicker } from '@superset-ui/core/components';
import { DAYJS_FORMAT } from 'src/explore/components/controls/DateFilterControl/utils';
import { PluginFilterTimeProps } from './types';
import { FilterPluginStyle } from '../common';

// Superset time_range format: "since : until", either side may be empty
// (open-ended). Matches the backend separator in utils/date_parser.py.
const SEPARATOR = ' : ';
const DISPLAY_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DATE_ONLY_FORMAT = 'YYYY-MM-DD';

const TimeFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: visible;

  & .ant-tag {
    margin-right: 0;
  }
`;

const RangeFieldsContainer = styled.div<{
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

function timeRangeToValues(
  timeRange: string | undefined,
): [Dayjs | null, Dayjs | null] {
  if (!timeRange || timeRange === NO_TIME_RANGE) {
    return [null, null];
  }
  const parts = timeRange.split(SEPARATOR);
  if (parts.length !== 2) {
    return [null, null];
  }
  const [sincePart, untilPart] = parts.map(part => part.trim());
  const since = sincePart ? dayjs(sincePart) : null;
  const until = untilPart ? dayjs(untilPart) : null;
  return [
    since && since.isValid() ? since : null,
    until && until.isValid() ? until : null,
  ];
}

function valuesToTimeRange(
  since: Dayjs | null,
  until: Dayjs | null,
): string | undefined {
  if (!since && !until) {
    return undefined;
  }
  const sinceStr = since ? since.format(DAYJS_FORMAT) : '';
  const untilStr = until ? until.format(DAYJS_FORMAT) : '';
  return `${sinceStr}${SEPARATOR}${untilStr}`;
}

export default function TimeFilterPlugin(props: PluginFilterTimeProps) {
  const {
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    height,
    filterState,
    inputRef,
    formData,
  } = props;
  const {
    defaultFillterTimeNow,
    defaultFillterWeekNow,
    defaultFillterMonthNow,
    defaultFillterShiftNow,
    defaultFillterDaysAgo,
    defaultFillterDaysAgoNumber,
    defaultFillterShiftDaysAgo,
    defaultFillterShiftDaysAgoNumber,
    enableMaxDaysRange,
    maxDaysRange,
    enableHourFilter,
    width: customWidth,
  } = formData;
  const effectiveWidth = customWidth && customWidth > 0 ? customWidth : width;
  const showTime = enableHourFilter !== false;
  const displayFormat = showTime ? DISPLAY_FORMAT : DATE_ONLY_FORMAT;

  const [since, until] = timeRangeToValues(
    filterState.value as string | undefined,
  );

  const handleTimeRangeChange = useCallback(
    (timeRange?: string): void => {
      const isSet = timeRange && timeRange !== NO_TIME_RANGE;
      setDataMask({
        extraFormData: isSet
          ? {
            time_range: timeRange,
          }
          : {},
        filterState: {
          value: isSet ? timeRange : undefined,
        },
      });
    },
    [setDataMask],
  );

  const handleChange = useCallback(
    (nextSince: Dayjs | null, nextUntil: Dayjs | null) => {
      const normalizedSince =
        nextSince && !showTime ? nextSince.startOf('day') : nextSince;
      const normalizedUntil =
        nextUntil && !showTime ? nextUntil.endOf('day') : nextUntil;
      handleTimeRangeChange(
        valuesToTimeRange(normalizedSince, normalizedUntil),
      );
    },
    [handleTimeRangeChange, showTime],
  );

  // Disable dates outside the allowed range on the End picker
  const disabledEndDate = useMemo(
    () => (current: Dayjs) => {
      if (!current) return false;
      // Always disable dates before Start Date
      if (since && current.isBefore(since, 'day')) return true;
      // If max days range is enabled, also disable dates beyond the limit
      if (enableMaxDaysRange && maxDaysRange && maxDaysRange > 0 && since) {
        const maxEnd = since.add(maxDaysRange, 'day');
        if (current.isAfter(maxEnd, 'day')) return true;
      }
      return false;
    },
    [enableMaxDaysRange, maxDaysRange, since],
  );

  // Disable dates outside the allowed range on the Start picker
  const disabledStartDate = useMemo(
    () => (current: Dayjs) => {
      if (!current) return false;
      // Always disable dates after End Date
      if (until && current.isAfter(until, 'day')) return true;
      // If max days range is enabled, also disable dates beyond the limit
      if (enableMaxDaysRange && maxDaysRange && maxDaysRange > 0 && until) {
        const minStart = until.subtract(maxDaysRange, 'day');
        if (current.isBefore(minStart, 'day')) return true;
      }
      return false;
    },
    [enableMaxDaysRange, maxDaysRange, until],
  );

  // Only apply the "Default to current ..." value once, on initial mount.
  // Otherwise, clearing the filter later (e.g. via "Clear all filters")
  // would immediately be overwritten by this same default again.
  const isFirstRun = useRef(true);
  const prevDefaultConfig = useRef('');
  const justAppliedDefault = useRef(false);

  useEffect(() => {
    const hasAnyDefault =
      !!defaultFillterTimeNow ||
      !!defaultFillterWeekNow ||
      !!defaultFillterMonthNow ||
      !!defaultFillterShiftNow ||
      !!defaultFillterDaysAgo ||
      !!defaultFillterShiftDaysAgo;

    const currentDefaultConfig = [
      defaultFillterTimeNow,
      defaultFillterWeekNow,
      defaultFillterMonthNow,
      defaultFillterShiftNow,
      defaultFillterDaysAgo,
      defaultFillterDaysAgoNumber,
      defaultFillterShiftDaysAgo,
      defaultFillterShiftDaysAgoNumber,
    ].join('|');
    const configChanged = prevDefaultConfig.current !== currentDefaultConfig;
    prevDefaultConfig.current = currentDefaultConfig;

    if (
      hasAnyDefault &&
      (isFirstRun.current || configChanged) &&
      // For shift/day/week/month defaults, always recalculate on load
      // because the date changes every day. Only skip if user already
      // has a non-default value AND no default checkbox is ticked.
      (!filterState.value || hasAnyDefault)
    ) {
      const now = dayjs();
      let start: Dayjs;
      let end: Dayjs;
      if (defaultFillterTimeNow) {
        start = now.startOf('day');
        end = now.endOf('day');
      } else if (defaultFillterWeekNow) {
        const dayOfWeek = now.day(); // 0 = Sunday ... 6 = Saturday
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        start = now.add(diffToMonday, 'day').startOf('day');
        end = start.add(6, 'day').endOf('day');
      } else if (defaultFillterShiftNow) {
        // Work shift: 08:00 today → 08:00 tomorrow
        start = now.startOf('day').add(8, 'hour');
        end = now.startOf('day').add(1, 'day').add(8, 'hour');
      } else if (defaultFillterDaysAgo) {
        const days = defaultFillterDaysAgoNumber ?? 3;
        start = now.subtract(days, 'day').startOf('day');
        end = now.endOf('day');
      } else if (defaultFillterShiftDaysAgo) {
        const days = defaultFillterShiftDaysAgoNumber ?? 3;
        start = now.subtract(days, 'day').startOf('day').add(8, 'hour');
        end = now.startOf('day').add(8, 'hour');
      } else {
        start = now.startOf('month');
        end = now.endOf('month');
      }
      handleTimeRangeChange(
        `${start.format(DAYJS_FORMAT)}${SEPARATOR}${end.format(DAYJS_FORMAT)}`,
      );
      justAppliedDefault.current = true;
    } else if (isFirstRun.current) {
      handleTimeRangeChange(filterState.value);
    }
    isFirstRun.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    defaultFillterTimeNow,
    defaultFillterWeekNow,
    defaultFillterMonthNow,
    defaultFillterShiftNow,
    defaultFillterDaysAgo,
    defaultFillterDaysAgoNumber,
    defaultFillterShiftDaysAgo,
    defaultFillterShiftDaysAgoNumber,
  ]);

  // Sync when filterState.value changes from outside (e.g. "Clear all filters")
  useEffect(() => {
    // Skip if the default was just applied by the config-change effect,
    // otherwise this would overwrite the newly applied default with the
    // stale filterState.value (which hasn't been updated yet).
    if (justAppliedDefault.current) {
      justAppliedDefault.current = false;
      return;
    }
    if (!isFirstRun.current) {
      handleTimeRangeChange(filterState.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState.value]);

  return props.formData?.inView ? (
    <TimeFilterStyles width={effectiveWidth} height={height}>
      <RangeFieldsContainer
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        tabIndex={-1}
      >
        <StyledDatePicker
          showTime={showTime}
          format={displayFormat}
          value={since ?? undefined}
          placeholder={t('Start date/time')}
          disabledDate={disabledStartDate}
          onChange={date => handleChange(date, until)}
          onOpenChange={open => {
            if (open) {
              setFilterActive(true);
            } else {
              setFilterActive(false);
              unsetHoveredFilter();
              unsetFocusedFilter();
            }
          }}
          allowClear
        />
        <RangeSeparator>~</RangeSeparator>
        <StyledDatePicker
          showTime={showTime}
          format={displayFormat}
          value={until ?? undefined}
          placeholder={t('End date/time')}
          disabledDate={disabledEndDate}
          onChange={date => handleChange(since, date)}
          onOpenChange={open => {
            if (open) {
              setFilterActive(true);
            } else {
              setFilterActive(false);
              unsetHoveredFilter();
              unsetFocusedFilter();
            }
          }}
          allowClear
        />
      </RangeFieldsContainer>
    </TimeFilterStyles>
  ) : null;
}
