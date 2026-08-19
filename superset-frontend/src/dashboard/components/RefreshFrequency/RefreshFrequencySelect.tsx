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
import { ChangeEvent, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Input } from '@superset-ui/core/components';
import { Radio, RadioChangeEvent } from '@superset-ui/core/components/Radio';

// Minimum custom refresh interval in seconds
export const MINIMUM_REFRESH_INTERVAL = 1;
export const REFRESH_EVERY_DAY_AT_08 = -800;
export const REFRESH_EVERY_HOUR_AT_MINUTE_05 = -1005;
const CUSTOM_SECONDS_VALUE = -1;
const CUSTOM_DAILY_TIME_VALUE = -2;
const CUSTOM_HOURLY_MINUTE_VALUE = -3;
const SCHEDULED_DAILY_REFRESH_BASE = 200000;
const SCHEDULED_HOURLY_REFRESH_BASE = 300000;

const StyledRadioGroup = styled(Radio.Group)`
  padding-left: ${({ theme }) => theme.sizeUnit * 2}px;

  .ant-radio-wrapper {
    display: flex;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.sizeUnit * 0.5}px;

    &:last-child {
      margin-bottom: ${({ theme }) => theme.sizeUnit}px;
    }
  }
`;

const CustomContent = styled.div`
  display: flex;
  align-items: center;

  .ant-input {
    width: 80px;
    margin-left: ${({ theme }) => theme.sizeUnit}px;
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const ScheduledContent = styled(CustomContent)`
  .ant-input {
    width: 64px;
  }
