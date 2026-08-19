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
import { configureStore } from '@reduxjs/toolkit';
import { createMemoryHistory } from 'history';
import { Router, useRouteMatch } from 'react-router-dom';
import { render, screen } from 'spec/helpers/testing-library';
import DashboardTabsHost from './DashboardTabsHost';
import { useDashboardTabsContext } from './DashboardTabsContext';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useRouteMatch: jest.fn(),
}));

jest.mock('./DashboardTabsContext', () => ({
  useDashboardTabsContext: jest.fn(),
}));

jest.mock('src/utils/urlUtils', () => ({
  getUrlParam: jest.fn(),
}));

jest.mock('src/dashboard/containers/DashboardPage', () => ({
  DashboardPage: () => <div data-testid="dashboard-page" />,
}));

const useRouteMatchMock = useRouteMatch as jest.Mock;
const useDashboardTabsContextMock = useDashboardTabsContext as jest.Mock;
const getUrlParamMock = getUrlParam as jest.Mock;

const store = configureStore({
  reducer: {
    dummy: (state = {}) => state,
  },
});

function renderHost() {
  const history = createMemoryHistory({
    initialEntries: ['/superset/dashboard/alpha/'],
  });

  render(
    <Router history={history}>
      <DashboardTabsHost />
    </Router>,
  );
}

beforeEach(() => {
  useDashboardTabsContextMock.mockReturnValue({
    tabs: [
      {
        key: 'alpha',
        idOrSlug: 'alpha',
        title: 'Alpha',
        store,
        openedOrder: 0,
        pinnedOrder: null,
      },
    ],
    activeKey: 'alpha',
    closeTab: jest.fn(),
    openDashboardTab: jest.fn(),
    setTabTitle: jest.fn(),
    toggleTabPin: jest.fn(),
  });
});

test('shows the tab bar on a dashboard route when not fullscreen', () => {
  useRouteMatchMock.mockReturnValue(true);
  getUrlParamMock.mockReturnValue(null);

  renderHost();

  expect(
    screen.getByRole('tablist', { name: 'Open dashboards' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Open a dashboard' }),
  ).toBeVisible();
});

test('hides the tab bar when the dashboard is fullscreen', () => {
  useRouteMatchMock.mockReturnValue(true);
  getUrlParamMock.mockImplementation((param: { name: string }) =>
    param.name === URL_PARAMS.standalone.name ? 1 : null,
  );

  renderHost();

  expect(
    screen.queryByRole('tablist', { name: 'Open dashboards' }),
  ).not.toBeInTheDocument();
  expect(screen.getByTestId('dashboard-page')).toBeVisible();
});
