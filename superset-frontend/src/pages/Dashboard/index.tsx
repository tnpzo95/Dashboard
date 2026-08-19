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
import { FC, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDashboardTabsContext } from 'src/dashboard/tabs/DashboardTabsContext';

// This route no longer renders the dashboard itself -- it just ensures an
// MDI tab exists for this idOrSlug and is activated; the actual
// <DashboardPage> instances are kept alive by DashboardTabsHost (a
// persistent sibling of the router's <Switch>, see src/dashboard/tabs),
// so switching tabs doesn't unmount/remount/reset dashboard state. This
// same effect transparently handles every entry path: a list-row click, a
// direct URL/bookmark, and browser back/forward.
const DashboardRoute: FC = () => {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const { openDashboardTab } = useDashboardTabsContext();

  useEffect(() => {
    openDashboardTab(idOrSlug);
  }, [idOrSlug, openDashboardTab]);

  return null;
};

export default DashboardRoute;
