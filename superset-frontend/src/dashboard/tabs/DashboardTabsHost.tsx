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
import { useEffect, useState } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { useRouteMatch } from 'react-router-dom';
import { styled } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components';
import { URL_PARAMS } from 'src/constants';
import { MAIN_HEADER_HEIGHT } from 'src/dashboard/constants';
import { DashboardPage } from 'src/dashboard/containers/DashboardPage';
import { useDashboardTabsContext } from './DashboardTabsContext';
import DashboardTabBar from './DashboardTabBar';
import { getUrlParam } from 'src/utils/urlUtils';

// Measures the global nav's ACTUAL rendered height instead of trusting the
// MAIN_HEADER_HEIGHT constant, since a static value can drift out of sync
// (e.g. the nav wrapping to two lines on a narrow viewport) and a mismatch
// makes this fixed-position host start above where the sticky nav really
// ends, so the nav (higher z-index) visually covers the tab bar. Menu's
// own root element is a <header> (src/features/home/Menu.tsx), and it's
// the only one on the page.
function useMenuHeight(visible: boolean): number {
  const [height, setHeight] = useState(MAIN_HEADER_HEIGHT);

  useEffect(() => {
    if (!visible) {
      setHeight(0);
      return undefined;
    }

    const header = document.querySelector('header');
    if (!header) {
      setHeight(MAIN_HEADER_HEIGHT);
      return undefined;
    }
    const measure = () => setHeight(header.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [visible]);

  return height;
}

// Sits below Menu's z-index (10, see src/features/home/Menu.tsx) so its
// dropdowns still render above dashboard content, and above ordinary page
// flow so it can overlay the routed page content when a dashboard tab is
// showing. Fixed + zero footprint (display: none) everywhere else, so open
// tabs stay mounted (state preserved) without disturbing any other page's
// layout.
const Host = styled.div<{ visible: boolean; topOffset: number }>`
  ${({ theme, visible, topOffset }) => `
    position: fixed;
    top: ${topOffset}px;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    display: ${visible ? 'flex' : 'none'};
    flex-direction: column;
    overflow: hidden;
    background: ${theme.colorBgLayout};
  `}
`;

const Pane = styled.div<{ visible: boolean }>`
  display: ${({ visible }) => (visible ? 'block' : 'none')};
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

export default function DashboardTabsHost() {
  const { tabs, activeKey } = useDashboardTabsContext();
  const isOnDashboardRoute = !!useRouteMatch({
    path: '/superset/dashboard/:idOrSlug/',
  });
  const standalone = Boolean(getUrlParam(URL_PARAMS.standalone));
  const topOffset = useMenuHeight(!standalone);

  return (
    <Host visible={isOnDashboardRoute} topOffset={topOffset}>
      {isOnDashboardRoute && !standalone && <DashboardTabBar />}
      {tabs.map(tab => (
        <Pane
          key={tab.key}
          visible={isOnDashboardRoute && tab.key === activeKey}
        >
          {/* Each tab gets its own isolated Redux store (see
              DashboardTabsContext) so simultaneously-mounted dashboards
              never clobber each other's dashboardState/dashboardInfo/
              charts/etc, and its own ErrorBoundary so one broken dashboard
              can't take down the other open tabs. */}
          <ErrorBoundary>
            <ReduxProvider store={tab.store}>
              <DashboardPage
                idOrSlug={tab.idOrSlug}
                isActive={tab.key === activeKey}
              />
            </ReduxProvider>
          </ErrorBoundary>
        </Pane>
      ))}
    </Host>
  );
}
