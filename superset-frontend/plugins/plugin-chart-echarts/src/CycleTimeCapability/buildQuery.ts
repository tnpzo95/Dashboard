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
import { buildQueryContext, ensureIsArray } from '@superset-ui/core';
import { CycleTimeCapabilityFormData } from './types';

// Columns needed to draw the histogram/normal curve itself; always fetched
// regardless of what the user configures in Custom Columns.
const REQUIRED_COLUMNS = ['BIN_NO', 'BIN_CENTER', 'FREQUENCY', 'NORMAL_Y'];

export default function buildQuery(formData: CycleTimeCapabilityFormData) {
    const customColumns = ensureIsArray(formData.customColumns);
    const metrics = ensureIsArray(formData.metrics);

    return buildQueryContext(formData, baseQueryObject => [
        {
            ...baseQueryObject,
            // Pass through pre-computed SQL columns. Using columns (without
            // groupby) and metrics: undefined prevents backend from adding
            // GROUP BY, so row-level statistics stay intact. If the user adds
            // metrics explicitly, the backend aggregates and columns act as
            // groupby dimensions instead.
            columns: [
                ...REQUIRED_COLUMNS,
                ...customColumns.filter(
                    col => !REQUIRED_COLUMNS.includes(col as string),
                ),
            ],
            metrics: metrics.length > 0 ? metrics : undefined,
        },
    ]);
}