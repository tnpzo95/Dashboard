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
import { ReactNode, useState, useEffect } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  NO_TIME_RANGE,
  useCSSTextTruncation,
  fetchTimeRange,
} from '@superset-ui/core';
import { extendedDayjs, type Dayjs } from '@superset-ui/core/utils/dates';
import {
  css,
  styled,
  useTheme,
  SupersetTheme,
} from '@apache-superset/core/theme';
import {
  Button,
  Constants,
  Divider,
  Tooltip,
  RangePicker,
  type RangePickerProps,
} from '@superset-ui/core/components';
import ControlHeader from 'src/explore/components/ControlHeader';
import { Icons } from '@superset-ui/core/components/Icons';
import { useDebouncedEffect } from 'src/explore/exploreUtils';
import { noOp } from 'src/utils/common';
import ControlPopover from '../ControlPopover/ControlPopover';

import { DateFilterControlProps } from './types';
import { DateFilterTestKey, DAYJS_FORMAT, useDefaultTimeFilter } from './utils';
import { DateLabel } from './components';

const TIME_RANGE_DISPLAY_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const TIME_RANGE_SEPARATOR = ' : ';
type RangePickerValue = Parameters<
  NonNullable<RangePickerProps['onCalendarChange']>
>[0];

const disabledDate: RangePickerProps['disabledDate'] = () => false;
const disabledRangeTime: RangePickerProps['disabledTime'] = () => ({});

const parseDateTime = (dateTime: string): Dayjs => {
  const parsedDateTime = extendedDayjs(dateTime, DAYJS_FORMAT, true);
  if (parsedDateTime.isValid()) {
    return parsedDateTime;
  }
  const displayParsedDateTime = extendedDayjs(
    dateTime,
    TIME_RANGE_DISPLAY_FORMAT,
    true,
  );
  return displayParsedDateTime.isValid()
    ? displayParsedDateTime
    : extendedDayjs(dateTime).startOf('second');
};

const getRangePickerValue = (timeRange: string): [Dayjs, Dayjs] | null => {
  if (timeRange === NO_TIME_RANGE) {
    return null;
  }
  const [startDate, endDate, ...rest] = timeRange.split(TIME_RANGE_SEPARATOR);
  if (!startDate || !endDate || rest.length) {
    return null;
  }
  const start = parseDateTime(startDate);
  const end = parseDateTime(endDate);
  return start.isValid() && end.isValid() ? [start, end] : null;
};

const buildTimeRange = (range: [Dayjs, Dayjs]) =>
  range
    .map(dateTime => dateTime.format(DAYJS_FORMAT))
    .join(TIME_RANGE_SEPARATOR);

const ContentStyleWrapper = styled.div`
  ${({ theme }) => css`
    .ant-row {
      margin-top: 8px;
    }

    .ant-picker {
      padding: 4px 17px 4px;
      border-radius: 4px;
    }

    .ant-divider-horizontal {
      margin: 16px 0;
    }

    .control-label {
      font-size: ${theme.fontSizeSM}px;
      line-height: 16px;
      margin: 8px 0;
    }

    .section-title {
      font-style: normal;
      font-weight: ${theme.fontWeightStrong};
      font-size: 15px;
      line-height: 24px;
      margin-bottom: 8px;
    }

    .control-anchor-to {
      margin-top: 16px;
    }

    .control-anchor-to-datetime {
      width: 217px;
    }

    .footer {
      text-align: right;
    }
  `}
`;

const IconWrapper = styled.span`
  span {
    margin-right: ${({ theme }) => 2 * theme.sizeUnit}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
  .error {
    color: ${({ theme }) => theme.colorError};
  }
`;

const getTooltipTitle = (
  isLabelTruncated: boolean,
  label: string | undefined,
  range: string | undefined,
) =>
  isLabelTruncated ? (
    <div>
      {label && <strong>{label}</strong>}
      {range && (
        <div
          css={(theme: SupersetTheme) => css`
            margin-top: ${theme.sizeUnit}px;
          `}
        >
          {range}
        </div>
      )}
    </div>
  ) : (
    range || null
  );

