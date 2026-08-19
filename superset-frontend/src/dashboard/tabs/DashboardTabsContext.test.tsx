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
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import {
  DashboardTabsProvider,
  useDashboardTabsContext,
} from './DashboardTabsContext';

jest.mock('src/views/store', () => ({
  setupStore: jest.fn(() => ({}) as never),
}));

function TabsProbe() {
  const { tabs, openDashboardTab, toggleTabPin } = useDashboardTabsContext();

  return (
    <div>
      <div data-testid="tab-order">{tabs.map(tab => tab.key).join(',')}</div>
      <button type="button" onClick={() => openDashboardTab('alpha')}>
        Open alpha
      </button>
      <button type="button" onClick={() => openDashboardTab('beta')}>
        Open beta
      </button>
      <button type="button" onClick={() => openDashboardTab('gamma')}>
        Open gamma
      </button>
      <button type="button" onClick={() => toggleTabPin('alpha')}>
        Toggle alpha pin
      </button>
      <button type="button" onClick={() => toggleTabPin('beta')}>
        Toggle beta pin
      </button>
      <button type="button" onClick={() => toggleTabPin('gamma')}>
        Toggle gamma pin
      </button>
    </div>
  );
}

test('keeps pinned dashboards at the front in pin order', async () => {
  const history = createMemoryHistory({
    initialEntries: ['/dashboard/list/'],
  });

  render(
    <Router history={history}>
      <DashboardTabsProvider>
        <TabsProbe />
      </DashboardTabsProvider>
    </Router>,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Open alpha' }));
  await userEvent.click(screen.getByRole('button', { name: 'Open beta' }));
  await userEvent.click(screen.getByRole('button', { name: 'Open gamma' }));

  await waitFor(() => {
    expect(screen.getByTestId('tab-order')).toHaveTextContent(
      'alpha,beta,gamma',
    );
  });

  await userEvent.click(
    screen.getByRole('button', { name: 'Toggle beta pin' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Toggle alpha pin' }),
  );

  await waitFor(() => {
    expect(screen.getByTestId('tab-order')).toHaveTextContent(
      'beta,alpha,gamma',
    );
  });

  await userEvent.click(
    screen.getByRole('button', { name: 'Toggle beta pin' }),
  );

  await waitFor(() => {
    expect(screen.getByTestId('tab-order')).toHaveTextContent(
      'alpha,beta,gamma',
    );
  });
});
