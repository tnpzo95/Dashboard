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
import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';

import { ResizeCallback, ResizeStartCallback } from 're-resizable';
import cx from 'classnames';
import { useSelector } from 'react-redux';
import { css, useTheme } from '@apache-superset/core/theme';
import { LayoutItem, RootState } from 'src/dashboard/types';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import { ConnectDragSource } from 'react-dnd';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import getChartAndLabelComponentIdFromPath from 'src/dashboard/util/getChartAndLabelComponentIdFromPath';
import useFilterFocusHighlightStyles from 'src/dashboard/util/useFilterFocusHighlightStyles';
import { AntdThemeProvider } from '@superset-ui/core/components';
import { ensureAppRoot } from 'src/utils/pathUtils';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_BASE_UNIT,
  GRID_GUTTER_SIZE,
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
} from 'src/dashboard/util/constants';

export const CHART_MARGIN = 32;
const DEFAULT_ROTATOR_INTERVAL_MS = 60_000;
const DEFAULT_ROTATOR_TRANSITION_MS = 900;

type RotatorZoneConfig = {
  chartIds: number[];
  intervalMs: number;
  transitionMs: number;
  enabled: boolean;
};

function parseChartId(value: unknown): number | null {
  const chartId =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isInteger(chartId) && chartId > 0 ? chartId : null;
}

function parseChartIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.reduce<number[]>((chartIds, item) => {
    const chartId = parseChartId(item);
    if (chartId !== null && !chartIds.includes(chartId)) {
      chartIds.push(chartId);
    }
    return chartIds;
  }, []);
}

