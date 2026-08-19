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
import { useHistory } from 'react-router-dom';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import DashboardTabBar from './DashboardTabBar';
import { useDashboardTabsContext } from './DashboardTabsContext';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: jest.fn(),
}));

jest.mock('./DashboardTabsContext', () => ({
  useDashboardTabsContext: jest.fn(),
}));

const useHistoryMock = useHistory as jest.Mock;
const useDashboardTabsContextMock = useDashboardTabsContext as jest.Mock;

test('hides the tab bar when there are no dashboard tabs', () => {
  useDashboardTabsContextMock.mockReturnValue({
    tabs: [],
    activeKey: null,
    closeTab: jest.fn(),
    toggleTabPin: jest.fn(),
  });

  render(<DashboardTabBar />);

  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
});

test('renders the add dashboard button first when tabs are open', async () => {
  const push = jest.fn();
  useHistoryMock.mockReturnValue({ push });
  useDashboardTabsContextMock.mockReturnValue({
    tabs: [
      {
        key: 'alpha',
        idOrSlug: 'alpha',
        title: 'Alpha',
        store: {} as never,
        openedOrder: 0,
        pinnedOrder: null,
      },
      {
        key: 'beta',
        idOrSlug: 'beta',
        title: 'Beta',
        store: {} as never,
        openedOrder: 1,
        pinnedOrder: null,
      },
    ],
    activeKey: 'alpha',
    closeTab: jest.fn(),
    toggleTabPin: jest.fn(),
  });

  render(<DashboardTabBar />);

  const tablist = screen.getByRole('tablist', { name: 'Open dashboards' });
  const addButton = screen.getByRole('button', { name: 'Open a dashboard' });

  expect(tablist.firstElementChild).toBe(addButton);

  await userEvent.click(addButton);
  expect(push).toHaveBeenCalledWith('/dashboard/list/');
});

test('calls the pin toggle when the pin button is clicked', async () => {
  const toggleTabPin = jest.fn();
  useHistoryMock.mockReturnValue({ push: jest.fn() });
  useDashboardTabsContextMock.mockReturnValue({
    tabs: [
      {
        key: 'alpha',
        idOrSlug: 'alpha',
        title: 'Alpha',
        store: {} as never,
        openedOrder: 0,
        pinnedOrder: null,
      },
    ],
    activeKey: 'alpha',
    closeTab: jest.fn(),
    toggleTabPin,
  });

  render(<DashboardTabBar />);

  await userEvent.click(screen.getByRole('button', { name: 'Pin tab' }));
  expect(toggleTabPin).toHaveBeenCalledWith('alpha');
});