export default function DateFilterLabel(props: DateFilterControlProps) {
  const {
    name,
    onChange,
    onOpenPopover = noOp,
    onClosePopover = noOp,
    isOverflowingFilterBar = false,
  } = props;
  const defaultTimeFilter = useDefaultTimeFilter();

  const value = props.value ?? defaultTimeFilter;
  const [actualTimeRange, setActualTimeRange] = useState<string>(value);

  const [show, setShow] = useState<boolean>(false);
  const [lastFetchedTimeRange, setLastFetchedTimeRange] = useState(value);
  const [timeRangeValue, setTimeRangeValue] = useState(value);
  const [rangePickerValue, setRangePickerValue] =
    useState<RangePickerValue | null>(getRangePickerValue(value));
  const [validTimeRange, setValidTimeRange] = useState<boolean>(false);
  const [evalResponse, setEvalResponse] = useState<string>(value);
  const [tooltipTitle, setTooltipTitle] = useState<ReactNode | null>(value);
  const theme = useTheme();
  const [labelRef, labelIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();

  useEffect(() => {
    if (value === NO_TIME_RANGE) {
      setActualTimeRange(NO_TIME_RANGE);
      setTooltipTitle(null);
      setValidTimeRange(true);
      return;
    }
    fetchTimeRange(value).then(({ value: actualRange, error }) => {
      if (error) {
        setEvalResponse(error || '');
        setValidTimeRange(false);
        setTooltipTitle(value || null);
      } else {
        setActualTimeRange(actualRange || value);
        setTooltipTitle(
          getTooltipTitle(labelIsTruncated, actualRange || value, value),
        );
        setValidTimeRange(true);
      }
      setLastFetchedTimeRange(value);
      setEvalResponse(actualRange || value);
    });
  }, [labelIsTruncated, labelRef, value]);

  useDebouncedEffect(
    () => {
      if (timeRangeValue === NO_TIME_RANGE) {
        setEvalResponse(NO_TIME_RANGE);
        setLastFetchedTimeRange(NO_TIME_RANGE);
        setValidTimeRange(true);
        return;
      }
      if (lastFetchedTimeRange !== timeRangeValue) {
        fetchTimeRange(timeRangeValue).then(({ value: actualRange, error }) => {
          if (error) {
            setEvalResponse(error || '');
            setValidTimeRange(false);
          } else {
            setEvalResponse(actualRange || '');
            setValidTimeRange(true);
          }
          setLastFetchedTimeRange(timeRangeValue);
        });
      }
    },
    Constants.SLOW_DEBOUNCE,
    [timeRangeValue],
  );

  function onSave() {
    onChange(timeRangeValue);
    setShow(false);
    onClosePopover();
  }

  function onOpen() {
    setTimeRangeValue(value);
    setRangePickerValue(getRangePickerValue(value));
    setShow(true);
    onOpenPopover();
  }

  function onHide() {
    setTimeRangeValue(value);
    setRangePickerValue(getRangePickerValue(value));
    setShow(false);
    onClosePopover();
  }

  const toggleOverlay = () => {
    if (show) {
      onHide();
    } else {
      onOpen();
    }
  };

  const onRangePickerChange: RangePickerProps['onCalendarChange'] = dates => {
    setRangePickerValue(dates);
    if (dates?.[0] && dates?.[1]) {
      setTimeRangeValue(buildTimeRange([dates[0], dates[1]]));
    } else if (!dates?.[0] && !dates?.[1]) {
      setTimeRangeValue(NO_TIME_RANGE);
      setEvalResponse(NO_TIME_RANGE);
      setValidTimeRange(true);
    } else {
      setValidTimeRange(false);
    }
  };

  const overlayContent = (
    <ContentStyleWrapper>
      <div className="control-label">{t('Time range')}</div>
      <RangePicker
        disabledDate={disabledDate}
        disabledTime={disabledRangeTime}
        showTime={{
          hideDisabledOptions: true,
          defaultOpenValue: [
            extendedDayjs('00:00:00', 'HH:mm:ss'),
            extendedDayjs('23:59:59', 'HH:mm:ss'),
          ],
        }}
        format={TIME_RANGE_DISPLAY_FORMAT}
        placeholder={[t('Start date'), t('End date')]}
        value={rangePickerValue}
        onCalendarChange={onRangePickerChange}
        getPopupContainer={(triggerNode: HTMLElement) =>
          isOverflowingFilterBar
            ? (triggerNode.parentNode as HTMLElement)
            : document.body
        }
      />
      <Divider />
      <div>
        <div className="section-title">{t('Actual time range')}</div>
        {validTimeRange && (
          <div>
            {evalResponse === 'No filter' ? t('No filter') : evalResponse}
          </div>
        )}
        {!validTimeRange && (
          <IconWrapper className="warning">
            <Icons.ExclamationCircleOutlined iconColor={theme.colorError} />
            <span className="text error">{evalResponse}</span>
          </IconWrapper>
        )}
      </div>
      <Divider />
      <div className="footer">
        <Button
          buttonStyle="secondary"
          cta
          key="cancel"
          onClick={onHide}
          data-test={DateFilterTestKey.CancelButton}
        >
          {t('CANCEL')}
        </Button>
        <Button
          buttonStyle="primary"
          cta
          disabled={!validTimeRange}
          key="apply"
          onClick={onSave}
          data-test={DateFilterTestKey.ApplyButton}
        >
          {t('APPLY')}
        </Button>
      </div>
    </ContentStyleWrapper>
  );

  const popoverContent = (
    <ControlPopover
      autoAdjustOverflow={false}
      trigger="click"
      placement="right"
      content={overlayContent}
      title={
        <IconWrapper>
          <Icons.EditOutlined />
          <span className="text">{t('Edit time range')}</span>
        </IconWrapper>
      }
      defaultOpen={show}
      open={show}
      onOpenChange={toggleOverlay}
      overlayStyle={{ width: '600px' }}
      destroyOnHidden
      getPopupContainer={nodeTrigger =>
        isOverflowingFilterBar
          ? (nodeTrigger.parentNode as HTMLElement)
          : document.body
      }
      overlayClassName="time-range-popover"
    >
      <Tooltip placement="top" title={tooltipTitle}>
        <DateLabel
          name={name}
          aria-labelledby={`filter-name-${props.name}`}
          aria-describedby={`date-label-${props.name}`}
          label={actualTimeRange}
          isActive={show}
          isPlaceholder={actualTimeRange === NO_TIME_RANGE}
          data-test={DateFilterTestKey.PopoverOverlay}
          ref={labelRef}
        />
      </Tooltip>
    </ControlPopover>
  );

  return (
    <>
      <ControlHeader {...props} />
      {popoverContent}
    </>
  );
}
