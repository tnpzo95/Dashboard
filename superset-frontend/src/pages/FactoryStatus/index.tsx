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
import {
  useCallback,
  Fragment,
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import {
  Button,
  Icons,
  Input,
  InputNumber,
  Select,
  Tooltip,
} from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

type NodeStatus =
  | 'run'
  | 'idle'
  | 'down'
  | 'power_off'
  | 'disconnection';
type NodeMode = 'remote' | 'local' | 'offline';
type NodeModePosition = 'top' | 'right' | 'bottom' | 'left' | 'hidden';
type NodeType = 'equipment' | 'area' | 'label';

type FactoryNode = {
  id: string;
  deviceId?: string | null;
  deviceCode?: string | null;
  label?: string | null;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  status: NodeStatus;
  mode: NodeMode;
  modePosition?: NodeModePosition;
  modeWidthPercent?: number;
  delayTime?: number | null;
  details?: Record<string, string | number | boolean | null>;
};

type FactoryAlarm = {
  groupName?: string | null;
  deviceId?: string | null;
  eqm: string;
  model?: string | null;
  alarmCode: string;
  alarmCount: number;
  alarmDesc?: string | null;
};

type FactoryLayout = {
  name: string;
  width: number;
  height: number;
  nodes: FactoryNode[];
  alarms?: FactoryAlarm[];
  updated_at?: string | null;
};

type DragState = {
  nodeId: string;
  offsetX: number;
  offsetY: number;
};

type ResizeDirection = 'right' | 'bottom' | 'corner';

type ResizeState = {
  nodeId: string;
  direction: ResizeDirection;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

type InfoRow = {
  label: string;
  value: string;
  color?: string;
};

type NodeQuantity = {
  resId?: string;
  workDate?: string;
  totalQty?: number;
  totalOk?: number;
  totalNg?: number;
};

type NodeDownTime = {
  resId?: string;
  downTime?: number;
};

const alarmGroupPrefixes = ['USC', 'FTR', 'ISM', 'AGB', 'PFL'];

type StatusConfig = {
  label: string;
  color: string;
};

const statusConfig: Record<NodeStatus, StatusConfig> = {
  run: { label: t('Run'), color: '#00b884' },
  idle: { label: t('Idle'), color: '#ffca1a' },
  down: { label: t('Down'), color: '#ff625a' },
  power_off: { label: t('Power OFF'), color: '#c6c6c6' },
  disconnection: { label: t('Disconnection'), color: '#7c8384' },
};

const modeConfig: Record<NodeMode, StatusConfig> = {
  remote: { label: t('Remote'), color: '#c9d95b' },
  local: { label: t('Local'), color: '#a8d8cc' },
  offline: { label: t('Offline'), color: '#c7c7c7' },
};

const modePositionOptions: { value: NodeModePosition; label: string }[] = [
  { value: 'top', label: t('Top') },
  { value: 'right', label: t('Right') },
  { value: 'bottom', label: t('Bottom') },
  { value: 'left', label: t('Left') },
  { value: 'hidden', label: t('Hidden') },
];

const MIN_NODE_WIDTH = 20;
const MIN_NODE_HEIGHT = 20;
const LAYOUT_REFRESH_INTERVAL = 5 * 1000;

const Page = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    min-height: calc(100vh - 96px);
    color: #f2f4f8;
    background: #191b20;
    padding: ${theme.sizeUnit * 4}px;

    &:fullscreen {
      min-height: 100vh;
      margin: 0;
      padding: ${theme.sizeUnit * 4}px;
      overflow: auto;
    }
  `}
`;

const Header = styled.div`
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  align-items: center;
  gap: 16px;
`;

const Title = styled.h1`
  margin: 0;
  text-align: center;
  font-size: 30px;
  line-height: 38px;
  font-weight: 700;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`;

const SummaryBar = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  font-size: 17px;
  font-weight: 600;
`;

const SummaryGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const SummaryTitle = styled.span`
  color: #d8d8d8;
  font-size: 21px;
`;

const SummaryItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const Swatch = styled.span<{ color: string }>`
  ${({ color }) => css`
    width: 16px;
    height: 12px;
    border-radius: 3px;
    background: ${color};
  `}
`;

const Count = styled.span`
  min-width: 40px;
  padding: 2px 8px;
  text-align: right;
  background: #282b36;
  color: #f7f7f7;
  font-size: 20px;
`;

const Main = styled.div<{ $panelVisible: boolean }>`
  ${({ $panelVisible }) => css`
    display: grid;
    grid-template-columns: ${$panelVisible ? 'minmax(0, 1fr) 320px' : '1fr'};
    gap: 16px;
    align-items: start;
  `}
`;

const MapViewport = styled.div`
  overflow: auto;
  min-height: 560px;
  border: 1px solid #3d414b;
  // background:
  //   linear-gradient(#24272e 1px, transparent 1px),
  //   linear-gradient(90deg, #24272e 1px, transparent 1px),
  //   #191b20;
  background-size: 24px 24px;
`;

const MapSurface = styled.div<{ width: number; height: number }>`
  ${({ width, height }) => css`
    position: relative;
    width: ${width}px;
    height: ${height}px;
    min-width: 100%;
  `}
`;

const InfoPopup = styled.div`
  ${() => css`
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 5;
    width: 650px;
    max-width: calc(100% - 32px);
    border: 2px solid #d9d9d9;
    background: #030303;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.45);
  `}
`;

const InfoHeader = styled.div`
  display: flex;
  height: 34px;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px 0 10px;
  background: #2f82c8;
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
`;

const InfoCloseButton = styled.button`
  width: 20px;
  height: 20px;
  border: 1px solid #b8b8b8;
  background: #f2f2f2;
  color: #777777;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  line-height: 16px;
  padding: 0;
`;

const InfoTable = styled.dl`
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  margin: 0;
  color: #f0f0f0;
  font-size: 15px;
  font-weight: 700;

  dt,
  dd {
    min-height: 32px;
    margin: 0;
    padding: 8px 20px;
    border-top: 1px solid #202020;
  }

  dt {
    color: #e7e7e7;
  }

  dd {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const FactoryNodeBox = styled.button<{
  nodeStatus: NodeStatus;
  nodeType: NodeType;
  selected: boolean;
  $isDelayed: boolean;
}>`
  ${({ nodeStatus, nodeType, selected, $isDelayed }) => css`
    position: absolute;
    border: ${selected ? '3px solid #ffffff' : '2px solid #d5d7dc'};
    background: ${nodeType === 'area'
      ? 'transparent'
      : statusConfig[nodeStatus].color};
    color: ${nodeStatus === 'idle' || nodeStatus === 'power_off'
      ? '#101216'
      : '#050505'};
    box-shadow: ${selected ? '0 0 0 3px rgba(64, 169, 255, 0.45)' : 'none'};
    cursor: pointer;
    font-weight: 700;
    padding: 0;
    overflow: visible;
    box-sizing: border-box;
    outline: ${$isDelayed ? '10px solid #ff2f2f' : 'none'};
    outline-offset: 2px;
    animation: ${$isDelayed
      ? 'factory-delay-border-pulse 1s ease-in-out infinite'
      : 'none'};

    @keyframes factory-delay-border-pulse {
      0%,
      100% {
        outline-color: rgba(255, 47, 47, 1);
        box-shadow: ${selected
      ? '0 0 0 3px rgba(64, 169, 255, 0.45), 0 0 0 0 rgba(255, 47, 47, 0)'
      : '0 0 0 0 rgba(255, 47, 47, 0)'};
      }

      50% {
        outline-color: rgba(255, 47, 47, 0.25);
        box-shadow: ${selected
      ? '0 0 0 3px rgba(64, 169, 255, 0.45), 0 0 0 7px rgba(255, 47, 47, 0.65)'
      : '0 0 0 7px rgba(255, 47, 47, 0.65)'};
      }
    }
  `}
`;

const NodeLabel = styled.span<{ nodeType: NodeType }>`
  ${({ nodeType }) => css`
    display: flex;
    width: 100%;
    height: 100%;
    align-items: ${nodeType === 'area' ? 'flex-start' : 'center'};
    justify-content: center;
    text-align: center;
    white-space: pre-line;
    line-height: 18px;
    padding: ${nodeType === 'area' ? '8px 8px 4px' : '4px 8px'};
    color: ${nodeType === 'area' ? '#ffffff' : 'inherit'};
    box-sizing: border-box;
  `}
`;

const ModeBadge = styled.span<{
  mode: NodeMode;
  $position: Exclude<NodeModePosition, 'hidden'>;
  $widthPercent: number;
}>`
  ${({ mode, $position, $widthPercent }) => css`
    position: absolute;
    width: ${$widthPercent}%;
    height: 20px;
    padding: 1px 6px;
    border: 2px solid #d5d7dc;
    background: ${modeConfig[mode].color};
    color: #111317;
    font-size: 11px;
    line-height: 16px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${$position === 'top' &&
    `
      left: 0;
      top: -22px;
    `}

    ${$position === 'right' &&
    `
      left: calc(100% + 2px);
      top: -2px;
    `}

    ${$position === 'bottom' &&
    `
      left: 0;
      bottom: -22px;
    `}

    ${$position === 'left' &&
    `
      right: calc(100% + 2px);
      top: -2px;
    `}
  `}
`;

const ResizeHandle = styled.span<{ $direction: ResizeDirection }>`
  ${({ $direction }) => css`
    position: absolute;
    z-index: 2;
    display: block;
    border: 1px solid #1677ff;
    background: #ffffff;
    box-shadow: 0 0 0 1px rgba(22, 119, 255, 0.35);

    ${$direction === 'right' &&
    `
      top: 8px;
      right: -6px;
      width: 10px;
      height: calc(100% - 16px);
      cursor: ew-resize;
    `}

    ${$direction === 'bottom' &&
    `
      left: 8px;
      bottom: -6px;
      width: calc(100% - 16px);
      height: 10px;
      cursor: ns-resize;
    `}

    ${$direction === 'corner' &&
    `
      right: -7px;
      bottom: -7px;
      width: 13px;
      height: 13px;
      cursor: nwse-resize;
    `}
  `}
`;

const Panel = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid #3d414b;
  background: #20232b;
  max-height: calc(100vh - 156px);
  overflow: auto;
`;

const PanelTitle = styled.h2`
  margin: 0;
  color: #f4f4f4;
  font-size: 18px;
  line-height: 24px;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #c9ccd3;
  font-size: 12px;
`;

const FullField = styled(Field)`
  grid-column: 1 / -1;
`;

const AlarmGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
`;

const AlarmTable = styled.div`
  background: #20232b;
  border: 1px solid #303540;
`;

const AlarmTitle = styled.div`
  padding: 8px 10px;
  color: #f0f0f0;
  font-size: 21px;
  font-weight: 700;
  text-align: center;
`;

const AlarmRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 92px;
  align-items: center;
  padding: 6px 10px;
  border-top: 1px solid #343946;
  color: #dcdde1;
  font-size: 16px;
  text-align: center;
`;

const AlarmEqmCell = styled.span`
  color: #e05c67;
  font-weight: 700;
`;

const EmptySelection = styled.div`
  color: #aeb4bf;
  line-height: 20px;
`;

const selectOptions = <T extends string>(config: Record<T, StatusConfig>) =>
  Object.entries(config).map(([value, item]) => ({
    value,
    label: (item as StatusConfig).label,
  }));

const createNode = (index: number): FactoryNode => ({
  id: `node-${Date.now()}`,
  deviceId: `EQM#${index + 1}`,
  deviceCode: `EQM#${index + 1}`,
  label: `EQM#${index + 1}`,
  type: 'equipment',
  x: 80 + (index % 6) * 18,
  y: 80 + (index % 6) * 18,
  width: 120,
  height: 54,
  status: 'run',
  mode: 'remote',
  modePosition: 'top',
  modeWidthPercent: 100,
  delayTime: null,
  details: {
    RES_ID: `EQM#${index + 1}`,
    STATUS: 'RUN',
    RECIPE: '',
    DOWN_CODE: '',
    DOWN_DESC: '',
    ALARM_ID: '',
    ALARM_DESC: '',
    DOWN_DATE: '',
    EQM: `EQM#${index + 1}`,
    Area: 'Factory',
  },
});

const copyNode = (
  node: FactoryNode,
  layout: FactoryLayout,
): FactoryNode => {
  const label = `${getNodeDisplayLabel(node)} Copy`;
  const id = `${node.id}-copy-${Date.now()}`;
  return {
    ...node,
    id,
    deviceId: node.deviceId ? `${node.deviceId}-COPY` : '',
    deviceCode: node.deviceCode ? `${node.deviceCode}-COPY` : id,
    label,
    x: clamp(node.x + 24, 0, Math.max(0, layout.width - node.width)),
    y: clamp(node.y + 24, 0, Math.max(0, layout.height - node.height)),
    delayTime: null,
    details: {
      ...normalizeNodeDetails(node),
      RES_ID: label,
      EQM: label,
    },
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getNodeCounts(nodes: FactoryNode[], key: 'status' | 'mode') {
  return nodes.reduce<Record<string, number>>((acc, node) => {
    if (node.type === 'area') {
      return acc;
    }
    acc[node[key]] = (acc[node[key]] || 0) + 1;
    return acc;
  }, {});
}

function normalizeNumber(value: number | string | null, fallback: number) {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getModePosition(node: FactoryNode): NodeModePosition {
  return node.modePosition || 'top';
}

function getModeWidthPercent(node: FactoryNode): number {
  return node.modeWidthPercent ?? 100;
}

function getStatusLabel(status: NodeStatus): string {
  return statusConfig[status].label.toUpperCase();
}

function formatFactoryDateTime(value: string): string {
  if (/^\d{14,}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(
      6,
      8,
    )} ${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
  }
  return value;
}

function getNodeDisplayLabel(node: FactoryNode): string {
  return node.label || node.deviceCode || node.id;
}

function getNodeDeviceCode(node: FactoryNode): string {
  return (
    node.deviceCode ||
    getDetailValue(node, ['DEVICE_CODE', 'Device Code', 'device_code']) ||
    getNodeDisplayLabel(node)
  );
}

function getNodeQuantityDeviceId(node: FactoryNode): string {
  return (
    node.deviceId ||
    node.deviceCode ||
    getDetailValue(node, ['RES_ID', 'res_id']) ||
    ''
  ).trim();
}

function formatQuantity(value: string): string {
  const normalizedValue = value.replace(/,/g, '').trim();
  if (!normalizedValue) {
    return '';
  }
  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue)
    ? numericValue.toLocaleString('en-US')
    : value;
}

function formatRate(totalOk?: number, totalQty?: number): string {
  if (totalOk === undefined || totalQty === undefined || totalQty <= 0) {
    return '';
  }
  return `${((totalOk / totalQty) * 100).toFixed(2)}%`;
}

function getNodeDelayTime(node: FactoryNode): number | undefined {
  const rawValue =
    node.delayTime ?? getDetailValue(node, ['DELAY_TIME', 'delay_time']);
  if (rawValue === null || rawValue === '') {
    return undefined;
  }
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : undefined;
}

function isNodeDelayed(node: FactoryNode): boolean {
  const delayTime = getNodeDelayTime(node);
  return node.type === 'equipment' && delayTime !== undefined;
}

function formatDelayTime(node: FactoryNode): string {
  const delayTime = getNodeDelayTime(node);
  return delayTime === undefined ? '' : delayTime.toFixed(2);
}

// Format down time as "600 (s) → 10.00 (m)"
function formatDownTime(seconds: number): string {
  const s = Math.round(seconds);
  const m = (seconds / 60).toFixed(2);
  return `${s.toLocaleString('en-US')} (s) → ${m} (m)`;
}

function getQuantityInfoRows(
  node: FactoryNode,
  quantity?: NodeQuantity,
  downTime?: NodeDownTime,
): InfoRow[] {
  return [
    {
      label: 'TOTAL CELL',
      value: formatQuantity(
        quantity?.totalQty !== undefined
          ? String(quantity.totalQty)
          : getDetailValue(node, [
            'TOTAL_CELL',
            'Total Cell',
            'daily_output_qty',
          ]),
      ),
      color: '#008a3d',
    },
    {
      label: 'TOTAL CELL OK',
      value: formatQuantity(
        quantity?.totalOk !== undefined
          ? String(quantity.totalOk)
          : getDetailValue(node, ['TOTAL_CELL_OK', 'Total Cell OK']),
      ),
      color: '#008a3d',
    },
    {
      label: 'TOTAL CELL NG',
      value: formatQuantity(
        quantity?.totalNg !== undefined
          ? String(quantity.totalNg)
          : getDetailValue(node, [
            'TOTAL_CELL_NG',
            'Total Cell NG',
            'daily_ng_qty',
          ]),
      ),
      color: '#e05c67',
    },
    {
      label: 'YIELD',
      value: formatRate(quantity?.totalOk, quantity?.totalQty),
      color: '#ffca1a',
    },
    {
      label: 'DOWN TIME',
      value:
        downTime?.downTime !== undefined
          ? formatDownTime(downTime.downTime)
          : '',
    },
    {
      label: 'DELAY_TIME (S)',
      value: formatDelayTime(node),
      color: isNodeDelayed(node) ? '#ff625a' : undefined,
    },
  ];
}

function getAlarmGroupName(alarm: FactoryAlarm): string {
  if (alarm.groupName) {
    return alarm.groupName;
  }
  const upperEqm = alarm.eqm.toUpperCase();
  return (
    alarmGroupPrefixes.find(prefix => upperEqm.startsWith(prefix)) ||
    upperEqm.slice(0, 3) ||
    'OTHER'
  );
}

function getDetailValue(node: FactoryNode, keys: string[], fallback = ''): string {
  const details = node.details || {};
  const matchedKey = keys.find(key => details[key] !== undefined);
  if (matchedKey) {
    const value = details[matchedKey];
    return value === null ? '' : String(value);
  }
  return fallback;
}

function normalizeNodeDetails(node: FactoryNode): FactoryNode['details'] {
  return {
    RES_ID: getDetailValue(
      node,
      ['RES_ID', 'EQM', 'res_id'],
      getNodeDisplayLabel(node),
    ),
    STATUS: getDetailValue(node, ['STATUS', 'Status', 'status'], getStatusLabel(node.status)),
    RECIPE: getDetailValue(node, ['RECIPE', 'Recipe', 'recipe']),
    DOWN_CODE: getDetailValue(node, [
      'DOWN_CODE',
      'Down Code',
      'Alarm Code',
      'alarm_code',
    ]),
    DOWN_DESC: getDetailValue(node, ['DOWN_DESC', 'Down Desc', 'down_desc']),
    ALARM_ID: getDetailValue(node, ['ALARM_ID', 'Alarm ID', 'alarm_id']),
    ALARM_DESC: getDetailValue(node, ['ALARM_DESC', 'Alarm Desc', 'alarm_desc']),
    DOWN_DATE: getDetailValue(node, ['DOWN_DATE', 'Down Date', 'down_date']),
    ...node.details,
  };
}

function normalizeLayout(layout: FactoryLayout): FactoryLayout {
  return {
    ...layout,
    alarms: layout.alarms || [],
    nodes: layout.nodes.map(node => ({
      ...node,
      modePosition: getModePosition(node),
      modeWidthPercent: getModeWidthPercent(node),
      details: normalizeNodeDetails(node),
    })),
  };
}

function getInfoRows(
  node: FactoryNode,
  quantity?: NodeQuantity,
  downTime?: NodeDownTime,
): InfoRow[] {
  if (node.status === 'run') {
    return [
      {
        label: 'RES_ID',
        value: getNodeDeviceCode(node),
      },
      {
        label: 'STATUS',
        value: getDetailValue(node, ['STATUS', 'Status', 'status'], 'RUN'),
      },
      {
        label: 'RECIPE',
        value: getDetailValue(node, ['RECIPE', 'Recipe', 'recipe']),
      },
      ...getQuantityInfoRows(node, quantity, downTime),
    ];
  }

  return [
    {
      label: 'RES_ID',
      value: getNodeDeviceCode(node),
    },
    {
      label: 'DOWN_CODE',
      value: getDetailValue(node, [
        'DOWN_CODE',
        'Down Code',
        'Alarm Code',
        'alarm_code',
      ]),
    },
    {
      label: 'DOWN_DESC',
      value: getDetailValue(node, ['DOWN_DESC', 'Down Desc', 'down_desc']),
    },
    {
      label: 'ALARM_ID',
      value: getDetailValue(node, ['ALARM_ID', 'Alarm ID', 'alarm_id']),
    },
    {
      label: 'ALARM_DESC',
      value: getDetailValue(node, ['ALARM_DESC', 'Alarm Desc', 'alarm_desc']),
    },
    {
      label: 'DOWN_DATE',
      value: formatFactoryDateTime(
        getDetailValue(node, ['DOWN_DATE', 'Down Date', 'down_date']),
      ),
    },
    {
      label: 'RECIPE',
      value: getDetailValue(node, ['RECIPE', 'Recipe', 'recipe']),
    },
    ...getQuantityInfoRows(node, quantity, downTime),
  ];
}

function FactoryStatus({ user }: { user: UserWithPermissionsAndRoles }) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const canEdit = isUserAdmin(user);
  const pageRef = useRef<HTMLDivElement>(null);
  const infoNodeRef = useRef<FactoryNode | null>(null);
  const loadingLayoutRef = useRef(false);
  const [layout, setLayout] = useState<FactoryLayout>({
    name: 'default',
    width: 1840,
    height: 760,
    nodes: [],
    alarms: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingStatus, setSyncingStatus] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(canEdit);
  const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
  const [nodeQuantities, setNodeQuantities] = useState<
    Record<string, NodeQuantity>
  >({});
  const [nodeDownTimes, setNodeDownTimes] = useState<
    Record<string, NodeDownTime>
  >({});

  const selectedNode = useMemo(
    () => layout.nodes.find(node => node.id === selectedNodeId) || null,
    [layout.nodes, selectedNodeId],
  );
  const infoNode = useMemo(
    () => layout.nodes.find(node => node.id === infoNodeId) || null,
    [layout.nodes, infoNodeId],
  );

  useEffect(() => {
    infoNodeRef.current = infoNode;
  }, [infoNode]);

  const statusCounts = useMemo(
    () => getNodeCounts(layout.nodes, 'status'),
    [layout.nodes],
  );
  const modeCounts = useMemo(
    () => getNodeCounts(layout.nodes, 'mode'),
    [layout.nodes],
  );

  const alarmGroups = useMemo(() => {
    const alarms = layout.alarms || [];
    return alarmGroupPrefixes.map(prefix => ({
      prefix,
      rows: alarms
        .filter(alarm => getAlarmGroupName(alarm).toUpperCase() === prefix)
        .sort((left, right) => {
          if (right.alarmCount !== left.alarmCount) {
            return right.alarmCount - left.alarmCount;
          }
          const eqmCompare = left.eqm.localeCompare(right.eqm);
          if (eqmCompare !== 0) {
            return eqmCompare;
          }
          return left.alarmCode.localeCompare(right.alarmCode);
        })
        .slice(0, 3),
    }));
  }, [layout.alarms]);

  const loadLayout = useCallback(
    (options: { selectFirstNode?: boolean; showError?: boolean } = {}) => {
      if (loadingLayoutRef.current) {
        return Promise.resolve();
      }

      loadingLayoutRef.current = true;
      return SupersetClient.get({ endpoint: '/api/v1/factory_status/' })
        .then(({ json }) => {
          const normalizedLayout = normalizeLayout(json.result);
          setLayout(normalizedLayout);
          if (options.selectFirstNode && normalizedLayout.nodes[0]) {
            setSelectedNodeId(normalizedLayout.nodes[0].id);
          }
        })
        .catch(() => {
          if (options.showError) {
            addDangerToast(t('Failed to load factory status layout'));
          }
        })
        .finally(() => {
          loadingLayoutRef.current = false;
        });
    },
    [addDangerToast],
  );

  useEffect(() => {
    loadLayout({ selectFirstNode: canEdit, showError: true }).finally(() =>
      setLoading(false),
    );
  }, [canEdit, loadLayout]);

  useEffect(() => {
    if (loading || editMode || dragState || resizeState || saving) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadLayout();
    }, LAYOUT_REFRESH_INTERVAL);

    return () => window.clearInterval(intervalId);
  }, [dragState, editMode, loadLayout, loading, resizeState, saving]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === pageRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!infoNodeId) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInfoNodeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [infoNodeId]);

  const saveLayout = useCallback(
    (
      nextLayout: FactoryLayout,
      options: { applyServerLayout?: boolean; showSuccess?: boolean } = {},
    ) => {
      const normalizedLayout = normalizeLayout(nextLayout);
      setSaving(true);
      return SupersetClient.put({
        endpoint: '/api/v1/factory_status/',
        jsonPayload: normalizedLayout,
      })
        .then(({ json }) => {
          if (options.applyServerLayout) {
            const serverLayout = normalizeLayout(json.result);
            setLayout(serverLayout);
          }
          if (options.showSuccess) {
            addSuccessToast(t('Factory status layout saved'));
          }
        })
        .catch(() => addDangerToast(t('Failed to save factory status layout')))
        .finally(() => setSaving(false));
    },
    [addDangerToast, addSuccessToast],
  );

  const loadNodeQuantity = useCallback(
    (node: FactoryNode) => {
      const deviceId = getNodeQuantityDeviceId(node);
      if (!deviceId) {
        return;
      }

      SupersetClient.post({
        endpoint: '/api/v1/factory_status/public/eapmes/node_quantity/',
        jsonPayload: { RES_ID: deviceId },
      })
        .then(({ json }) => {
          setNodeQuantities(prev => ({
            ...prev,
            [node.id]: json.result as NodeQuantity,
          }));
        })
        .catch(() => addDangerToast(t('Failed to load node quantity')));
    },
    [addDangerToast],
  );

  const loadNodeDownTime = useCallback(
    (node: FactoryNode) => {
      const deviceId = getNodeQuantityDeviceId(node);
      if (!deviceId) {
        return;
      }

      SupersetClient.post({
        endpoint: '/api/v1/factory_status/public/eapmes/node_down_time/',
        jsonPayload: { RES_ID: deviceId },
      })
        .then(({ json }) => {
          setNodeDownTimes(prev => ({
            ...prev,
            [node.id]: json.result as NodeDownTime,
          }));
        })
        .catch(() => addDangerToast(t('Failed to load node down time')));
    },
    [addDangerToast],
  );

  useEffect(() => {
    if (!infoNodeId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const currentInfoNode = infoNodeRef.current;
      if (!currentInfoNode || currentInfoNode.type === 'area') {
        return;
      }
      loadNodeQuantity(currentInfoNode);
      loadNodeDownTime(currentInfoNode);
    }, 5 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [infoNodeId, loadNodeDownTime, loadNodeQuantity]);

  const updateSelectedNode = (updates: Partial<FactoryNode>) => {
    if (!selectedNodeId) {
      return;
    }
    setLayout(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === selectedNodeId ? { ...node, ...updates } : node,
      ),
    }));
  };

  const handleAddNode = () => {
    const node = createNode(layout.nodes.length);
    setLayout(prev => ({ ...prev, nodes: [...prev.nodes, node] }));
    setSelectedNodeId(node.id);
    setEditMode(true);
  };

  const handleCopyNode = () => {
    if (!selectedNode) {
      return;
    }

    const node = copyNode(selectedNode, layout);
    setLayout(prev => ({ ...prev, nodes: [...prev.nodes, node] }));
    setSelectedNodeId(node.id);
    setInfoNodeId(null);
    setEditMode(true);
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) {
      return;
    }
    setLayout(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== selectedNodeId),
    }));
    if (infoNodeId === selectedNodeId) {
      setInfoNodeId(null);
    }
    setSelectedNodeId(null);
  };

  const handleSave = () => {
    saveLayout(layout, { applyServerLayout: true, showSuccess: true });
  };

  const handleApplyTemplate = () => {
    setSaving(true);
    SupersetClient.post({ endpoint: '/api/v1/factory_status/apply_template/' })
      .then(({ json }) => {
        setLayout(normalizeLayout(json.result));
        setSelectedNodeId(null);
        setInfoNodeId(null);
        setEditMode(false);
        addSuccessToast(t('Factory status template saved'));
      })
      .catch(() => addDangerToast(t('Failed to apply factory status template')))
      .finally(() => setSaving(false));
  };
  const showApplyTemplateButton = false;

  const handleFullscreenToggle = () => {
    if (document.fullscreenElement) {
      document
        .exitFullscreen()
        .catch(() => addDangerToast(t('Failed to exit fullscreen mode')));
      return;
    }

    pageRef.current
      ?.requestFullscreen()
      .catch(() => addDangerToast(t('Failed to enter fullscreen mode')));
  };

  const handleSyncStatus = () => {
    setSyncingStatus(true);
    SupersetClient.post({ endpoint: '/api/v1/factory_status/sync_status/' })
      .then(({ json }) => {
        setLayout(normalizeLayout(json.result.layout));
        setSelectedNodeId(null);
        setInfoNodeId(null);
        addSuccessToast(
          t(
            'Factory status synced: %s updated, %s skipped',
            json.result.updated,
            json.result.skipped,
          ),
        );
      })
      .catch(() => addDangerToast(t('Failed to sync factory status')))
      .finally(() => setSyncingStatus(false));
  };

  const handleNodeMouseDown = (
    event: MouseEvent<HTMLButtonElement>,
    node: FactoryNode,
  ) => {
    setSelectedNodeId(node.id);
    if (!editMode) {
      return;
    }
    const parent = event.currentTarget.parentElement;
    if (!parent) {
      return;
    }
    const rect = parent.getBoundingClientRect();
    setDragState({
      nodeId: node.id,
      offsetX: event.clientX - rect.left - node.x,
      offsetY: event.clientY - rect.top - node.y,
    });
    setResizeState(null);
  };

  const handleResizeMouseDown = (
    event: MouseEvent<HTMLSpanElement>,
    node: FactoryNode,
    direction: ResizeDirection,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setResizeState({
      nodeId: node.id,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: node.width,
      startHeight: node.height,
    });
    setDragState(null);
  };

  const handleNodeClick = (node: FactoryNode) => {
    setSelectedNodeId(node.id);
    if (node.type === 'area') {
      setInfoNodeId(null);
      return;
    }
    setInfoNodeId(node.id);
    loadNodeQuantity(node);
    loadNodeDownTime(node);
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (resizeState && editMode) {
      setLayout(prev => ({
        ...prev,
        nodes: prev.nodes.map(node => {
          if (node.id !== resizeState.nodeId) {
            return node;
          }

          const widthDelta = event.clientX - resizeState.startX;
          const heightDelta = event.clientY - resizeState.startY;
          const canResizeWidth =
            resizeState.direction === 'right' ||
            resizeState.direction === 'corner';
          const canResizeHeight =
            resizeState.direction === 'bottom' ||
            resizeState.direction === 'corner';

          return {
            ...node,
            width: canResizeWidth
              ? clamp(
                resizeState.startWidth + widthDelta,
                MIN_NODE_WIDTH,
                Math.max(MIN_NODE_WIDTH, prev.width - node.x),
              )
              : node.width,
            height: canResizeHeight
              ? clamp(
                resizeState.startHeight + heightDelta,
                MIN_NODE_HEIGHT,
                Math.max(MIN_NODE_HEIGHT, prev.height - node.y),
              )
              : node.height,
          };
        }),
      }));
      return;
    }

    if (!dragState || !editMode) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setLayout(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === dragState.nodeId
          ? {
            ...node,
            x: clamp(
              event.clientX - rect.left - dragState.offsetX,
              0,
              prev.width - node.width,
            ),
            y: clamp(
              event.clientY - rect.top - dragState.offsetY,
              0,
              prev.height - node.height,
            ),
          }
          : node,
      ),
    }));
  };

  if (loading) {
    return <Page>{t('Loading...')}</Page>;
  }

  return (
    <Page ref={pageRef}>
      <Header>
        <Title>{t('Facility Status')}</Title>
        <Toolbar>
          {canEdit && (
            <Button
              buttonStyle="secondary"
              onClick={() => setIsPanelVisible(value => !value)}
            >
              {isPanelVisible ? (
                <Icons.MenuFoldOutlined iconSize="m" />
              ) : (
                <Icons.MenuUnfoldOutlined iconSize="m" />
              )}{' '}
              {isPanelVisible ? t('Hide panel') : t('Show panel')}
            </Button>
          )}
          <Button buttonStyle="secondary" onClick={handleFullscreenToggle}>
            {isFullscreen ? (
              <Icons.FullscreenExitOutlined iconSize="m" />
            ) : (
              <Icons.FullscreenOutlined iconSize="m" />
            )}{' '}
            {isFullscreen ? t('Exit fullscreen') : t('Fullscreen')}
          </Button>
          {canEdit && (
            <Button
              buttonStyle="secondary"
              onClick={handleSyncStatus}
              disabled={syncingStatus || saving}
            >
              <Icons.SyncOutlined iconSize="m" spin={syncingStatus} />{' '}
              {syncingStatus ? t('Syncing...') : t('Sync Status')}
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                buttonStyle={editMode ? 'primary' : 'secondary'}
                onClick={() => setEditMode(value => !value)}
              >
                <Icons.EditOutlined iconSize="m" /> {t('Edit')}
              </Button>
              <Button buttonStyle="secondary" onClick={handleAddNode}>
                <Icons.PlusOutlined iconSize="m" /> {t('Node')}
              </Button>
              {showApplyTemplateButton && (
                <Button
                  buttonStyle="secondary"
                  onClick={handleApplyTemplate}
                  disabled={saving}
                >
                  <Icons.CopyOutlined iconSize="m" /> {t('Apply template')}
                </Button>
              )}
              <Button
                buttonStyle="primary"
                onClick={handleSave}
                disabled={saving}
              >
                <Icons.SaveOutlined iconSize="m" />{' '}
                {saving ? t('Saving...') : t('Save')}
              </Button>
            </>
          )}
        </Toolbar>
      </Header>

      <SummaryBar>
        <SummaryGroup>
          <SummaryTitle>{t('Equipment Status')}</SummaryTitle>
          {Object.entries(statusConfig).map(([status, config]) => (
            <SummaryItem key={status}>
              <Swatch color={config.color} />
              {config.label}
              <Count>{statusCounts[status] || 0}</Count>
            </SummaryItem>
          ))}
        </SummaryGroup>
        <SummaryGroup>
          <SummaryTitle>{t('Equipment Mode')}</SummaryTitle>
          {Object.entries(modeConfig).map(([mode, config]) => (
            <SummaryItem key={mode}>
              <Swatch color={config.color} />
              {config.label}
              <Count>{modeCounts[mode] || 0}</Count>
            </SummaryItem>
          ))}
        </SummaryGroup>
      </SummaryBar>

      <Main $panelVisible={canEdit && isPanelVisible}>
        <MapViewport>
          <MapSurface
            width={layout.width}
            height={layout.height}
            onMouseMove={handleMouseMove}
            onMouseUp={() => {
              setDragState(null);
              setResizeState(null);
            }}
            onMouseLeave={() => {
              setDragState(null);
              setResizeState(null);
            }}
          >
            {layout.nodes.map(node => (
              <Tooltip
                key={node.id}
                title={
                  isNodeDelayed(node)
                    ? t(
                      '%s delay: %s s',
                      node.label || getNodeDeviceCode(node),
                      formatDelayTime(node),
                    )
                    : node.label || ''
                }
              >
                <FactoryNodeBox
                  type="button"
                  nodeStatus={node.status}
                  nodeType={node.type}
                  selected={node.id === selectedNodeId}
                  $isDelayed={isNodeDelayed(node)}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                  }}
                  onMouseDown={event => handleNodeMouseDown(event, node)}
                  onClick={() => handleNodeClick(node)}
                >
                  {node.type !== 'label' &&
                    getModePosition(node) !== 'hidden' && (
                      <ModeBadge
                        mode={node.mode}
                        $position={
                          getModePosition(node) as Exclude<
                            NodeModePosition,
                            'hidden'
                          >
                        }
                        $widthPercent={getModeWidthPercent(node)}
                      >
                        {modeConfig[node.mode].label}
                      </ModeBadge>
                    )}
                  <NodeLabel nodeType={node.type}>{node.label || ''}</NodeLabel>
                  {canEdit &&
                    editMode &&
                    node.id === selectedNodeId &&
                    (['right', 'bottom', 'corner'] as const).map(direction => (
                      <ResizeHandle
                        key={direction}
                        $direction={direction}
                        aria-hidden="true"
                        onClick={event => event.stopPropagation()}
                        onMouseDown={event =>
                          handleResizeMouseDown(event, node, direction)
                        }
                      />
                    ))}
                </FactoryNodeBox>
              </Tooltip>
            ))}
            {infoNode && (
              <InfoPopup>
                <InfoHeader>
                  <span>{t('Information')}</span>
                  <InfoCloseButton
                    type="button"
                    aria-label={t('Close')}
                    onClick={() => setInfoNodeId(null)}
                  >
                    x
                  </InfoCloseButton>
                </InfoHeader>
                <InfoTable>
                  {getInfoRows(
                    infoNode,
                    nodeQuantities[infoNode.id],
                    nodeDownTimes[infoNode.id],
                  ).map(row => (
                    <Fragment key={row.label}>
                      <dt style={{ color: row.color }}>{row.label}</dt>
                      <dd style={{ color: row.color }}>{row.value}</dd>
                    </Fragment>
                  ))}
                </InfoTable>
              </InfoPopup>
            )}
          </MapSurface>
        </MapViewport>

        {canEdit && isPanelVisible && (
          <Panel>
            <PanelTitle>{t('Factory')}</PanelTitle>
            <FieldGrid>
              <Field>
                {t('Width')}
                <InputNumber
                  min={400}
                  disabled={!canEdit || !editMode}
                  value={layout.width}
                  onChange={value =>
                    setLayout(prev => ({
                      ...prev,
                      width: normalizeNumber(value, prev.width),
                    }))
                  }
                />
              </Field>
              <Field>
                {t('Height')}
                <InputNumber
                  min={300}
                  disabled={!canEdit || !editMode}
                  value={layout.height}
                  onChange={value =>
                    setLayout(prev => ({
                      ...prev,
                      height: normalizeNumber(value, prev.height),
                    }))
                  }
                />
              </Field>
            </FieldGrid>

            <PanelTitle>{t('Device')}</PanelTitle>
            {selectedNode ? (
              <>
                <FieldGrid>
                  <FullField>
                    {t('Name')}
                    <Input
                      disabled={!canEdit || !editMode}
                      value={selectedNode.label || ''}
                      onChange={event =>
                        updateSelectedNode({
                          label: event.target.value || null,
                        })
                      }
                    />
                  </FullField>
                  <FullField>
                    {t('Device code')}
                    <Input
                      disabled={!canEdit || !editMode}
                      value={selectedNode.deviceCode || ''}
                      onChange={event =>
                        updateSelectedNode({ deviceCode: event.target.value })
                      }
                    />
                  </FullField>
                  <Field>
                    {t('Type')}
                    <Select
                      disabled={!canEdit || !editMode}
                      value={selectedNode.type}
                      options={[
                        { value: 'equipment', label: t('Equipment') },
                        { value: 'area', label: t('Area') },
                        { value: 'label', label: t('Label') },
                      ]}
                      onChange={value =>
                        updateSelectedNode({ type: value as NodeType })
                      }
                    />
                  </Field>
                  <Field>
                    {t('Status')}
                    <Select
                      disabled={!canEdit || !editMode}
                      value={selectedNode.status}
                      options={selectOptions(statusConfig)}
                      onChange={value => {
                        const status = value as NodeStatus;
                        updateSelectedNode({
                          status,
                          details: {
                            ...normalizeNodeDetails(selectedNode),
                            STATUS: getStatusLabel(status),
                          },
                        });
                      }}
                    />
                  </Field>
                  <Field>
                    {t('Mode')}
                    <Select
                      disabled={!canEdit || !editMode}
                      value={selectedNode.mode}
                      options={selectOptions(modeConfig)}
                      onChange={value =>
                        updateSelectedNode({ mode: value as NodeMode })
                      }
                    />
                  </Field>
                  <Field>
                    {t('Mode position')}
                    <Select
                      disabled={!canEdit || !editMode}
                      value={getModePosition(selectedNode)}
                      options={modePositionOptions}
                      onChange={value =>
                        updateSelectedNode({
                          modePosition: value as NodeModePosition,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    {t('Mode width (%)')}
                    <InputNumber
                      min={10}
                      max={300}
                      disabled={!canEdit || !editMode}
                      value={getModeWidthPercent(selectedNode)}
                      onChange={value =>
                        updateSelectedNode({
                          modeWidthPercent: normalizeNumber(
                            value,
                            getModeWidthPercent(selectedNode),
                          ),
                        })
                      }
                    />
                  </Field>
                  {(['x', 'y', 'width', 'height'] as const).map(field => (
                    <Field key={field}>
                      {field.toUpperCase()}
                      <InputNumber
                        min={field === 'width' || field === 'height' ? 20 : 0}
                        disabled={!canEdit || !editMode}
                        value={selectedNode[field]}
                        onChange={value =>
                          updateSelectedNode({
                            [field]: normalizeNumber(
                              value,
                              selectedNode[field],
                            ),
                          })
                        }
                      />
                    </Field>
                  ))}
                </FieldGrid>
                {canEdit && editMode && (
                  <>
                    <Button buttonStyle="secondary" onClick={handleCopyNode}>
                      <Icons.CopyOutlined iconSize="m" /> {t('Copy node')}
                    </Button>
                    <Button buttonStyle="danger" onClick={handleDeleteNode}>
                      <Icons.DeleteOutlined iconSize="m" /> {t('Delete node')}
                    </Button>
                  </>
                )}
              </>
            ) : (
              <EmptySelection>
                {t('Select a node to view device info')}
              </EmptySelection>
            )}
          </Panel>
        )}
      </Main>

      <AlarmGrid>
        {alarmGroups.map(group => (
          <AlarmTable key={group.prefix}>
            <AlarmTitle>
              {group.prefix} {t('EQM Alarm Worst 3')}
            </AlarmTitle>
            <AlarmRow>
              <strong>EQM</strong>
              <strong>MODEL</strong>
              <strong>{t('Alarm Code')}</strong>
              <strong>{t('Number')}</strong>
            </AlarmRow>
            {group.rows.map((alarm, index) => (
              <AlarmRow
                key={`${group.prefix}-${alarm.eqm}-${alarm.alarmCode}-${index}`}
              >
                <AlarmEqmCell>{alarm.eqm}</AlarmEqmCell>
                <span>{alarm.model || ''}</span>
                <span>{alarm.alarmCode}</span>
                <span>{alarm.alarmCount}</span>
              </AlarmRow>
            ))}
          </AlarmTable>
        ))}
      </AlarmGrid>
    </Page>
  );
}

export default FactoryStatus;
