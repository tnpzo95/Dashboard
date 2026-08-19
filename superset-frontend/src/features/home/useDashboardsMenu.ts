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
import { useState, useEffect } from 'react';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';

export interface TagMenuItem {
  id: number;
  name: string;
  type: number;
}

export interface DashboardMenuItem {
  id: number;
  title: string;
  url: string;
  tags: TagMenuItem[];
}

interface DashboardApiItem {
  id: number;
  dashboard_title: string;
  url: string;
  tags?: TagMenuItem[];
}

export enum TagType {
  custom = 1,
  type = 2,
  owner = 3,
  favorited_by = 4,
}

export function useDashboardsMenu(): DashboardMenuItem[] {
  const [dashboards, setDashboards] = useState<DashboardMenuItem[]>([]);

  useEffect(() => {
    const query = rison.encode({
      page_size: 100,
      order_column: 'dashboard_title',
      order_direction: 'asc',
      columns: ['id', 'dashboard_title', 'url', 'tags.id', 'tags.name', 'tags.type'],
    });

    SupersetClient.get({ endpoint: `/api/v1/dashboard/?q=${query}` })
      .then(({ json }) => {
        const seen = new Set<number>();
        const items: DashboardMenuItem[] = [];
        (json?.result ?? []).forEach((d: DashboardApiItem) => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            items.push({
              id: d.id,
              title: d.dashboard_title || `Dashboard ${d.id}`,
              url: d.url || `/superset/dashboard/${d.id}/`,
              tags: Array.isArray(d.tags)
                ? d.tags.map(tag => ({
                  id: tag.id,
                  name: tag.name,
                  type: tag.type || 0,
                }))
                : [],
            });
          }
        });
        setDashboards(items);
      })
      .catch(() => {
        setDashboards([]);
      });
  }, []);

  return dashboards;
}