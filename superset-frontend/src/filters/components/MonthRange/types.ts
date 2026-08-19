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
import { RefObject } from 'react';
import {
    Behavior,
    DataRecord,
    FilterState,
    QueryFormData,
} from '@superset-ui/core';
import { PluginFilterHooks, PluginFilterStylesProps } from '../types';

interface PluginFilterMonthRangeCustomizeProps {
    defaultValue?: string | null;
    defaultFillterTimeNow?: boolean | null;
    defaultFillterMonthsAgo?: boolean | null;
    defaultFillterMonthsAgoNumber?: number | null;
}

export type PluginFilterMonthRangeQueryFormData = QueryFormData &
    PluginFilterStylesProps &
    PluginFilterMonthRangeCustomizeProps;

export type PluginFilterMonthRangeProps = PluginFilterStylesProps & {
    behaviors: Behavior[];
    data: DataRecord[];
    formData: PluginFilterMonthRangeQueryFormData;
    filterState: FilterState;
    inputRef: RefObject<HTMLInputElement>;
} & PluginFilterHooks;

export const DEFAULT_FORM_DATA: PluginFilterMonthRangeCustomizeProps = {
    defaultValue: null,
    defaultFillterTimeNow: false,
    defaultFillterMonthsAgo: false,
    defaultFillterMonthsAgoNumber: 3,
};
