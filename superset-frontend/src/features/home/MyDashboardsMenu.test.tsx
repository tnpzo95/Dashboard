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
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import MyDashboardsMenuOverlay from './MyDashboardsMenu';

const history = createMemoryHistory({
  initialEntries: ['/dashboard/list/'],
});

const dashboards = [
  {
    id: 1,
    title: 'Finance Dashboard',
    url: '/superset/dashboard/1/',
    tags: [{ id: 1, name: 'Finance', type: 1 }],
  },
  {
    id: 2,
    title: 'Operations Dashboard',
    url: '/superset/dashboard/2/',
    tags: [],
  },
];

test('navigates with the router and closes the overlay when a dashboard is clicked', async () => {
  const onClose = jest.fn();

  render(
    <Router history={history}>
      <MyDashboardsMenuOverlay
        dashboards={dashboards}
        onClose={onClose}
        triggerRect={{ bottom: 24 } as DOMRect}
      />
    </Router>,
  );

  await userEvent.click(
    screen.getByRole('link', { name: 'Finance Dashboard' }),
  );

  expect(history.location.pathname).toBe('/superset/dashboard/1/');
  expect(onClose).toHaveBeenCalledTimes(1);
});
