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

/* eslint-disable no-param-reassign */
// <- When we work with Immer, we need reassign, so disabling lint
import { produce } from 'immer';
import {
  DataMask,
  DataMaskStateWithId,
  DataMaskWithId,
  Filter,
  FilterConfiguration,
  Filters,
  FilterState,
  ExtraFormData,
  ChartCustomization,
} from '@superset-ui/core';
import {
  NATIVE_FILTER_PREFIX,
  isChartCustomization,
} from 'src/dashboard/components/nativeFilters/FiltersConfigModal/utils';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import {
  HYDRATE_EXPLORE,
  HydrateExplore,
} from 'src/explore/actions/hydrateExplore';
import { SaveFilterChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import {
  migrateChartCustomizationArray,
  isLegacyChartCustomizationFormat,
} from 'src/dashboard/util/migrateChartCustomization';
import { isEqual } from 'lodash';
import {
  AnyDataMaskAction,
  CLEAR_DATA_MASK_STATE,
  REMOVE_DATA_MASK,
  SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE,
  UPDATE_DATA_MASK,
} from './actions';
import { areObjectsEqual } from '../reduxUtils';

type FilterWithExtaFromData = Filter & {
  extraFormData?: ExtraFormData;
  filterState?: FilterState;
};

interface DashboardMetadata {
  chart_configuration?: Record<string, unknown>;
  native_filter_configuration?: FilterConfiguration;
  chart_customization_config?: ChartCustomization[];
}

export interface HydrateDataMaskAction {
  type: typeof HYDRATE_DASHBOARD;
  data: {
    dashboardInfo: {
      metadata: DashboardMetadata;
    };
    dataMask?: DataMaskStateWithId;
  };
}

function isChartCustomizationItem(item: unknown): item is ChartCustomization {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof item.id === 'string' &&
    'type' in item &&
    'defaultDataMask' in item
  );
}

export function getInitialDataMask(
  id?: string | number,
  moreProps: DataMask = {},
): DataMask | DataMaskWithId {
  return {
    ...(id !== undefined ? { id } : {}),
    extraFormData: {},
    filterState: {},
    ownState: {},
    ...moreProps,
  } as DataMask | DataMaskWithId;
}

function getPrevToCurrentMonthTimeRange(): string {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYear = String(prevMonth.getFullYear());
  const prevMon = String(prevMonth.getMonth() + 1).padStart(2, '0');
  const curYear = String(now.getFullYear());
  const curMon = String(now.getMonth() + 1).padStart(2, '0');
  const lastDayOfCur = String(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  ).padStart(2, '0');
  return `${prevYear}-${prevMon}-01 : ${curYear}-${curMon}-${lastDayOfCur}`;
}

function formatDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getCurrentDayTimeRange(): string {
  const dateStr = formatDateOnly(new Date());
  return `${dateStr}T00:00:00 : ${dateStr}T23:59:59`;
}

function getCurrentWeekTimeRange(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return `${formatDateOnly(monday)}T00:00:00 : ${formatDateOnly(sunday)}T23:59:59`;
}

