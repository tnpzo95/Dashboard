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
import { act, renderHook } from '@testing-library/react';
import { Filter, NativeFilterType } from '@superset-ui/core';
import { Form } from '@superset-ui/core/components';
import { buildNativeFilter } from 'spec/fixtures/mockNativeFilters';
import { NativeFiltersForm } from '../types';
import { useFilterOperations } from './useFilterOperations';
import { useItemStateManager } from './useItemStateManager';

/** Create a saved filter configuration for dependency selection. */
function createFilter(id: string, filterType = 'filter_select'): Filter {
  return {
    ...buildNativeFilter(id, id, []),
    type: NativeFilterType.NativeFilter,
    filterType,
    description: '',
  };
}

/** Exercise filter operations with the modal's form and state hooks. */
function renderOperations(filterConfigMap: Record<string, Filter>) {
  const filterIds = Object.keys(filterConfigMap);
  return renderHook(() => {
    const [form] = Form.useForm<NativeFiltersForm>();
    const filterState = useItemStateManager(filterIds, filterConfigMap);
    const operations = useFilterOperations({
      form,
      filterState,
      filterIds,
      filterConfigMap,
      handleModifyItem: jest.fn(),
      setActiveItem: jest.fn(),
      setSaveAlertVisible: jest.fn(),
    });
    return { form, filterState, operations };
  });
}

test.each(['filter_time', 'filter_datetime', 'filter_month_range'])(
  'offers a saved %s as the parent of a Select filter',
  filterType => {
    const { result } = renderOperations({
      parent: createFilter('parent', filterType),
      child: createFilter('child'),
    });

    expect(
      result.current.operations.getAvailableFilters('child', id => id),
    ).toEqual([{ label: 'parent', value: 'parent', type: filterType }]);
    expect(result.current.operations.getDependencySuggestion('child')).toBe(
      'parent',
    );
  },
);

test('uses the edited type when an existing filter becomes a DateTime parent', () => {
  const { result } = renderOperations({
    parent: createFilter('parent', 'filter_timecolumn'),
    child: createFilter('child'),
  });
  expect(
    result.current.operations.getAvailableFilters('child', id => id),
  ).toEqual([]);

  act(() => {
    result.current.form.setFieldsValue({
      filters: { parent: { filterType: 'filter_datetime' } },
    });
  });

  expect(
    result.current.operations.getAvailableFilters('child', id => id),
  ).toEqual([{ label: 'parent', value: 'parent', type: 'filter_datetime' }]);
});

test('does not offer Time column or Time grain as temporal parents', () => {
  const { result } = renderOperations({
    column: createFilter('column', 'filter_timecolumn'),
    grain: createFilter('grain', 'filter_timegrain'),
    child: createFilter('child'),
  });

  expect(
    result.current.operations.getAvailableFilters('child', id => id),
  ).toEqual([]);
});

test('does not offer a removed DateTime parent', () => {
  const { result } = renderOperations({
    parent: createFilter('parent', 'filter_datetime'),
    child: createFilter('child'),
  });

  act(() => {
    result.current.filterState.setRemovedItems({
      parent: { isPending: false },
    });
  });

  expect(
    result.current.operations.getAvailableFilters('child', id => id),
  ).toEqual([]);
});

test('excludes temporal parents that would introduce a circular dependency', () => {
  const { result } = renderOperations({
    parent: createFilter('parent', 'filter_datetime'),
    child: createFilter('child'),
  });

  act(() => {
    result.current.form.setFieldsValue({
      filters: {
        parent: { filterType: 'filter_datetime', dependencies: ['child'] },
        child: { filterType: 'filter_select', dependencies: [] },
      },
    });
  });

  expect(
    result.current.operations.getAvailableFilters('child', id => id),
  ).toEqual([]);
});
