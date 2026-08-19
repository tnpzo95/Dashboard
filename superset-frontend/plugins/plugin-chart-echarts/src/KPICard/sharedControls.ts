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
import { t } from '@apache-superset/core/translation';
import { CustomControlItem } from '@superset-ui/chart-controls';
import {
    TITLE_FONT_SIZE_OPTIONS,
    VALUE_FONT_SIZE_OPTIONS,
    BORDER_RADIUS_OPTIONS,
    PADDING_OPTIONS,
    DEFAULT_TITLE_FONT_SIZE,
    DEFAULT_VALUE_FONT_SIZE,
    DEFAULT_BORDER_RADIUS,
    DEFAULT_PADDING,
} from './constants';

export const titleFontSizeControl: CustomControlItem = {
    name: 'title_font_size',
    config: {
        type: 'SelectControl',
        label: t('Title Font Size'),
        renderTrigger: true,
        clearable: false,
        default: DEFAULT_TITLE_FONT_SIZE,
        options: TITLE_FONT_SIZE_OPTIONS,
        description: t('Set the font size of the title text'),
    },
};

export const valueFontSizeControl: CustomControlItem = {
    name: 'value_font_size',
    config: {
        type: 'SelectControl',
        label: t('Value Font Size'),
        renderTrigger: true,
        clearable: false,
        default: DEFAULT_VALUE_FONT_SIZE,
        options: VALUE_FONT_SIZE_OPTIONS,
        description: t('Set the font size of the metric value'),
    },
};

export const titleColorControl: CustomControlItem = {
    name: 'title_color',
    config: {
        type: 'ColorPickerControl',
        label: t('Title Color'),
        renderTrigger: true,
        default: { r: 107, g: 114, b: 128, a: 1 },
        description: t('Set the color of the title text'),
    },
};

export const valueColorControl: CustomControlItem = {
    name: 'value_color',
    config: {
        type: 'ColorPickerControl',
        label: t('Value Color'),
        renderTrigger: true,
        default: { r: 0, g: 0, b: 0, a: 1 },
        description: t('Set the color of the metric value'),
    },
};

export const backgroundColorControl: CustomControlItem = {
    name: 'background_color',
    config: {
        type: 'ColorPickerControl',
        label: t('Background Color'),
        renderTrigger: true,
        default: { r: 255, g: 255, b: 255, a: 1 },
        description: t('Set the background color of the KPI card'),
    },
};

export const borderRadiusControl: CustomControlItem = {
    name: 'border_radius',
    config: {
        type: 'SelectControl',
        label: t('Border Radius'),
        renderTrigger: true,
        clearable: false,
        default: DEFAULT_BORDER_RADIUS,
        options: BORDER_RADIUS_OPTIONS,
        description: t('Set the border radius of the KPI card'),
    },
};

export const customBorderRadiusControl: CustomControlItem = {
    name: 'custom_border_radius',
    config: {
        type: 'TextControl',
        label: t('Custom Border Radius'),
        renderTrigger: true,
        default: 8,
        isInt: true,
        description: t('Set a custom border radius value in pixels'),
        visibility: ({ controls }) =>
            controls?.border_radius?.value === 'custom',
    },
};

export const paddingControl: CustomControlItem = {
    name: 'padding',
    config: {
        type: 'SelectControl',
        label: t('Padding'),
        renderTrigger: true,
        clearable: false,
        default: DEFAULT_PADDING,
        options: PADDING_OPTIONS,
        description: t('Set the padding inside the KPI card'),
    },
};