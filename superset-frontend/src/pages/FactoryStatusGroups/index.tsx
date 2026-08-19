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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import { Button, Icons } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

type NodeStatus = 'run' | 'idle' | 'down' | 'power_off' | 'disconnection';
type NodeMode = 'remote' | 'local' | 'offline';
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
  details?: Record<string, string | number | boolean | null>;
};

type FactoryLayout = {
  name: string;
  width: number;
  height: number;
  nodes: FactoryNode[];
  updated_at?: string | null;
};

type StatusConfig = {
  label: string;
  color: string;
};

type DeviceGroup = {
  area: FactoryNode;
  devices: FactoryNode[];
};

const statusConfig: Record<NodeStatus, StatusConfig> = {
  run: { label: t('Run'), color: '#00b884' },
  idle: { label: t('Idle'), color: '#ffca1a' },
  down: { label: t('Down'), color: '#ff625a' },
  power_off: { label: t('Power Off'), color: '#b9b9b9' },
  disconnection: { label: t('Disconnection'), color: '#7c8384' },
};

const modeConfig: Record<NodeMode, StatusConfig> = {
  remote: { label: t('Remote'), color: '#c9d95b' },
  local: { label: t('Local'), color: '#a8d8cc' },
  offline: { label: t('Offline'), color: '#c7c7c7' },
};

const Page = styled.div`
  ${({ theme }) => css`
    display: flex;
    min-height: calc(100vh - 96px);
    flex-direction: column;
    gap: ${theme.sizeUnit * 4}px;
    padding: ${theme.sizeUnit * 2}px;
    background: #151922;
    color: #f4f4f4;
  `}
`;

const Header = styled.div`
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto;
  align-items: center;
  gap: 16px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  line-height: 38px;
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const SummaryBar = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  color: #d8d8d8;
  font-size: 17px;
  font-weight: 600;
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

const Main = styled.div<{ $detailVisible: boolean }>`
  ${({ $detailVisible }) => css`
    display: grid;
    grid-template-columns: ${$detailVisible ? 'minmax(0, 1fr) 420px' : '1fr'};
    gap: 16px;
    align-items: start;

    @media (max-width: 1120px) {
      grid-template-columns: 1fr;
    }
  `}
`;

const GroupGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
`;

const GroupButton = styled.button<{ $selected: boolean; $status: NodeStatus }>`
  ${({ $selected, $status }) => css`
    display: flex;
    min-height: 154px;
    flex-direction: column;
    justify-content: space-between;
    gap: 14px;
    padding: 16px;
    border: ${$selected ? '2px solid #ffffff' : '1px solid #3c4654'};
    border-left: 8px solid ${statusConfig[$status].color};
    border-radius: 8px;
    background: ${$selected ? '#242b38' : '#202632'};
    color: inherit;
    text-align: left;
    box-shadow: ${$selected ? '0 0 0 2px rgba(255,255,255,0.18)' : 'none'};
    cursor: pointer;

    &:hover {
      background: #28303d;
    }
  `}
`;

const GroupName = styled.span`
  display: block;
  font-size: 24px;
  font-weight: 700;
  line-height: 30px;
`;

const GroupMeta = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #cbd2dc;
  font-size: 15px;