function getCurrentMonthOnlyTimeRange(): string {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${formatDateOnly(firstDay)}T00:00:00 : ${formatDateOnly(lastDay)}T23:59:59`;
}

function getCurrentShiftTimeRange(): string {
  // Work shift: 08:00 today → 08:00 tomorrow
  const today = formatDateOnly(new Date());
  const tomorrow = formatDateOnly(
    new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1),
  );
  return `${today}T08:00:00 : ${tomorrow}T08:00:00`;
}

function getDaysAgoTimeRange(days: number): string {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return `${formatDateOnly(fromDate)}T00:00:00 : ${formatDateOnly(now)}T23:59:59`;
}

function getShiftDaysAgoTimeRange(days: number): string {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return `${formatDateOnly(fromDate)}T08:00:00 : ${formatDateOnly(now)}T08:00:00`;
}

// Matches DAYJS_FORMAT ('YYYY-MM-DD[T]HH:mm:ss') from
// src/explore/components/controls/DateFilterControl/utils/constants.ts, so
// this dynamically-computed default matches what DateTimeFilterPlugin's own
// client-side default-fill effect would produce for the same instant.
function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getCurrentDateTime(): string {
  return formatDateTime(new Date());
}

function getDaysAgoDateTime(days: number): string {
  const now = new Date();
  const past = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  );
  return formatDateTime(past);
}

// When "Filter by hour" is off, dynamic defaults must collapse to midnight
// so they match what the picker itself would produce with showTime disabled.
function toStartOfDay(dateTimeValue: string): string {
  return `${dateTimeValue.slice(0, 10)}T00:00:00`;
}

function fillNativeFilters(
  filterConfig: FilterConfiguration,
  mergedDataMask: DataMaskStateWithId,
  draftDataMask: DataMaskStateWithId,
  initialDataMask?: DataMaskStateWithId,
  currentFilters?: Filters,
) {
  filterConfig.forEach((filter: Filter) => {
    const dataMask = initialDataMask || {};
    mergedDataMask[filter.id] = {
      ...getInitialDataMask(filter.id), // take initial data
      ...filter.defaultDataMask, // if something new came from BE - take it
      ...dataMask[filter.id],
    };
    if (
      currentFilters &&
      !areObjectsEqual(
        filter.defaultDataMask,
        currentFilters[filter.id]?.defaultDataMask,
        { ignoreUndefined: true },
      )
    ) {
      mergedDataMask[filter.id] = {
        ...mergedDataMask[filter.id],
        ...filter.defaultDataMask,
      };
    }
    // Dynamically inject a default time range for filters with defaultFillterTimeNow/
    // defaultFillterWeekNow/defaultFillterMonthNow: "filter_time" defaults to today,
    // the current week (Mon-Sun) or the current month (1st-last day) respectively;
    // other filter types (e.g. month range) keep the previous-month-to-current-month range.
    if (!mergedDataMask[filter.id]?.filterState?.value) {
      let timeRange: string | undefined;
      if (filter.controlValues?.defaultFillterTimeNow) {
        timeRange =
          filter.filterType === 'filter_time'
            ? getCurrentDayTimeRange()
            : getPrevToCurrentMonthTimeRange();
      } else if (
        filter.filterType === 'filter_time' &&
        filter.controlValues?.defaultFillterWeekNow
      ) {
        timeRange = getCurrentWeekTimeRange();
      } else if (
        filter.filterType === 'filter_time' &&
        filter.controlValues?.defaultFillterMonthNow
      ) {
        timeRange = getCurrentMonthOnlyTimeRange();
      } else if (
        filter.filterType === 'filter_time' &&
        filter.controlValues?.defaultFillterShiftNow
      ) {
        timeRange = getCurrentShiftTimeRange();
      } else if (
        filter.filterType === 'filter_time' &&
        filter.controlValues?.defaultFillterDaysAgo
      ) {
        timeRange = getDaysAgoTimeRange(
          filter.controlValues?.defaultFillterDaysAgoNumber ?? 3,
        );
      } else if (
        filter.filterType === 'filter_time' &&
        filter.controlValues?.defaultFillterShiftDaysAgo
      ) {
        timeRange = getShiftDaysAgoTimeRange(
          filter.controlValues?.defaultFillterShiftDaysAgoNumber ?? 3,
        );
      }
      if (timeRange) {
        mergedDataMask[filter.id] = {
          ...mergedDataMask[filter.id],
          extraFormData: { time_range: timeRange },
          filterState: { value: timeRange },
        };
      } else if (filter.filterType === 'filter_datetime') {
        // Same "recompute fresh on every load" behavior as filter_time's
        // defaults above, but for a single exact-match datetime value
        // scoped to the filter's target column. Sets BOTH an exact-match
        // `filters` clause on that column AND a zero-width `time_range`
        // (see getDateTimeExtraFormData in src/filters/utils.ts) so datasets
        // can also reference the value via {{ from_dttm }}/{{ to_dttm }} in
        // custom SQL, same as the Time range filter.
        let dateTimeValue: string | undefined;
        if (filter.controlValues?.defaultDateTimeNow) {
          dateTimeValue = getCurrentDateTime();
        } else if (filter.controlValues?.defaultDateTimeDaysAgo) {
          dateTimeValue = getDaysAgoDateTime(
            filter.controlValues?.defaultDateTimeDaysAgoNumber ?? 3,
          );
        }
        if (dateTimeValue && filter.controlValues?.enableHourFilter === false) {
          dateTimeValue = toStartOfDay(dateTimeValue);
        }
        const col = filter.targets?.[0]?.column?.name;
        if (dateTimeValue && col) {
          mergedDataMask[filter.id] = {
            ...mergedDataMask[filter.id],
            extraFormData: {
              filters: [{ col, op: '==', val: dateTimeValue }],
              time_range: `${dateTimeValue} : ${dateTimeValue}`,
            },
            filterState: { value: dateTimeValue },
          };
        }
      }
    }
  });

  // Get back all other non-native filters
  Object.values(draftDataMask).forEach(filter => {
    if (!String(filter?.id).startsWith(NATIVE_FILTER_PREFIX)) {
      mergedDataMask[filter?.id] = filter;
    }
  });
}

function updateDataMaskForFilterChanges(
  filterChanges: SaveFilterChangesType,
  mergedDataMask: DataMaskStateWithId,
  draftDataMask: DataMaskStateWithId,
  initialDataMask?: Filters,
  isCustomizationChanges?: boolean,
) {
  filterChanges.deleted.forEach((filterId: string) => {
    delete mergedDataMask[filterId];
  });

  filterChanges.modified.forEach((filter: Filter) => {
    const existingFilter = draftDataMask[filter.id] as FilterWithExtaFromData;
    const prevFilterDef = initialDataMask?.[filter.id] as Filter | undefined;

    // Check if targets are equal
    const areTargetsEqual = isEqual(prevFilterDef?.targets, filter?.targets);

    // Preserve state only if filter exists, has enableEmptyFilter=true and targets match
    const shouldPreserveState =
      existingFilter &&
      areTargetsEqual &&
      (filter.controlValues?.enableEmptyFilter ||
        filter.controlValues?.defaultToFirstItem);

    mergedDataMask[filter.id] = {
      ...getInitialDataMask(filter.id),
      ...filter.defaultDataMask,
      ...filter,
      // Preserve extraFormData and filterState if conditions match
      ...(shouldPreserveState && {
        extraFormData: existingFilter.extraFormData,
        filterState: existingFilter.filterState,
      }),
    };
  });

  // Preserve state for native filters that were not modified or deleted
  Object.entries(draftDataMask).forEach(([key, value]) => {
    if (String(value?.id).startsWith(NATIVE_FILTER_PREFIX)) {
      const wasDeleted = filterChanges.deleted.includes(key);
      const wasModified = filterChanges.modified.some(f => f.id === key);
      if (!wasDeleted && !wasModified) {
        mergedDataMask[key] = value;
      }
    }
  });

  Object.values(draftDataMask).forEach(filter => {
    const filterId = String(filter?.id);
    const shouldSkip = isCustomizationChanges
      ? isChartCustomization(filterId)
      : filterId.startsWith(NATIVE_FILTER_PREFIX);
    if (!shouldSkip) {
      mergedDataMask[filter?.id] = filter;
    }
  });
}

const dataMaskReducer = produce(
  (
    draft: DataMaskStateWithId,
    action: AnyDataMaskAction | HydrateDataMaskAction | HydrateExplore,
  ) => {
    const cleanState: DataMaskStateWithId = {};
    switch (action.type) {
      case CLEAR_DATA_MASK_STATE:
        return cleanState;
      case UPDATE_DATA_MASK:
        draft[action.filterId] = {
          ...getInitialDataMask(action.filterId),
          ...draft[action.filterId],
          ...action.dataMask,
        };
        return draft;
      case HYDRATE_DASHBOARD: {
        const hydrateDashboardAction = action as HydrateDataMaskAction;
        const metadata = hydrateDashboardAction.data.dashboardInfo?.metadata;
        const loadedDataMask = hydrateDashboardAction.data.dataMask;

        Object.keys(metadata?.chart_configuration || {}).forEach(id => {
          cleanState[id] = {
            ...(getInitialDataMask(id) as DataMaskWithId),
          };
        });

        fillNativeFilters(
          metadata?.native_filter_configuration ?? [],
          cleanState,
          draft,
          loadedDataMask,
        );

        const rawChartCustomizationConfig = (
          metadata?.chart_customization_config || []
        ).filter(Boolean);

        const hasLegacyFormat = rawChartCustomizationConfig.some(item =>
          isLegacyChartCustomizationFormat(item),
        );

        const chartCustomizationConfig = hasLegacyFormat
          ? migrateChartCustomizationArray(rawChartCustomizationConfig)
          : (rawChartCustomizationConfig as ChartCustomization[]);

        chartCustomizationConfig.forEach(item => {
          if (!isChartCustomizationItem(item)) {
            return;
          }

          const customizationFilterId = item.id;
          const dataMask = loadedDataMask || {};

          cleanState[customizationFilterId] = {
            ...getInitialDataMask(customizationFilterId),
            ...item.defaultDataMask,
            ...dataMask[customizationFilterId],
          };

          if (
            draft[customizationFilterId] &&
            item.defaultDataMask &&
            !areObjectsEqual(
              item.defaultDataMask,
              draft[customizationFilterId],
              { ignoreUndefined: true },
            )
          ) {
            cleanState[customizationFilterId] = {
              ...cleanState[customizationFilterId],
              ...item.defaultDataMask,
            };
          }

          if (item.controlValues?.column) {
            cleanState[customizationFilterId].ownState = {
              ...cleanState[customizationFilterId].ownState,
              column: item.controlValues.column,
            };
          }
        });

        Object.values(draft).forEach(filter => {
          if (
            filter?.id &&
            !isChartCustomization(String(filter.id)) &&
            !cleanState[filter.id]
          ) {
            cleanState[filter.id] = filter;
          }
        });

        return cleanState;
      }
      case HYDRATE_EXPLORE: {
        const hydrateExploreAction = action as HydrateExplore;
        const loadedDataMask = hydrateExploreAction.data.dataMask;
        if (loadedDataMask) {
          Object.entries(loadedDataMask).forEach(([id, mask]) => {
            draft[id] = {
              ...getInitialDataMask(id),
              ...draft[id],
              ...mask,
            };
          });
        }
        return draft;
      }
      case SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE:
        updateDataMaskForFilterChanges(
          action.filterChanges,
          cleanState,
          draft,
          action.filters,
          action.isCustomizationChanges,
        );
        return cleanState;
      case REMOVE_DATA_MASK:
        delete draft[action.filterId];
        return draft;
      default:
        return draft;
    }
  },
  {},
);

export default dataMaskReducer;