function parseRotatorZoneConfig(value: unknown): RotatorZoneConfig | null {
  if (Array.isArray(value)) {
    const chartIds = parseChartIds(value);
    return chartIds.length > 1
      ? {
          chartIds,
          intervalMs: DEFAULT_ROTATOR_INTERVAL_MS,
          transitionMs: DEFAULT_ROTATOR_TRANSITION_MS,
          enabled: true,
        }
      : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawConfig = value as Record<string, unknown>;
  const chartIds = parseChartIds(rawConfig.chartIds);
  const intervalSeconds =
    typeof rawConfig.intervalSeconds === 'number'
      ? rawConfig.intervalSeconds
      : Number(rawConfig.intervalSeconds);
  const intervalMs =
    typeof rawConfig.intervalMs === 'number'
      ? rawConfig.intervalMs
      : Number(rawConfig.intervalMs);
  const normalizedIntervalMs = Number.isFinite(intervalMs)
    ? intervalMs
    : Number.isFinite(intervalSeconds)
      ? intervalSeconds * 1000
      : DEFAULT_ROTATOR_INTERVAL_MS;
  const transitionSeconds =
    typeof rawConfig.transitionSeconds === 'number'
      ? rawConfig.transitionSeconds
      : Number(rawConfig.transitionSeconds);
  const transitionMs =
    typeof rawConfig.transitionMs === 'number'
      ? rawConfig.transitionMs
      : Number(rawConfig.transitionMs);
  const normalizedTransitionMs = Number.isFinite(transitionMs)
    ? transitionMs
    : Number.isFinite(transitionSeconds)
      ? transitionSeconds * 1000
      : DEFAULT_ROTATOR_TRANSITION_MS;

  return chartIds.length > 1
    ? {
        chartIds,
        intervalMs: Math.max(normalizedIntervalMs, 1000),
        transitionMs: Math.max(normalizedTransitionMs, 0),
        enabled: rawConfig.enabled !== false,
      }
    : null;
}

function getRotatorZoneConfig(
  metadata: RootState['dashboardInfo']['metadata'] | undefined,
  componentId: string,
  chartId?: number,
): RotatorZoneConfig | null {
  const rotatorConfig = (metadata as Record<string, unknown> | undefined)
    ?.dashboard_chart_rotator;
  if (!rotatorConfig || typeof rotatorConfig !== 'object') {
    return null;
  }

  const zoneConfig = rotatorConfig as Record<string, unknown>;
  return (
    parseRotatorZoneConfig(zoneConfig[componentId]) ||
    (chartId !== undefined
      ? parseRotatorZoneConfig(zoneConfig[String(chartId)])
      : null)
  );
}

function getHiddenChartIds(
  metadata: RootState['dashboardInfo']['metadata'] | undefined,
): number[] {
  const hiddenChartIds = (metadata as Record<string, unknown> | undefined)
    ?.dashboard_hidden_charts;
  return parseChartIds(hiddenChartIds);
}

export interface ChartHolderProps {
  id: string;
  parentId: string;
  dashboardId: number;
  component: LayoutItem;
  parentComponent: LayoutItem;
  getComponentById?: (id?: string) => LayoutItem | undefined;
  index: number;
  depth: number;
  editMode: boolean;
  directPathLastUpdated?: number;
  fullSizeChartId: number | null;
  isComponentVisible: boolean;

  // grid related
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;

  // dnd
  deleteComponent: (id: string, parentId: string) => void;
  updateComponents: Function;
  handleComponentDrop: (...args: unknown[]) => unknown;
  setFullSizeChartId: (chartId: number | null) => void;
  isInView: boolean;
}

const ChartHolder = ({
  id,
  parentId,
  component,
  parentComponent,
  index,
  depth,
  availableColumnCount,
  columnWidth,
  onResizeStart,
  onResize,
  onResizeStop,
  editMode,
  isComponentVisible,
  dashboardId,
  fullSizeChartId,
  getComponentById = () => undefined,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
  setFullSizeChartId,
  isInView,
}: ChartHolderProps) => {
  const theme = useTheme();
  const fullSizeStyle = css`
    && {
      position: fixed !important;
      z-index: 3000;
      left: 0;
      top: 0;
      padding: ${theme.sizeUnit * 2}px;
    }
  `;
  const { chartId } = component.meta;
  const chartHolderRef = useRef<HTMLDivElement | null>(null);
  const dashboardMetadata = useSelector(
    (state: RootState) => state.dashboardInfo.metadata,
  );
  const rotatorConfig = useMemo(
    () => getRotatorZoneConfig(dashboardMetadata, component.id, chartId),
    [chartId, component.id, dashboardMetadata],
  );
  const hiddenChartIds = useMemo(
    () => getHiddenChartIds(dashboardMetadata),
    [dashboardMetadata],
  );
  const [rotatorIndex, setRotatorIndex] = useState(0);
  const [isRotatorFading, setIsRotatorFading] = useState(false);
  const rotatorChartIds = useMemo(() => {
    if (!rotatorConfig?.enabled || chartId === undefined) {
      return chartId ? [chartId] : [];
    }
    const chartIds = rotatorConfig.chartIds.includes(chartId)
      ? rotatorConfig.chartIds
      : [chartId, ...rotatorConfig.chartIds];
    return chartIds.filter((id, index) => chartIds.indexOf(id) === index);
  }, [chartId, rotatorConfig]);
  const targetChartId =
    rotatorChartIds[rotatorIndex % rotatorChartIds.length] ?? chartId;
  const [activeChartId, setActiveChartId] = useState<number | undefined>(
    targetChartId,
  );
  const activeSliceName = useSelector((state: RootState) =>
    activeChartId
      ? state.sliceEntities.slices[activeChartId]?.slice_name
      : undefined,
  );
  const activeChartLoaded = useSelector((state: RootState) =>
    activeChartId
      ? Boolean(
          state.sliceEntities.slices[activeChartId] && state.charts[activeChartId],
        )
      : false,
  );
  const isFullSize = fullSizeChartId === chartId;
  const shouldHideComponent =
    !editMode && chartId !== undefined && hiddenChartIds.includes(chartId);

  const focusHighlightStyles = useFilterFocusHighlightStyles(chartId ?? 0);
  const directPathToChild = useSelector(
    (state: RootState) => state.dashboardState.directPathToChild,
  );
  const directPathLastUpdated = useSelector(
    (state: RootState) => state.dashboardState.directPathLastUpdated ?? 0,
  );

  const [extraControls, setExtraControls] = useState<Record<string, unknown>>(
    {},
  );
  const [outlinedComponentId, setOutlinedComponentId] = useState<string>();
  const [outlinedColumnName, setOutlinedColumnName] = useState<string>();
  const [currentDirectPathLastUpdated, setCurrentDirectPathLastUpdated] =
    useState(0);

  const infoFromPath = useMemo(
    () => getChartAndLabelComponentIdFromPath(directPathToChild ?? []) as any,
    [directPathToChild],
  );

  useEffect(() => {
    setRotatorIndex(0);
    setActiveChartId(chartId);
    setIsRotatorFading(false);
  }, [rotatorConfig, chartId]);

  useEffect(() => {
    if (editMode || rotatorChartIds.length < 2 || !rotatorConfig?.enabled) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRotatorIndex(index => (index + 1) % rotatorChartIds.length);
    }, rotatorConfig.intervalMs);

    return () => window.clearInterval(intervalId);
  }, [editMode, rotatorChartIds.length, rotatorConfig]);

  useEffect(() => {
    if (targetChartId === activeChartId) {
      return undefined;
    }

    if (editMode || !rotatorConfig?.enabled || rotatorConfig.transitionMs === 0) {
      setActiveChartId(targetChartId);
      setIsRotatorFading(false);
      return undefined;
    }

    const halfTransitionMs = rotatorConfig.transitionMs / 2;
    setIsRotatorFading(true);

    const swapTimerId = window.setTimeout(() => {
      setActiveChartId(targetChartId);
      setIsRotatorFading(false);
    }, halfTransitionMs);

    return () => {
      window.clearTimeout(swapTimerId);
    };
  }, [activeChartId, editMode, rotatorConfig, targetChartId]);

  // Calculate if the chart should be outlined
  useEffect(() => {
    const { label: columnName, chart: chartComponentId } = infoFromPath;

    if (
      directPathLastUpdated !== currentDirectPathLastUpdated &&
      component.id === chartComponentId
    ) {
      setCurrentDirectPathLastUpdated(directPathLastUpdated);
      setOutlinedComponentId(component.id);
      setOutlinedColumnName(columnName);
    }
  }, [
    component,
    currentDirectPathLastUpdated,
    directPathLastUpdated,
    infoFromPath,
  ]);

  // Remove the chart outline after a defined time
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (outlinedComponentId) {
      timerId = setTimeout(() => {
        setOutlinedComponentId(undefined);
        setOutlinedColumnName(undefined);
      }, 2000);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [outlinedComponentId]);

  const widthMultiple = useMemo(() => {
    const columnParentWidth = getComponentById(
      parentComponent.parents?.find(parent => parent.startsWith(COLUMN_TYPE)),
    )?.meta?.width;

    let widthMultiple = component.meta.width || GRID_MIN_COLUMN_COUNT;
    if (parentComponent.type === COLUMN_TYPE) {
      widthMultiple = parentComponent.meta.width || GRID_MIN_COLUMN_COUNT;
    } else if (columnParentWidth && widthMultiple > columnParentWidth) {
      widthMultiple = columnParentWidth;
    }

    return widthMultiple;
  }, [
    component,
    getComponentById,
    parentComponent.meta.width,
    parentComponent.parents,
    parentComponent.type,
  ]);

  const { chartWidth, chartHeight } = useMemo(() => {
    let width = 0;
    let height = 0;

    if (isFullSize) {
      width = window.innerWidth - CHART_MARGIN;
      height = window.innerHeight - CHART_MARGIN;
    } else {
      width = Math.floor(
        widthMultiple * columnWidth +
          (widthMultiple - 1) * GRID_GUTTER_SIZE -
          CHART_MARGIN,
      );
      height = Math.floor(
        (component.meta.height ?? 0) * GRID_BASE_UNIT - CHART_MARGIN,
      );
    }

    return {
      chartWidth: width,
      chartHeight: height,
    };
  }, [columnWidth, component, isFullSize, widthMultiple]);

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const handleUpdateSliceName = useCallback(
    (nextName: string) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            sliceNameOverride: nextName,
          },
        },
      });
    },
    [component, updateComponents],
  );

  const handleToggleFullSize = useCallback(() => {
    setFullSizeChartId(isFullSize ? null : (chartId ?? null));
  }, [chartId, isFullSize, setFullSizeChartId]);

  const handleExtraControl = useCallback((name: string, value: unknown) => {
    setExtraControls(current => ({
      ...current,
      [name]: value,
    }));
  }, []);

  const renderChartContent = useCallback(
    () => {
      if (activeChartId === undefined) {
        return null;
      }
      const shouldRenderNativeChart =
        activeChartId === chartId || activeChartLoaded;

      return shouldRenderNativeChart ? (
        <Chart
          componentId={component.id}
          id={activeChartId}
          dashboardId={dashboardId}
          width={chartWidth}
          height={chartHeight}
          sliceName={
            component.meta.sliceNameOverride ||
            activeSliceName ||
            component.meta.sliceName ||
            ''
          }
          updateSliceName={(_sliceId: number, name: string) =>
            handleUpdateSliceName(name)
          }
          isComponentVisible={isComponentVisible}
          handleToggleFullSize={handleToggleFullSize}
          isFullSize={isFullSize}
          setControlValue={handleExtraControl}
          extraControls={extraControls}
          isInView={isInView}
          chartHolderRef={chartHolderRef}
        />
      ) : (
        <iframe
          title={`chart-${activeChartId}`}
          src={ensureAppRoot(
            `/explore/?slice_id=${activeChartId}&standalone=1&height=${chartHeight}`,
          )}
          width="100%"
          height={chartHeight}
          seamless
          frameBorder="0"
          scrolling="no"
          style={{ border: 0, display: 'block' }}
        />
      );
    },
    [
      activeChartId,
      activeChartLoaded,
      activeSliceName,
      chartId,
      chartHeight,
      chartWidth,
      component.id,
      component.meta.sliceName,
      component.meta.sliceNameOverride,
      dashboardId,
      extraControls,
      handleExtraControl,
      handleToggleFullSize,
      handleUpdateSliceName,
      isComponentVisible,
      isFullSize,
      isInView,
    ],
  );

  const renderChild = useCallback(
    ({ dragSourceRef }: { dragSourceRef?: ConnectDragSource }) => (
      <ResizableContainer
        id={component.id}
        adjustableWidth={parentComponent.type === ROW_TYPE}
        adjustableHeight
        widthStep={columnWidth}
        widthMultiple={widthMultiple}
        heightStep={GRID_BASE_UNIT}
        heightMultiple={component.meta.height ?? GRID_MIN_ROW_UNITS}
        minWidthMultiple={GRID_MIN_COLUMN_COUNT}
        minHeightMultiple={GRID_MIN_ROW_UNITS}
        maxWidthMultiple={availableColumnCount + widthMultiple}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeStop={onResizeStop}
        editMode={editMode}
      >
        <div
          ref={el => {
            if (typeof dragSourceRef === 'function') {
              dragSourceRef(el);
            } else if (
              dragSourceRef &&
              Object.prototype.hasOwnProperty.call(dragSourceRef, 'current')
            ) {
              (
                dragSourceRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
            }
            chartHolderRef.current = el;
          }}
          data-test="dashboard-component-chart-holder"
          style={focusHighlightStyles}
          css={isFullSize ? fullSizeStyle : undefined}
          className={cx(
            'dashboard-component',
            'dashboard-component-chart-holder',
            // The following class is added to support custom dashboard styling via the CSS editor
            `dashboard-chart-id-${chartId}`,
            activeChartId ? `dashboard-active-chart-id-${activeChartId}` : null,
            outlinedComponentId ? 'fade-in' : 'fade-out',
          )}
        >
          <AntdThemeProvider
            getPopupContainer={(triggerNode: HTMLElement) =>
              document.fullscreenElement
                ? (triggerNode?.closest?.(
                    '[data-test="dashboard-component-chart-holder"]',
                  ) as HTMLElement) || document.body
                : document.body
            }
          >
            {!editMode && (
              <AnchorLink
                id={component.id}
                scrollIntoView={outlinedComponentId === component.id}
              />
            )}
            {!!outlinedComponentId && (
              <style>
                {`label[for=${outlinedColumnName}] + .Select .Select__control {
                      border-color: ${theme.colorPrimary};
                      transition: border-color 1s ease-in-out;
                    }`}
              </style>
            )}
            <div
              style={{
                height: chartHeight,
                opacity: isRotatorFading ? 0 : 1,
                transition: rotatorConfig?.enabled
                  ? `opacity ${rotatorConfig.transitionMs / 2}ms ease-in-out`
                  : undefined,
              }}
            >
              {renderChartContent()}
            </div>
            {editMode && (
              <HoverMenu position="top">
                <div data-test="dashboard-delete-component-button">
                  <DeleteComponentButton onDelete={handleDeleteComponent} />
                </div>
              </HoverMenu>
            )}
          </AntdThemeProvider>
        </div>
      </ResizableContainer>
    ),
    [
      component.id,
      component.meta.height,
      component.meta.chartId,
      activeChartId,
      parentComponent.type,
      columnWidth,
      widthMultiple,
      availableColumnCount,
      onResizeStart,
      onResize,
      onResizeStop,
      editMode,
      focusHighlightStyles,
      isFullSize,
      fullSizeStyle,
      chartId,
      outlinedComponentId,
      outlinedColumnName,
      handleDeleteComponent,
      isRotatorFading,
      rotatorConfig,
      chartHeight,
      renderChartContent,
    ],
  );

  if (shouldHideComponent) {
    return (
      <div
        ref={chartHolderRef}
        aria-hidden="true"
        style={{
          height: chartHeight,
          left: -100000,
          opacity: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          position: 'absolute',
          top: 0,
          width: chartWidth,
        }}
      >
        {renderChartContent()}
      </div>
    );
  }

  return (
    <Draggable
      component={component}
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      disableDragDrop={false}
      editMode={editMode}
    >
      {renderChild}
    </Draggable>
  );
};

export default memo(ChartHolder);