`;

const StatusList = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const StatusPill = styled.span<{ color: string }>`
  ${({ color }) => css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border: 1px solid #3d4653;
    border-radius: 8px;
    background: #171c24;
    color: #eef2f7;
    font-size: 13px;

    &::before {
      display: block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${color};
      content: '';
    }
  `}
`;

const DetailPanel = styled.aside`
  display: flex;
  max-height: calc(100vh - 180px);
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  padding: 16px;
  border: 1px solid #3c4654;
  border-radius: 8px;
  background: #202632;
`;

const DetailHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const DetailTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  line-height: 28px;
`;

const DeviceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DeviceRow = styled.div<{ $status: NodeStatus }>`
  ${({ $status }) => css`
    display: grid;
    grid-template-columns: minmax(120px, 1.1fr) 96px 88px minmax(88px, 1fr);
    gap: 10px;
    align-items: center;
    padding: 10px;
    border: 1px solid #343d4a;
    border-left: 6px solid ${statusConfig[$status].color};
    border-radius: 8px;
    background: #171c24;
    font-size: 14px;

    @media (max-width: 520px) {
      grid-template-columns: 1fr;
    }
  `}
`;

const DeviceName = styled.span`
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 700;
`;

const Muted = styled.span`
  color: #aeb6c2;
`;

function getNodeDisplayLabel(node: FactoryNode): string {
  return node.label || node.deviceCode || node.deviceId || node.id;
}

function getDetailValue(
  node: FactoryNode,
  keys: string[],
  fallback = '',
): string {
  const details = node.details || {};
  const matchedKey = keys.find(key => details[key] !== undefined);
  if (!matchedKey) {
    return fallback;
  }
  const value = details[matchedKey];
  return value === null || value === undefined ? fallback : String(value);
}

function getDeviceCode(node: FactoryNode): string {
  return (
    node.deviceCode ||
    getDetailValue(node, ['RES_ID', 'EQM', 'DEVICE_CODE', 'device_code']) ||
    getNodeDisplayLabel(node)
  );
}

function normalizeLayout(layout: FactoryLayout): FactoryLayout {
  return {
    ...layout,
    nodes: layout.nodes.map(node => ({
      ...node,
      details: node.details || {},
    })),
  };
}

function containsDevice(area: FactoryNode, device: FactoryNode): boolean {
  const centerX = device.x + device.width / 2;
  const centerY = device.y + device.height / 2;
  return (
    centerX >= area.x &&
    centerX <= area.x + area.width &&
    centerY >= area.y &&
    centerY <= area.y + area.height
  );
}

function areaSize(area: FactoryNode): number {
  return area.width * area.height;
}

function getOwningArea(
  device: FactoryNode,
  areas: FactoryNode[],
): FactoryNode | undefined {
  return areas
    .filter(area => containsDevice(area, device))
    .sort((left, right) => areaSize(left) - areaSize(right))[0];
}

function buildDeviceGroups(nodes: FactoryNode[]): DeviceGroup[] {
  const areas = nodes.filter(node => node.type === 'area');
  const devices = nodes.filter(node => node.type === 'equipment');
  return areas.map(area => ({
    area,
    devices: devices.filter(
      device => getOwningArea(device, areas)?.id === area.id,
    ),
  }));
}

function getGroupStatus(devices: FactoryNode[]): NodeStatus {
  if (devices.some(device => device.status === 'down')) {
    return 'down';
  }
  if (devices.some(device => device.status === 'disconnection')) {
    return 'disconnection';
  }
  if (devices.some(device => device.status === 'power_off')) {
    return 'power_off';
  }
  if (devices.some(device => device.status === 'idle')) {
    return 'idle';
  }
  return 'run';
}

function getStatusCounts(devices: FactoryNode[]) {
  return devices.reduce<Record<NodeStatus, number>>(
    (acc, device) => ({
      ...acc,
      [device.status]: acc[device.status] + 1,
    }),
    {
      run: 0,
      idle: 0,
      down: 0,
      power_off: 0,
      disconnection: 0,
    },
  );
}

function FactoryStatusGroups({
  user: _user,
}: {
  user?: UserWithPermissionsAndRoles;
}) {
  const { addDangerToast } = useToasts();
  const [layout, setLayout] = useState<FactoryLayout>({
    name: 'default',
    width: 0,
    height: 0,
    nodes: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const groups = useMemo(() => buildDeviceGroups(layout.nodes), [layout.nodes]);
  const selectedGroup = useMemo(
    () => groups.find(group => group.area.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );
  const allDevices = useMemo(
    () => groups.flatMap(group => group.devices),
    [groups],
  );
  const summaryCounts = useMemo(
    () => getStatusCounts(allDevices),
    [allDevices],
  );

  const loadLayout = useCallback(
    (showSpinner = false) => {
      if (showSpinner) {
        setRefreshing(true);
      }
      return SupersetClient.get({ endpoint: '/api/v1/factory_status/' })
        .then(({ json }) => {
          setLayout(normalizeLayout(json.result as FactoryLayout));
        })
        .catch(() => addDangerToast(t('Failed to load factory status layout')))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [addDangerToast],
  );

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadLayout();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [loadLayout]);

  useEffect(() => {
    if (
      selectedGroupId &&
      !groups.some(group => group.area.id === selectedGroupId)
    ) {
      setSelectedGroupId(null);
    }
  }, [groups, selectedGroupId]);

  if (loading) {
    return <Page>{t('Loading...')}</Page>;
  }

  return (
    <Page>
      <Header>
        <Title>{t('Factory Status Groups')}</Title>
        <Toolbar>
          <Button
            buttonStyle="secondary"
            disabled={refreshing}
            onClick={() => loadLayout(true)}
          >
            <Icons.SyncOutlined iconSize="m" spin={refreshing} />{' '}
            {refreshing ? t('Refreshing...') : t('Refresh')}
          </Button>
        </Toolbar>
      </Header>

      <SummaryBar>
        <SummaryItem>
          {t('Groups')}: {groups.length}
        </SummaryItem>
        <SummaryItem>
          {t('Devices')}: {allDevices.length}
        </SummaryItem>
        {Object.entries(statusConfig).map(([status, config]) => (
          <SummaryItem key={status}>
            <Swatch color={config.color} />
            {config.label}: {summaryCounts[status as NodeStatus]}
          </SummaryItem>
        ))}
      </SummaryBar>

      <Main $detailVisible={Boolean(selectedGroup)}>
        <GroupGrid>
          {groups.map(group => {
            const status = getGroupStatus(group.devices);
            const counts = getStatusCounts(group.devices);
            return (
              <GroupButton
                key={group.area.id}
                type="button"
                $selected={group.area.id === selectedGroupId}
                $status={status}
                onClick={() => setSelectedGroupId(group.area.id)}
              >
                <span>
                  <GroupName>{getNodeDisplayLabel(group.area)}</GroupName>
                  <Muted>{statusConfig[status].label}</Muted>
                </span>
                <GroupMeta>
                  <span>
                    {group.devices.length} {t('devices')}
                  </span>
                  <span>
                    {
                      group.devices.filter(device => device.status === 'down')
                        .length
                    }{' '}
                    {t('down')}
                  </span>
                </GroupMeta>
                <StatusList>
                  {Object.entries(statusConfig)
                    .filter(
                      ([statusKey]) => counts[statusKey as NodeStatus] > 0,
                    )
                    .map(([statusKey, config]) => (
                      <StatusPill key={statusKey} color={config.color}>
                        {config.label}: {counts[statusKey as NodeStatus]}
                      </StatusPill>
                    ))}
                </StatusList>
              </GroupButton>
            );
          })}
        </GroupGrid>

        {selectedGroup && (
          <DetailPanel>
            <DetailHeader>
              <div>
                <DetailTitle>
                  {getNodeDisplayLabel(selectedGroup.area)}
                </DetailTitle>
                <Muted>
                  {selectedGroup.devices.length} {t('devices')}
                </Muted>
              </div>
              <Button
                buttonStyle="link"
                onClick={() => setSelectedGroupId(null)}
              >
                {t('Close')}
              </Button>
            </DetailHeader>

            <DeviceList>
              {selectedGroup.devices.map(device => (
                <DeviceRow key={device.id} $status={device.status}>
                  <DeviceName>{getDeviceCode(device)}</DeviceName>
                  <span>{statusConfig[device.status].label}</span>
                  <span>{modeConfig[device.mode].label}</span>
                  <Muted>
                    {getDetailValue(device, ['DOWN_CODE', 'Alarm Code']) ||
                      getDetailValue(device, ['ALARM_ID']) ||
                      '-'}
                  </Muted>
                </DeviceRow>
              ))}
              {selectedGroup.devices.length === 0 && (
                <Muted>{t('No devices in this group')}</Muted>
              )}
            </DeviceList>
          </DetailPanel>
        )}
      </Main>
    </Page>
  );
}

export default FactoryStatusGroups;
