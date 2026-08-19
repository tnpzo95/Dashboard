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
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useRef,
  FC,
  PropsWithChildren,
} from 'react';
import { useHistory } from 'react-router-dom';
import { setupStore } from 'src/views/store';

export interface DashboardTabState {
  // Keyed by the raw idOrSlug used to navigate here. Opening the same
  // dashboard once by numeric id and once by slug produces two tabs --
  // an accepted v1 simplification since the dashboard list's own links
  // always use one consistent url format.
  key: string;
  idOrSlug: string;
  title: string;
  store: ReturnType<typeof setupStore>;
  openedOrder: number;
  pinnedOrder: number | null;
}

interface DashboardTabsContextValue {
  tabs: DashboardTabState[];
  activeKey: string | null;
  openDashboardTab: (idOrSlug: string) => void;
  closeTab: (key: string) => void;
  setTabTitle: (key: string, title: string) => void;
  toggleTabPin: (key: string) => void;
}

const DashboardTabsContext = createContext<DashboardTabsContextValue | null>(
  null,
);

function sortTabs(tabs: DashboardTabState[]): DashboardTabState[] {
  return [...tabs].sort((a, b) => {
    const aPinned = a.pinnedOrder !== null;
    const bPinned = b.pinnedOrder !== null;

    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }

    if (aPinned && bPinned) {
      return (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0);
    }

    return a.openedOrder - b.openedOrder;
  });
}

export const DashboardTabsProvider: FC<PropsWithChildren<{}>> = ({
  children,
}) => {
  const [tabs, setTabs] = useState<DashboardTabState[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const history = useHistory();
  const nextOpenedOrderRef = useRef(0);
  const nextPinnedOrderRef = useRef(0);

  const openDashboardTab = useCallback((idOrSlug: string) => {
    setTabs(prev => {
      if (prev.some(tab => tab.key === idOrSlug)) {
        return prev;
      }
      const openedOrder = nextOpenedOrderRef.current;
      nextOpenedOrderRef.current += 1;
      return [
        ...prev,
        {
          key: idOrSlug,
          idOrSlug,
          title: idOrSlug,
          store: setupStore(),
          openedOrder,
          pinnedOrder: null,
        },
      ];
    });
    setActiveKey(idOrSlug);
  }, []);

  const setTabTitle = useCallback((key: string, title: string) => {
    setTabs(prev =>
      prev.map(tab => (tab.key === key ? { ...tab, title } : tab)),
    );
  }, []);

  const toggleTabPin = useCallback((key: string) => {
    setTabs(prev =>
      prev.map(tab => {
        if (tab.key !== key) {
          return tab;
        }

        if (tab.pinnedOrder !== null) {
          return { ...tab, pinnedOrder: null };
        }

        return {
          ...tab,
          pinnedOrder: nextPinnedOrderRef.current++,
        };
      }),
    );
  }, []);

  const closeTab = useCallback(
    (key: string) => {
      setTabs(prev => {
        const sortedPrev = sortTabs(prev);
        const idx = sortedPrev.findIndex(tab => tab.key === key);
        if (idx === -1) return prev;
        const next = prev.filter(tab => tab.key !== key);
        const nextSorted = sortTabs(next);
        setActiveKey(currentActiveKey => {
          if (currentActiveKey !== key) {
            return currentActiveKey;
          }
          const fallback = nextSorted[idx] ?? nextSorted[idx - 1] ?? null;
          if (fallback) {
            history.push(`/superset/dashboard/${fallback.idOrSlug}/`);
          } else {
            history.push('/dashboard/list/');
          }
          return fallback?.key ?? null;
        });
        return next;
      });
    },
    [history],
  );

  const sortedTabs = useMemo(() => sortTabs(tabs), [tabs]);

  const value = useMemo(
    () => ({
      tabs: sortedTabs,
      activeKey,
      openDashboardTab,
      closeTab,
      setTabTitle,
      toggleTabPin,
    }),
    [
      sortedTabs,
      activeKey,
      openDashboardTab,
      closeTab,
      setTabTitle,
      toggleTabPin,
    ],
  );

  return (
    <DashboardTabsContext.Provider value={value}>
      {children}
    </DashboardTabsContext.Provider>
  );
};

export function useDashboardTabsContext(): DashboardTabsContextValue {
  const context = useContext(DashboardTabsContext);
  if (!context) {
    throw new Error(
      'useDashboardTabsContext must be used within a DashboardTabsProvider',
    );
  }
  return context;
}

// For callers that must also work outside the MDI provider (e.g. embedded
// dashboards, which render DashboardPage directly). Returns null instead of
// throwing so features that only make sense inside a tabbed host can degrade
// gracefully.
export function useDashboardTabsContextOptional(): DashboardTabsContextValue | null {
  return useContext(DashboardTabsContext);
}
