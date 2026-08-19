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
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@apache-superset/core/translation';
import { styled, css } from '@apache-superset/core/theme';
import { Row, Col } from '@superset-ui/core/components';
import { Link } from 'react-router-dom';
import { DashboardMenuItem, TagType } from './useDashboardsMenu';

interface MyDashboardsMenuProps {
  dashboards: DashboardMenuItem[];
  onClose: () => void;
}

const Panel = styled.div`
  ${({ theme }) => css`
    background: ${theme.colorBgContainer};
  `}
`;

const GroupTitle = styled.div`
  ${({ theme }) => css`
    font-weight: 600;
    color: ${theme.colorText};
    margin-bottom: ${theme.sizeUnit * 2}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    padding-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const DashboardLink = styled(Link)`
  ${({ theme }) => css`
    display: block;
    margin-bottom: ${theme.sizeUnit * 2}px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `}
`;

function getTagGroups(dashboards: DashboardMenuItem[]) {
  const groups: {
    id: number;
    name: string;
    dashboards: DashboardMenuItem[];
  }[] = [];
  const others: DashboardMenuItem[] = [];

  dashboards.forEach(dashboard => {
    const customTags = (dashboard.tags || []).filter(
      tag => tag.type === TagType.custom,
    );
    if (customTags.length === 0) {
      others.push(dashboard);
      return;
    }

    customTags.forEach(tag => {
      let group = groups.find(g => g.name === tag.name);
      if (!group) {
        group = { id: tag.id, name: tag.name, dashboards: [] };
        groups.push(group);
      }
      group.dashboards.push(dashboard);
    });
  });

  groups.sort((a, b) => a.id - b.id);

  return { groups, others };
}

function MyDashboardsMenu({ dashboards, onClose }: MyDashboardsMenuProps) {
  const { groups, others } = useMemo(
    () => getTagGroups(dashboards),
    [dashboards],
  );

  return (
    <Panel>
      <Row gutter={[10, 24]}>
        {groups.map(group => (
          <Col span={6} key={group.name}>
            <GroupTitle>{group.name}</GroupTitle>
            {group.dashboards.map(dashboard => (
              <DashboardLink
                key={dashboard.id}
                to={dashboard.url}
                title={dashboard.title}
                onClick={onClose}
              >
                {dashboard.title}
              </DashboardLink>
            ))}
          </Col>
        ))}
        {others.length > 0 && (
          <Col span={6} key="others">
            <GroupTitle>{t('Other Dashboard')}</GroupTitle>
            {others.map(dashboard => (
              <DashboardLink
                key={dashboard.id}
                to={dashboard.url}
                title={dashboard.title}
                onClick={onClose}
              >
                {dashboard.title}
              </DashboardLink>
            ))}
          </Col>
        )}
      </Row>
    </Panel>
  );
}

interface MyDashboardsMenuOverlayProps {
  dashboards: DashboardMenuItem[];
  onClose: () => void;
  triggerRect: DOMRect | null;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const MegaPanel = styled.div<{ $top: number }>`
  ${({ theme, $top }) => css`
    position: fixed;
    top: ${$top}px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 1500px;
    max-height: 80vh;
    overflow-y: auto;
    background: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    padding: ${theme.sizeUnit * 6}px;
    z-index: 1050;
  `}
`;

function MyDashboardsMenuOverlay({
  dashboards,
  onClose,
  triggerRect,
  onMouseEnter,
  onMouseLeave,
}: MyDashboardsMenuOverlayProps) {
  const panelTop = triggerRect ? triggerRect.bottom + 8 : 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <MegaPanel
      $top={panelTop}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <MyDashboardsMenu dashboards={dashboards} onClose={onClose} />
    </MegaPanel>,
    document.body,
  );
}

export default MyDashboardsMenuOverlay;