`;

// Standard refresh frequency options used across modals
export const REFRESH_FREQUENCY_OPTIONS = [
  { value: 0, label: t("Don't refresh") },
  { value: 10, label: t('10 seconds') },
  { value: 30, label: t('30 seconds') },
  { value: 60, label: t('1 minute') },
  { value: 300, label: t('5 minutes') },
  { value: 1800, label: t('30 minutes') },
  { value: 3600, label: t('1 hour') },
  { value: 21600, label: t('6 hours') },
  { value: 43200, label: t('12 hours') },
  { value: 86400, label: t('24 hours') },
  { value: REFRESH_EVERY_DAY_AT_08, label: t('Every day at 08:00') },
  {
    value: REFRESH_EVERY_HOUR_AT_MINUTE_05,
    label: t('Every hour at minute 05'),
  },
  { value: CUSTOM_SECONDS_VALUE, label: t('Custom') },
];

type ScheduledRefreshConfig =
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'hourly'; minute: number };

const formatTwoDigits = (value: number) => value.toString().padStart(2, '0');

const parseNumberInRange = (
  value: string,
  min: number,
  max: number,
): number | null => {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue < min || parsedValue > max) {
    return null;
  }
  return parsedValue;
};

export const encodeDailyScheduledRefresh = (hour: number, minute: number) =>
  -(SCHEDULED_DAILY_REFRESH_BASE + hour * 100 + minute);

export const encodeHourlyScheduledRefresh = (minute: number) =>
  -(SCHEDULED_HOURLY_REFRESH_BASE + minute);

export const decodeScheduledRefresh = (
  frequency: number,
): ScheduledRefreshConfig | null => {
  if (frequency === REFRESH_EVERY_DAY_AT_08) {
    return { type: 'daily', hour: 8, minute: 0 };
  }

  if (frequency === REFRESH_EVERY_HOUR_AT_MINUTE_05) {
    return { type: 'hourly', minute: 5 };
  }

  if (frequency >= 0) {
    return null;
  }

  const encodedValue = Math.abs(frequency);
  if (
    encodedValue >= SCHEDULED_DAILY_REFRESH_BASE &&
    encodedValue < SCHEDULED_DAILY_REFRESH_BASE + 2400
  ) {
    const timeValue = encodedValue - SCHEDULED_DAILY_REFRESH_BASE;
    const hour = Math.floor(timeValue / 100);
    const minute = timeValue % 100;
    if (hour <= 23 && minute <= 59) {
      return { type: 'daily', hour, minute };
    }
  }

  if (
    encodedValue >= SCHEDULED_HOURLY_REFRESH_BASE &&
    encodedValue < SCHEDULED_HOURLY_REFRESH_BASE + 60
  ) {
    return {
      type: 'hourly',
      minute: encodedValue - SCHEDULED_HOURLY_REFRESH_BASE,
    };
  }

  return null;
};

export const isScheduledRefreshFrequency = (frequency: number) =>
  decodeScheduledRefresh(frequency) !== null;

export const isRefreshEnabled = (frequency: number) =>
  frequency > 0 || isScheduledRefreshFrequency(frequency);

export const getRefreshFrequencyLabel = (frequency: number) => {
  const option = REFRESH_FREQUENCY_OPTIONS.find(
    item => item.value === frequency,
  );
  if (option && option.value !== -1) {
    return option.label;
  }

  const scheduledConfig = decodeScheduledRefresh(frequency);
  if (scheduledConfig?.type === 'daily') {
    return t(
      'Every day at %s:%s',
      formatTwoDigits(scheduledConfig.hour),
      formatTwoDigits(scheduledConfig.minute),
    );
  }

  if (scheduledConfig?.type === 'hourly') {
    return t('Every hour at minute %s', formatTwoDigits(scheduledConfig.minute));
  }

  return t('%s seconds', frequency);
};

export const getNextRefreshDelayMs = (
  frequency: number,
  currentDate = new Date(),
) => {
  if (frequency > 0) {
    return frequency * 1000;
  }

  const scheduledConfig = decodeScheduledRefresh(frequency);
  if (!scheduledConfig) {
    return 0;
  }

  const nextDate = new Date(currentDate);
  if (scheduledConfig.type === 'daily') {
    nextDate.setHours(
      scheduledConfig.hour,
      scheduledConfig.minute,
      0,
      0,
    );
    if (nextDate.getTime() <= currentDate.getTime()) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    return nextDate.getTime() - currentDate.getTime();
  }

  if (scheduledConfig.type === 'hourly') {
    nextDate.setMinutes(scheduledConfig.minute, 0, 0);
    if (nextDate.getTime() <= currentDate.getTime()) {
      nextDate.setHours(nextDate.getHours() + 1);
    }
    return nextDate.getTime() - currentDate.getTime();
  }

  return 0;
};

const isPresetValue = (frequency: number) =>
  REFRESH_FREQUENCY_OPTIONS.some(
    option => option.value === frequency && option.value !== CUSTOM_SECONDS_VALUE,
  );

const getCustomValue = (frequency: number) =>
  !isPresetValue(frequency) && frequency > 0 ? frequency.toString() : '';

const getRadioSelection = (frequency: number) => {
  if (isPresetValue(frequency)) {
    return frequency;
  }

  const scheduledConfig = decodeScheduledRefresh(frequency);
  if (scheduledConfig?.type === 'daily') {
    return CUSTOM_DAILY_TIME_VALUE;
  }

  if (scheduledConfig?.type === 'hourly') {
    return CUSTOM_HOURLY_MINUTE_VALUE;
  }

  return CUSTOM_SECONDS_VALUE;
};

const normalizeRefreshLimitSeconds = (
  refreshLimit?: number,
): number | undefined => {
  if (!refreshLimit || refreshLimit <= 0) {
    return undefined;
  }

  if (refreshLimit >= 1000 && refreshLimit % 1000 === 0) {
    return refreshLimit / 1000;
  }

  return refreshLimit;
};

interface RefreshFrequencySelectProps {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Shared refresh frequency select component
 * Used in both PropertiesModal and RefreshIntervalModal
 */
export const RefreshFrequencySelect = ({
  value,
  onChange,
}: RefreshFrequencySelectProps) => {
  // Separate radio selection state from value state
  const [radioSelection, setRadioSelection] = useState(() =>
    getRadioSelection(value),
  );
  const [customValue, setCustomValue] = useState(() => getCustomValue(value));
  const scheduledConfig = decodeScheduledRefresh(value);
  const [customDailyHour, setCustomDailyHour] = useState(() =>
    scheduledConfig?.type === 'daily'
      ? scheduledConfig.hour.toString()
      : '12',
  );
  const [customDailyMinute, setCustomDailyMinute] = useState(() =>
    scheduledConfig?.type === 'daily'
      ? formatTwoDigits(scheduledConfig.minute)
      : '00',
  );
  const [customHourlyMinute, setCustomHourlyMinute] = useState(() =>
    scheduledConfig?.type === 'hourly'
      ? formatTwoDigits(scheduledConfig.minute)
      : '05',
  );

  useEffect(() => {
    const selection = getRadioSelection(value);
    const nextScheduledConfig = decodeScheduledRefresh(value);
    setRadioSelection(selection);
    setCustomValue(selection === CUSTOM_SECONDS_VALUE ? getCustomValue(value) : '');
    if (nextScheduledConfig?.type === 'daily') {
      setCustomDailyHour(nextScheduledConfig.hour.toString());
      setCustomDailyMinute(formatTwoDigits(nextScheduledConfig.minute));
    }
    if (nextScheduledConfig?.type === 'hourly') {
      setCustomHourlyMinute(formatTwoDigits(nextScheduledConfig.minute));
    }
  }, [value]);

  const getDailyScheduledValue = (
    hourValue = customDailyHour,
    minuteValue = customDailyMinute,
  ) => {
    const hour = parseNumberInRange(hourValue, 0, 23);
    const minute = parseNumberInRange(minuteValue, 0, 59);
    if (hour === null || minute === null) {
      return null;
    }
    return encodeDailyScheduledRefresh(hour, minute);
  };

  const getHourlyScheduledValue = (minuteValue = customHourlyMinute) => {
    const minute = parseNumberInRange(minuteValue, 0, 59);
    return minute === null ? null : encodeHourlyScheduledRefresh(minute);
  };

  const handleRadioChange = (event: RadioChangeEvent) => {
    const selectedValue = Number(event.target.value);
    setRadioSelection(selectedValue);

    if (selectedValue === CUSTOM_SECONDS_VALUE) {
      // Custom selected - use current custom value or minimum
      const numValue = parseInt(customValue, 10) || MINIMUM_REFRESH_INTERVAL;
      onChange(numValue);
      if (!customValue) {
        setCustomValue(MINIMUM_REFRESH_INTERVAL.toString());
      }
    } else if (selectedValue === CUSTOM_DAILY_TIME_VALUE) {
      const scheduledValue = getDailyScheduledValue();
      if (scheduledValue !== null) {
        onChange(scheduledValue);
      }
    } else if (selectedValue === CUSTOM_HOURLY_MINUTE_VALUE) {
      const scheduledValue = getHourlyScheduledValue();
      if (scheduledValue !== null) {
        onChange(scheduledValue);
      }
    } else {
      onChange(selectedValue);
    }
  };

  const handleCustomInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setCustomValue(inputValue);

    const numValue = parseInt(inputValue, 10);
    if (numValue >= MINIMUM_REFRESH_INTERVAL) {
      onChange(numValue);
    }
  };

  const handleDailyHourChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setCustomDailyHour(nextValue);
    const scheduledValue = getDailyScheduledValue(nextValue, customDailyMinute);
    if (
      radioSelection === CUSTOM_DAILY_TIME_VALUE &&
      scheduledValue !== null
    ) {
      onChange(scheduledValue);
    }
  };

  const handleDailyMinuteChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setCustomDailyMinute(nextValue);
    const scheduledValue = getDailyScheduledValue(customDailyHour, nextValue);
    if (
      radioSelection === CUSTOM_DAILY_TIME_VALUE &&
      scheduledValue !== null
    ) {
      onChange(scheduledValue);
    }
  };

  const handleHourlyMinuteChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setCustomHourlyMinute(nextValue);
    const scheduledValue = getHourlyScheduledValue(nextValue);
    if (
      radioSelection === CUSTOM_HOURLY_MINUTE_VALUE &&
      scheduledValue !== null
    ) {
      onChange(scheduledValue);
    }
  };

  return (
    <StyledRadioGroup value={radioSelection} onChange={handleRadioChange}>
      {REFRESH_FREQUENCY_OPTIONS.slice(0, -1).map(option => (
        <Radio key={option.value} value={option.value}>
          {option.label}
        </Radio>
      ))}

      <Radio value={CUSTOM_DAILY_TIME_VALUE}>
        <ScheduledContent>
          {t('Every day at')}
          <Input
            type="number"
            min={0}
            max={23}
            value={customDailyHour}
            onChange={handleDailyHourChange}
            placeholder="HH"
            disabled={radioSelection !== CUSTOM_DAILY_TIME_VALUE}
            onClick={e => e.stopPropagation()}
          />
          <span>:</span>
          <Input
            type="number"
            min={0}
            max={59}
            value={customDailyMinute}
            onChange={handleDailyMinuteChange}
            placeholder="MM"
            disabled={radioSelection !== CUSTOM_DAILY_TIME_VALUE}
            onClick={e => e.stopPropagation()}
          />
        </ScheduledContent>
      </Radio>

      <Radio value={CUSTOM_HOURLY_MINUTE_VALUE}>
        <ScheduledContent>
          {t('Every hour at minute')}
          <Input
            type="number"
            min={0}
            max={59}
            value={customHourlyMinute}
            onChange={handleHourlyMinuteChange}
            placeholder="MM"
            disabled={radioSelection !== CUSTOM_HOURLY_MINUTE_VALUE}
            onClick={e => e.stopPropagation()}
          />
        </ScheduledContent>
      </Radio>

      <Radio value={CUSTOM_SECONDS_VALUE}>
        <CustomContent>
          {t('Custom')}
          <Input
            type="number"
            min={MINIMUM_REFRESH_INTERVAL}
            value={customValue}
            onChange={handleCustomInputChange}
            placeholder={`${MINIMUM_REFRESH_INTERVAL}+`}
            disabled={radioSelection !== -1}
            onClick={e => e.stopPropagation()}
          />
          <span>{t('seconds')}</span>
        </CustomContent>
      </Radio>
    </StyledRadioGroup>
  );
};

/**
 * Validates refresh frequency against minimum limit
 */
export const validateRefreshFrequency = (
  frequency: number,
  refreshLimit?: number,
): string[] => {
  const errors = [];
  const normalizedLimit = normalizeRefreshLimitSeconds(refreshLimit);
  if (normalizedLimit && frequency > 0 && frequency < normalizedLimit) {
    errors.push(
      t('Refresh frequency must be at least %s seconds', normalizedLimit),
    );
  }
  return errors;
};

/**
 * Generates warning message for low refresh frequencies
 */
export const getRefreshWarningMessage = (
  frequency: number,
  refreshLimit?: number,
  refreshWarning?: string,
): string | null => {
  const normalizedLimit = normalizeRefreshLimitSeconds(refreshLimit);
  if (
    frequency > 0 &&
    normalizedLimit &&
    frequency < normalizedLimit &&
    refreshWarning
  ) {
    return refreshWarning;
  }
  return null;
};
