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
import { ensureIsArray, getColumnLabel } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { useCallback, useEffect, useRef } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { DatePicker } from '@superset-ui/core/components';
import { DAYJS_FORMAT } from 'src/explore/components/controls/DateFilterControl/utils';
import { getDateTimeExtraFormData } from '../../utils';
import { PluginFilterDateTimeProps } from './types';
import { FilterPluginStyle } from '../common';

const DISPLAY_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DATE_ONLY_FORMAT = 'YYYY-MM-DD';

const DateTimeFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: visible;

  & .ant-tag {
    margin-right: 0;
  }
`;

const FieldContainer = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
  display: flex;
  align-items: center;
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

function valueToDayjs(value: string | undefined): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

export default function DateTimeFilterPlugin(
  props: PluginFilterDateTimeProps,
) {
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
    groupby,
    defaultDateTimeNow,
    defaultDateTimeDaysAgo,
    defaultDateTimeDaysAgoNumber,
    enableHourFilter,
    width: customWidth,
  } = formData;
  const effectiveWidth = customWidth && customWidth > 0 ? customWidth : width;
  const showTime = enableHourFilter !== false;
  const displayFormat = showTime ? DISPLAY_FORMAT : DATE_ONLY_FORMAT;

  const [col = ''] = ensureIsArray(groupby).map(getColumnLabel);

  const value = valueToDayjs(filterState.value as string | undefined);

  const handleDateTimeChange = useCallback(
    (nextValue?: string): void => {
      setDataMask({
        extraFormData: nextValue
          ? getDateTimeExtraFormData(col, nextValue)
          : {},
        filterState: {
          value: nextValue,
        },
      });
    },
    [setDataMask, col],
  );

  const handleChange = useCallback(
    (next: Dayjs | null) => {
      const normalized = next && !showTime ? next.startOf('day') : next;
      handleDateTimeChange(
        normalized ? normalized.format(DAYJS_FORMAT) : undefined,
      );
    },
    [handleDateTimeChange, showTime],
  );

  // Only apply the "Default to ..." value once, on initial mount. Otherwise
  // clearing the filter later (e.g. via "Clear all filters") would
  // immediately be overwritten by this same default again.
  const isFirstRun = useRef(true);
  const prevDefaultConfig = useRef('');
  const justAppliedDefault = useRef(false);

  useEffect(() => {
    const hasAnyDefault = !!defaultDateTimeNow || !!defaultDateTimeDaysAgo;

    const currentDefaultConfig = [
      defaultDateTimeNow,
      defaultDateTimeDaysAgo,
      defaultDateTimeDaysAgoNumber,
    ].join('|');
    const configChanged = prevDefaultConfig.current !== currentDefaultConfig;
    prevDefaultConfig.current = currentDefaultConfig;

    if (
      hasAnyDefault &&
      (isFirstRun.current || configChanged) &&
      (!filterState.value || hasAnyDefault)
    ) {
      const now = dayjs();
      let next = defaultDateTimeDaysAgo
        ? now.subtract(defaultDateTimeDaysAgoNumber ?? 3, 'day')
        : now;
      if (!showTime) {
        next = next.startOf('day');
      }
      handleDateTimeChange(next.format(DAYJS_FORMAT));
      justAppliedDefault.current = true;
    } else if (isFirstRun.current) {
      handleDateTimeChange(filterState.value as string | undefined);
    }
    isFirstRun.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    defaultDateTimeNow,
    defaultDateTimeDaysAgo,
    defaultDateTimeDaysAgoNumber,
    showTime,
  ]);

  // Sync when filterState.value changes from outside (e.g. "Clear all filters")
  useEffect(() => {
    if (justAppliedDefault.current) {
      justAppliedDefault.current = false;
      return;
    }
    if (!isFirstRun.current) {
      handleDateTimeChange(filterState.value as string | undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState.value]);

  return props.formData?.inView ? (
    <DateTimeFilterStyles width={effectiveWidth} height={height}>
      <FieldContainer
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
          value={value ?? undefined}
          placeholder={t('Select date/time')}
          onChange={handleChange}
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
      </FieldContainer>
    </DateTimeFilterStyles>
  ) : null;
}
