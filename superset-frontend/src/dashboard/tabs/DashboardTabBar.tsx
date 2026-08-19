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
import { KeyboardEvent, MouseEvent } from 'react';
import { useHistory } from 'react-router-dom';
import { styled, css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import { useDashboardTabsContext } from './DashboardTabsContext';

const Strip = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    background: ${theme.colorBgContainer};
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    overflow-x: auto;
    flex-shrink: 0;
  `}
`;

const Tab = styled.div<{ active: boolean }>`
  ${({ theme, active }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    border: 1px solid
      ${active ? theme.colorPrimary : theme.colorBorderSecondary};
    background: ${active ? theme.colorPrimaryBg : theme.colorBgContainer};
    color: ${active ? theme.colorPrimaryText : theme.colorText};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    min-width: 0;

    &:hover {
      border-color: ${theme.colorPrimary};
    }
  `}
`;

const TabTitle = styled.span`
  display: inline-block;
  min-width: 0;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
`;

const TabActions = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit / 2}px;
    flex-shrink: 0;
  `}
`;

const TabActionButton = styled.button<{ $pinned?: boolean }>`
  ${({ theme, $pinned }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 5}px;
    height: ${theme.sizeUnit * 5}px;
    border: none;
    border-radius: ${theme.borderRadius}px;
    background: transparent;
    color: ${$pinned ? theme.colorPrimary : theme.colorTextSecondary};
    cursor: pointer;
    flex-shrink: 0;

    &:hover {
      background: ${theme.colorFillSecondary};
      color: ${theme.colorPrimary};
    }
  `}
`;

const AddButton = styled.button`
  ${({ theme }) => css`
    position: sticky;
    inset-inline-start: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed ${theme.colorBorder};
    background: ${theme.colorBgContainer};
    color: ${theme.colorPrimary};
    border-radius: ${theme.borderRadius}px;
    width: ${theme.sizeUnit * 7}px;
    height: ${theme.sizeUnit * 7}px;
    cursor: pointer;
    flex-shrink: 0;
    z-index: 1;

    &:hover {
      border-color: ${theme.colorPrimary};
      background: ${theme.colorPrimaryBg};
    }
  `}
`;

export default function DashboardTabBar() {
  const { tabs, activeKey, closeTab, toggleTabPin } = useDashboardTabsContext();
  const history = useHistory();

  if (tabs.length === 0) {
    return null;
  }

  const handleClose = (event: MouseEvent, key: string) => {
    event.stopPropagation();
    closeTab(key);
  };

  const handleTogglePin = (event: MouseEvent, key: string) => {
    event.stopPropagation();
    toggleTabPin(key);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    idOrSlug: string,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      history.push(`/superset/dashboard/${idOrSlug}/`);
    }
  };

  return (
    <Strip role="tablist" aria-label={t('Open dashboards')}>
      <AddButton
        type="button"
        aria-label={t('Open a dashboard')}
        title={t('Open a dashboard')}
        onClick={() => history.push('/dashboard/list/')}
      >
        <Icons.PlusOutlined iconSize="s" />
      </AddButton>
      {tabs.map(tab => (
        <Tab
          key={tab.key}
          role="tab"
          tabIndex={0}
          active={tab.key === activeKey}
          aria-selected={tab.key === activeKey}
          title={tab.title}
          onClick={() => history.push(`/superset/dashboard/${tab.idOrSlug}/`)}
          onKeyDown={event => handleKeyDown(event, tab.idOrSlug)}
        >
          <TabTitle>{tab.title}</TabTitle>
          <TabActions>
            <TabActionButton
              type="button"
              $pinned={tab.pinnedOrder !== null}
              aria-pressed={tab.pinnedOrder !== null}
              aria-label={
                tab.pinnedOrder !== null ? t('Unpin tab') : t('Pin tab')
              }
              title={tab.pinnedOrder !== null ? t('Unpin tab') : t('Pin tab')}
              onClick={e => handleTogglePin(e, tab.key)}
            >
              {tab.pinnedOrder !== null ? (
                <Icons.PushpinFilled iconSize="xs" />
              ) : (
                <Icons.PushpinOutlined iconSize="xs" />
              )}
            </TabActionButton>
            <TabActionButton
              type="button"
              aria-label={t('Close tab')}
              title={t('Close tab')}
              onClick={e => handleClose(e, tab.key)}
            >
              <Icons.CloseOutlined iconSize="xs" />
            </TabActionButton>
          </TabActions>
        </Tab>
      ))}
    </Strip>
  );
}
