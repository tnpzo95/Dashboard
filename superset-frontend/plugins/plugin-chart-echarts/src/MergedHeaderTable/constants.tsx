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
import { HeaderTreeConfig } from './types';

export const DEFAULT_HEADER_TREE: HeaderTreeConfig = {
    columns: [
        {
            label: 'Group A (3 = 1+2)',
            children: [
                {
                    label: '1',
                    children: [
                        {
                            label: 'Column 1',
                            numberFormat: ',.0f',
                        },
                    ],
                },
                {
                    label: '2',
                    children: [
                        {
                            label: 'Column 2',
                            numberFormat: ',.0f',
                        },
                    ],
                },
            ],
        },
        {
            label: 'Other',
            numberFormat: ',.0f',
        },
    ],
};

export const DEFAULT_HEADER_TREE_JSON = JSON.stringify(DEFAULT_HEADER_TREE, null, 2);

export const DEFAULT_CELL_FONT_SIZE = 12;

export const CELL_FONT_SIZE_OPTIONS = [
    { label: 'Small (11px)', value: 11 },
    { label: 'Normal (12px)', value: 12 },
    { label: 'Medium (14px)', value: 14 },
    { label: 'Large (16px)', value: 16 },
];
