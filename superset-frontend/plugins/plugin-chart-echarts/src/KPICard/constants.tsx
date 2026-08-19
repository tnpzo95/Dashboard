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

export const DEFAULT_TITLE_FONT_SIZE = 16;
export const DEFAULT_VALUE_FONT_SIZE = 48;
export const DEFAULT_BORDER_RADIUS = 8;
export const DEFAULT_PADDING = 'md';

export const PADDING_MAP: Record<string, string> = {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
};

export const BORDER_RADIUS_OPTIONS = [
    { label: 'None', value: 0 },
    { label: 'Small (4px)', value: 4 },
    { label: 'Medium (8px)', value: 8 },
    { label: 'Large (12px)', value: 12 },
    { label: 'Extra Large (16px)', value: 16 },
    { label: 'Round (20px)', value: 20 },
    { label: 'Custom', value: 'custom' },
];

export const PADDING_OPTIONS = [
    { label: 'Extra Small', value: 'xs' },
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' },
    { label: 'Extra Large', value: 'xl' },
];

export const TITLE_FONT_SIZE_OPTIONS = [
    { label: 'Tiny (10px)', value: 10 },
    { label: 'Small (12px)', value: 12 },
    { label: 'Normal (14px)', value: 14 },
    { label: 'Medium (16px)', value: 16 },
    { label: 'Large (20px)', value: 20 },
    { label: 'Extra Large (24px)', value: 24 },
    { label: 'Huge (36px)', value: 36 },
];

export const VALUE_FONT_SIZE_OPTIONS = [
    { label: 'Small (20px)', value: 20 },
    { label: 'Medium (28px)', value: 28 },
    { label: 'Normal (36px)', value: 36 },
    { label: 'Large (48px)', value: 48 },
    { label: 'Extra Large (60px)', value: 60 },
    { label: 'Huge (72px)', value: 72 },
];