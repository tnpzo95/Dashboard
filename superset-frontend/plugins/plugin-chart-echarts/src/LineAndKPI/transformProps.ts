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
    getMetricLabel,
    getNumberFormatter,
    getValueFormatter,
    getTimeFormatter,
    SMART_DATE_ID,
    isAdhocMetricSimple,
} from '@superset-ui/core';
import { LineAndKPIChartProps, LineAndKPIVizProps, KPIItem } from './types';
import { Refs } from '../types';
import {
    DEFAULT_CONTAINER_BORDER_RADIUS,
    DEFAULT_KPI_TITLE_FONT_SIZE,
} from './constants';
import { safeParseEChartOptions } from '../utils/safeEChartOptionsParser';
import { mergeCustomEChartOptions } from '../utils/mergeCustomEChartOptions';

export default function transformProps(
    chartProps: LineAndKPIChartProps,
): LineAndKPIVizProps {
    const {
        width,
        height,
        queriesData,
        formData: { echartOptions: _echartOptions, ...formData },
        hooks,
        datasource: {
            currencyFormats = {},
            columnFormats = {},
            currencyCodeColumn,
            columns: datasourceColumns = [],
        },
    } = chartProps;

    // Columns flagged as temporal (date/time) in the datasource, so KPI
    // cards pointing at them can be formatted as dates instead of numbers.
    const dttmColumnNames = new Set(
        (datasourceColumns || [])
            .filter((col: any) => col.is_dttm)
            .map((col: any) => col.column_name),
    );
    const {
        metrics = [],
        yAxisFormat,
        currencyFormat,
        containerTitle,
        containerBorderRadius,
        customContainerBorderRadius,
        kpiCards = [],
        kpiTitleColor,
        kpiValueColor,
        kpiTitleFontSize,
        showLineChart = true,
        sortSeriesType = 'sum',
        sortSeriesAscending = false,
        legendType,
        legendOrientation = 'top',
        legendMargin,
        legendSort,
        xAxisTitle,
        xAxisLabelRotation,
        xAxisLabelInterval,
        richTooltip = true,
        tooltipNumberFormat,
        yAxisTitle,
        logAxis,
        minorSplitLine,
        yAxisBounds,
    } = formData;

    const showLegend = formData.show_legend ?? formData.showLegend ?? true;

    const refs: Refs = {};

    // Resolve colors
    const resolveColor = (color: any) =>
        color
            ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a ?? 1})`
            : undefined;

    const kpiTitleClr = resolveColor(kpiTitleColor);
    const kpiValueClr = resolveColor(kpiValueColor);

    // Resolve border radius
    let resolvedBorderRadius: number;
    if (containerBorderRadius === 'custom') {
        resolvedBorderRadius = customContainerBorderRadius ?? DEFAULT_CONTAINER_BORDER_RADIUS;
    } else {
        resolvedBorderRadius = (containerBorderRadius as number) ?? DEFAULT_CONTAINER_BORDER_RADIUS;
    }

    // Parse data from queries
    const rawTimeSeriesData = queriesData[0]?.data || [];
    const aggregatedData = queriesData[1]?.data || [];

    // Get metric labels
    const metricLabels = metrics.map((m: any) =>
        typeof m === 'string' ? m : m.label || getMetricLabel(m),
    );

    // Rows already come back ordered by the X-axis column (see buildQuery's
    // `orderby`), so the last row is the latest time series value.
    const timeSeriesData = rawTimeSeriesData;

    // Build line chart data
    const xAxisData = timeSeriesData.map((row: any) => {
        const xCol = formData.x_axis || Object.keys(row)[0];
        return row[xCol];
    });

    // Series Order: reorder the metric series shown on the chart/legend by
    // name or by an aggregate (sum/min/max/avg) of their time series values.
    const getSeriesSortValue = (metricLabel: string) => {
        const values = timeSeriesData
            .map((row: any) => Number(row[metricLabel]))
            .filter((v: number) => !Number.isNaN(v));
        if (values.length === 0) return 0;
        const sum = values.reduce((a: number, b: number) => a + b, 0);
        switch (sortSeriesType) {
            case 'min':
                return Math.min(...values);
            case 'max':
                return Math.max(...values);
            case 'avg':
                return sum / values.length;
            case 'sum':
            default:
                return sum;
        }
    };

    const orderedMetricLabels = [...metricLabels].sort((a, b) =>
        sortSeriesType === 'name'
            ? a.localeCompare(b)
            : getSeriesSortValue(a) - getSeriesSortValue(b),
    );
    if (!sortSeriesAscending) {
        orderedMetricLabels.reverse();
    }

    // Legend
    const legendOrientMap: Record<string, 'horizontal' | 'vertical'> = {
        top: 'horizontal',
        bottom: 'horizontal',
        left: 'vertical',
        right: 'vertical',
    };
    let legendData = orderedMetricLabels;
    if (legendSort === 'asc') {
        legendData = [...orderedMetricLabels].sort((a, b) => a.localeCompare(b));
    } else if (legendSort === 'desc') {
        legendData = [...orderedMetricLabels].sort((a, b) => b.localeCompare(a));
    }

    // Tooltip / Y-axis number formatting
    const formatNumberSafely = (format: string | undefined) => (value: unknown) => {
        try {
            return getNumberFormatter(format)(value as number);
        } catch {
            return String(value);
        }
    };

    // Build ECharts options using system theme
    const echartOptions: any = showLineChart
        ? {
            tooltip: {
                trigger: richTooltip === false ? 'item' : 'axis',
                valueFormatter: formatNumberSafely(tooltipNumberFormat || yAxisFormat),
            },
            grid: {
                left: '3%',
                right: '3%',
                bottom: '3%',
                top: '5%',
                containLabel: true,
            },
            xAxis: {
                type: 'category',
                name: xAxisTitle || undefined,
                nameLocation: 'middle',
                nameGap: 30,
                data: xAxisData,
                splitLine: { show: false },
                axisLabel: {
                    rotate: Number(xAxisLabelRotation) || 0,
                    interval: xAxisLabelInterval === '0' ? 0 : 'auto',
                },
            },
            yAxis: {
                type: logAxis ? 'log' : 'value',
                name: yAxisTitle || undefined,
                nameLocation: 'middle',
                nameGap: 50,
                axisLine: { show: false },
                minorSplitLine: { show: Boolean(minorSplitLine) },
                min: Array.isArray(yAxisBounds) ? yAxisBounds[0] ?? undefined : undefined,
                max: Array.isArray(yAxisBounds) ? yAxisBounds[1] ?? undefined : undefined,
                axisLabel: {
                    formatter: formatNumberSafely(yAxisFormat),
                },
            },
            series: orderedMetricLabels.map((metricLabel: string) => ({
                name: metricLabel,
                type: 'line',
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2 },
                data: timeSeriesData.map((row: any) => row[metricLabel]),
            })),
            legend: {
                show: showLegend,
                type: legendType === 'plain' ? 'plain' : 'scroll',
                orient: legendOrientMap[legendOrientation] || 'horizontal',
                [legendOrientation]: typeof legendMargin === 'number' ? legendMargin : 0,
                data: legendData,
            },
            backgroundColor: 'transparent',
        }
        : undefined;

    const kpiTitleFontSizePx = kpiTitleFontSize ?? DEFAULT_KPI_TITLE_FONT_SIZE;

    // Each KPI card reads the real value of its selected metric from
    // whichever query it points to (line chart's latest row, or the
    // aggregated single row).
    const kpiItems: KPIItem[] = kpiCards
        .filter(card => card.enabled !== false)
        .map(card => {
            const metricLabel = card.metric
                ? typeof card.metric === 'string'
                    ? card.metric
                    : card.metric.label || getMetricLabel(card.metric)
                : undefined;
            const { borderColor, titleFontSize, valueFontSize } = card;
            const dataSource = card.queryIndex === 0 ? timeSeriesData : aggregatedData;

            // Detect whether this card's metric points at a temporal column,
            // so its value is date-formatted instead of number-formatted.
            const metricColumnName = isAdhocMetricSimple(card.metric)
                ? card.metric.column.column_name || card.metric.column.columnName
                : undefined;
            const isDateColumn = metricColumnName
                ? dttmColumnNames.has(metricColumnName)
                : false;

            if (!metricLabel || dataSource.length === 0) {
                return { title: card.title, value: '—', borderColor, titleFontSize, valueFontSize };
            }

            // Get the last row for time series, first row for aggregated
            const row =
                card.queryIndex === 0
                    ? dataSource[dataSource.length - 1]
                    : dataSource[0];
            const value = row[metricLabel];

            if (value === null || value === undefined) {
                return { title: card.title, value: '—', borderColor, titleFontSize, valueFontSize };
            }

            // Temporal columns get date-formatted (smart_date by default,
            // or a d3-time format string typed into the Number Format
            // field), never run through the number formatter.
            if (isDateColumn) {
                const timeFormatter = getTimeFormatter(card.numberFormat || SMART_DATE_ID);
                const dateValue =
                    typeof value === 'number' ? value : new Date(value as string).getTime();
                try {
                    return {
                        title: card.title,
                        value: Number.isNaN(dateValue)
                            ? String(value)
                            : String(timeFormatter(dateValue)),
                        borderColor,
                        titleFontSize,
                        valueFontSize,
                    };
                } catch {
                    return {
                        title: card.title,
                        value: String(value),
                        borderColor,
                        titleFontSize,
                        valueFontSize,
                    };
                }
            }

            // Only numeric values should go through the number formatter.
            // Text/date columns picked as the KPI metric should just be
            // displayed as-is, otherwise the formatter turns them into NaN.
            const isNumeric =
                typeof value === 'number' ||
                (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)));

            if (!isNumeric) {
                return {
                    title: card.title,
                    value: String(value),
                    borderColor,
                    titleFontSize,
                    valueFontSize,
                };
            }

            const numberFormatter = getValueFormatter(
                card.metric,
                currencyFormats,
                columnFormats,
                card.numberFormat || yAxisFormat,
                currencyFormat as any,
                undefined,
                dataSource,
                currencyCodeColumn,
                undefined,
            );

            try {
                return {
                    title: card.title,
                    value: String(numberFormatter(value as number)),
                    borderColor,
                    titleFontSize,
                    valueFontSize,
                };
            } catch {
                return {
                    title: card.title,
                    value: String(value),
                    borderColor,
                    titleFontSize,
                    valueFontSize,
                };
            }
        });

    const { onContextMenu } = hooks;

    // Parse the user-supplied "ECharts Options (JS object literals)" control
    // safely (AST-based, no eval/Function) and deep-merge it into the
    // generated line chart options.
    let customEchartOptions;
    try {
        customEchartOptions = safeParseEChartOptions(_echartOptions);
    } catch {
        customEchartOptions = undefined;
    }

    const mergedEchartOptions =
        echartOptions && customEchartOptions
            ? mergeCustomEChartOptions(echartOptions, customEchartOptions)
            : echartOptions;

    return {
        width,
        height,
        echartOptions: mergedEchartOptions,
        chartRefs: refs,
        kpiItems,
        containerTitle,
        containerBorderRadius: resolvedBorderRadius,
        kpiTitleColor: kpiTitleClr,
        kpiValueColor: kpiValueClr,
        kpiTitleFontSize: kpiTitleFontSizePx,
        showLineChart,
        onContextMenu,
    };
}