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
    ColorFormatters,
    getColorFormatters,
} from '@superset-ui/chart-controls';
import {
    getMetricLabel,
    getValueFormatter,
} from '@superset-ui/core';
import { KPIChartProps, KPIVizProps } from './types';
import { PADDING_MAP } from './constants';
import { Refs } from '../types';

export default function transformProps(
    chartProps: KPIChartProps,
): KPIVizProps {
    const {
        width,
        height,
        queriesData,
        formData,
        hooks,
        datasource: {
            currencyFormats = {},
            columnFormats = {},
            currencyCodeColumn,
        },
        theme,
    } = chartProps;
    const {
        metric = 'value',
        yAxisFormat,
        currencyFormat,
        titleFontSize,
        valueFontSize,
        titleColor,
        valueColor,
        backgroundColor,
        borderRadius,
        customBorderRadius,
        padding,
        conditionalFormatting,
    } = formData;
    const refs: Refs = {};
    const {
        data = [],
    } = queriesData[0] || {};
    const metrics = chartProps.datasource?.metrics || [];
    const metricName = metrics.length > 0
        ? metrics.find(m => m.metric_name === metric)?.verbose_name ||
        getMetricLabel(metric)
        : getMetricLabel(metric);
    const showMetricName = chartProps.rawFormData?.show_metric_name ?? true;
    const bigNumber =
        data.length === 0 ? null : data[0][metricName] as number | null;

    const numberFormatter = getValueFormatter(
        metric,
        currencyFormats,
        columnFormats,
        yAxisFormat,
        currencyFormat as any,
        undefined,
        data,
        currencyCodeColumn,
        undefined,
    );

    const { onContextMenu } = hooks;

    const defaultColorFormatters = [] as ColorFormatters;
    const colorThresholdFormatters =
        getColorFormatters(conditionalFormatting as any, data, theme, false) ??
        defaultColorFormatters;

    const bgColor = backgroundColor
        ? `rgba(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b}, ${backgroundColor.a ?? 1})`
        : undefined;
    const ttlColor = titleColor
        ? `rgba(${titleColor.r}, ${titleColor.g}, ${titleColor.b}, ${titleColor.a ?? 1})`
        : undefined;
    const valColor = valueColor
        ? `rgba(${valueColor.r}, ${valueColor.g}, ${valueColor.b}, ${valueColor.a ?? 1})`
        : undefined;

    let resolvedBorderRadius: number;
    if (borderRadius === 'custom') {
        resolvedBorderRadius = customBorderRadius ?? 8;
    } else {
        resolvedBorderRadius = (borderRadius as number) ?? 8;
    }

    const resolvedPadding = padding ? PADDING_MAP[padding] : PADDING_MAP.md;

    return {
        width,
        height,
        bigNumber,
        headerFormatter: numberFormatter,
        metricName,
        showMetricName,
        titleFontSize: titleFontSize ?? 16,
        valueFontSize: valueFontSize ?? 48,
        titleColor: ttlColor,
        valueColor: valColor,
        backgroundColor: bgColor,
        borderRadius: resolvedBorderRadius,
        padding: resolvedPadding,
        onContextMenu,
        refs,
        colorThresholdFormatters,
    };
}