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

// These are control configurations that are shared ONLY within the BigNumberWithTrendline viz plugin repo.
import { t } from '@apache-superset/core/translation';
import { CustomControlItem } from '@superset-ui/chart-controls';

const FONT_SIZE_OPTIONS_SMALL = [
  { label: t('Tiny'), value: 0.125 },
  { label: t('Small'), value: 0.15 },
  { label: t('Normal'), value: 0.2 },
  { label: t('Large'), value: 0.3 },
  { label: t('Huge'), value: 0.4 },
];

const FONT_SIZE_OPTIONS_LARGE = [
  { label: t('Tiny'), value: 0.2 },
  { label: t('Small'), value: 0.3 },
  { label: t('Normal'), value: 0.4 },
  { label: t('Large'), value: 0.5 },
  { label: t('Huge'), value: 0.6 },
];

function makeFontSizeControl(
  name: string,
  label: string,
  defaultValue: number,
  options: { label: string; value: number }[],
): CustomControlItem {
  return {
    name,
    config: {
      type: 'SelectControl',
      label: t(label),
      renderTrigger: true,
      clearable: false,
      default: defaultValue,
      options,
    },
  };
}

export const headerFontSize = makeFontSizeControl(
  'header_font_size',
  'Big Number Font Size',
  0.4,
  FONT_SIZE_OPTIONS_LARGE,
);

export const subtitleFontSize = makeFontSizeControl(
  'subtitle_font_size',
  'Subtitle Font Size',
  0.15,
  FONT_SIZE_OPTIONS_SMALL,
);

export const subheaderFontSize = makeFontSizeControl(
  'subheader_font_size',
  'Subheader Font Size',
  0.15,
  FONT_SIZE_OPTIONS_SMALL,
);

export const metricNameFontSize = makeFontSizeControl(
  'metric_name_font_size',
  'Metric Name Font Size',
  0.15,
  FONT_SIZE_OPTIONS_SMALL,
);

export const subtitleControl: CustomControlItem = {
  name: 'subtitle',
  config: {
    type: 'TextControl',
    label: t('Subtitle'),
    renderTrigger: true,
    description: t('Description text that shows up below your Big Number'),
  },
};

export const showMetricNameControl: CustomControlItem = {
  name: 'show_metric_name',
  config: {
    type: 'CheckboxControl',
    label: t('Show Metric Name'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the metric name'),
  },
};

export const metricNameFontSizeWithVisibility: CustomControlItem = {
  ...metricNameFontSize,
  config: {
    ...metricNameFontSize.config,
    visibility: ({ controls }) => controls?.show_metric_name?.value === true,
    resetOnHide: false,
  },
};

export const backgroundColor: CustomControlItem = {
  name: 'background_color',
  config: {
    type: 'ColorPickerControl',
    label: t('Background Color'),
    renderTrigger: true,
    default: { r: 255, g: 255, b: 255, a: 1 },
    description: t('Set the background color of the chart'),
  },
};

export const textColorMode: CustomControlItem = {
  name: 'text_color_mode',
  config: {
    type: 'SelectControl',
    label: t('Text Color Mode'),
    renderTrigger: true,
    clearable: false,
    default: 'system',
    options: [
      { label: t('System'), value: 'system' },
      { label: t('Custom'), value: 'custom' },
    ],
    description: t('Use system theme color or choose a custom color'),
  },
};

export const textColor: CustomControlItem = {
  name: 'text_color',
  config: {
    type: 'ColorPickerControl',
    label: t('Text Color'),
    renderTrigger: true,
    default: { r: 0, g: 0, b: 0, a: 1 },
    description: t('Set the color of the text'),
    visibility: ({ controls }) => controls?.text_color_mode?.value === 'custom',
    resetOnHide: false,
  },
};

const TEXT_FONT_SIZE_OPTIONS = [
  { label: t('Tiny'), value: 12 },
  { label: t('Small'), value: 16 },
  { label: t('Normal'), value: 20 },
  { label: t('Large'), value: 28 },
  { label: t('Huge'), value: 36 },
];

export const textFontSize: CustomControlItem = {
  name: 'text_font_size',
  config: {
    type: 'SelectControl',
    label: t('Text Font Size'),
    renderTrigger: true,
    clearable: false,
    default: 20,
    options: TEXT_FONT_SIZE_OPTIONS,
    description: t('Set the font size of the text'),
  },
};

const TEXT_ALIGN_OPTIONS = [
  { label: t('Left'), value: 'flex-start' },
  { label: t('Center'), value: 'center' },
  { label: t('Right'), value: 'flex-end' },
];

export const textAlign: CustomControlItem = {
  name: 'text_align',
  config: {
    type: 'SelectControl',
    label: t('Text Alignment'),
    renderTrigger: true,
    clearable: false,
    default: 'flex-start',
    options: TEXT_ALIGN_OPTIONS,
    description: t('Set the alignment of the text'),
  },
};
