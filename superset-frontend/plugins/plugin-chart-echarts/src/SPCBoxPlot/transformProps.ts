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
    CategoricalColorNamespace,
    getColumnLabel,
    getMetricLabel,
    getNumberFormatter,
    getTimeFormatter,
} from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';
import type { BoxplotSeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
    SPCBoxPlotTransformedProps,
    SPCBoxPlotQueryFormData,
    EchartsSPCBoxPlotChartProps,
} from './types';
import {
    extractGroupbyLabel,
    getColtypesMapping,
    sanitizeHtml,
} from '../utils/series';
import { convertInteger } from '../utils/convertInteger';
import { defaultGrid, defaultYAxis } from '../defaults';
import { getPadding } from '../Timeseries/transformers';
import { OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';

function getNum(val: any): number {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(String(val));
    return isNaN(n) ? 0 : n;
}

function rgbToCss(color: { r: number; g: number; b: number; a: number }): string {
    const a = color.a !== undefined ? color.a : 1;
    return a < 1
        ? `rgba(${color.r},${color.g},${color.b},${a})`
        : `rgb(${color.r},${color.g},${color.b})`;
}

export default function transformProps(
    chartProps: EchartsSPCBoxPlotChartProps,
): SPCBoxPlotTransformedProps {
    const {
        width,
        height,
        formData,
        hooks,
        filterState,
        queriesData,
        inContextMenu,
        emitCrossFilters,
    } = chartProps;

    // Query 0: boxplot stats from boxplotOperator
    // Query 1 (optional): reference line values (raw rows)
    const boxplotData = queriesData[0]?.data || [];
    const refLineData = queriesData[1]?.data || [];
    const { setDataMask = () => { }, onContextMenu } = hooks;
    const coltypeMapping = getColtypesMapping(queriesData[0]);

    // Debug
    console.log('[SPCBoxPlot] Boxplot data length:', boxplotData.length);
    console.log('[SPCBoxPlot] Ref line data length:', refLineData.length);
    if (refLineData.length > 0) {
        console.log('[SPCBoxPlot] Ref line fields:', Object.keys(refLineData[0]).join(', '));
        console.log('[SPCBoxPlot] Ref line first row:', JSON.stringify(refLineData[0]));
    }

    const {
        colorScheme,
        groupby = [],
        metrics = [],
        numberFormat,
        dateFormat,
        xTicksLayout,
        legendOrientation = 'top',
        xAxisTitle,
        yAxisTitle,
        xAxisTitleMargin,
        yAxisTitleMargin,
        yAxisTitlePosition,
        sliceId,
        zoomable,
        showLegend,
        referenceLines = [],
    } = formData as SPCBoxPlotQueryFormData;
    const refs: Refs = {};
    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
    const numberFormatter = getNumberFormatter(numberFormat);
    const metricLabels = metrics.map(getMetricLabel);
    const groupbyLabels = groupby.map(getColumnLabel);

    // Parse boxplot stats from Query 0 (boxplotOperator output)
    const transformedData = boxplotData
        .map((datum: any) => {
            const groupbyLabel = extractGroupbyLabel({
                datum,
                groupby: groupbyLabels,
                coltypeMapping,
                timeFormatter: getTimeFormatter(dateFormat),
            });
            return metricLabels.map(metric => {
                const name =
                    metricLabels.length === 1
                        ? groupbyLabel
                        : `${groupbyLabel}, ${metric}`;
                const isFiltered =
                    filterState.selectedValues &&
                    !filterState.selectedValues.includes(name);
                return {
                    name,
                    value: [
                        datum[`${metric}__min`],
                        datum[`${metric}__q1`],
                        datum[`${metric}__median`],
                        datum[`${metric}__q3`],
                        datum[`${metric}__max`],
                        datum[`${metric}__mean`],
                        datum[`${metric}__count`],
                        datum[`${metric}__outliers`],
                    ],
                    itemStyle: {
                        color: colorFn(groupbyLabel, sliceId),
                        opacity: isFiltered ? OpacityEnum.SemiTransparent : 0.6,
                        borderColor: colorFn(groupbyLabel, sliceId),
                    },
                };
            });
        })
        .flatMap(row => row);

    // Outlier scatter data
    const outlierData = boxplotData
        .map(datum =>
            metricLabels.map(metric => {
                const groupbyLabel = extractGroupbyLabel({
                    datum,
                    groupby: groupbyLabels,
                    coltypeMapping,
                    timeFormatter: getTimeFormatter(dateFormat),
                });
                const name =
                    metricLabels.length === 1
                        ? groupbyLabel
                        : `${groupbyLabel}, ${metric}`;
                const outlierDatum = (datum[`${metric}__outliers`] || []) as number[];
                const isFiltered =
                    filterState.selectedValues &&
                    !filterState.selectedValues.includes(name);
                return {
                    name: 'outlier',
                    type: 'scatter',
                    data: outlierDatum.map(val => [name, val]),
                    tooltip: {
                        ...getDefaultTooltip(refs),
                        formatter: (param: { data: [string, number] }) => {
                            const [outlierName, stats] = param.data;
                            const headline = groupbyLabels.length
                                ? `<p><strong>${sanitizeHtml(outlierName)}</strong></p>`
                                : '';
                            return `${headline}${numberFormatter(stats)}`;
                        },
                    },
                    itemStyle: {
                        color: colorFn(groupbyLabel, sliceId),
                        opacity: isFiltered
                            ? OpacityEnum.SemiTransparent
                            : OpacityEnum.NonTransparent,
                    },
                };
            }),
        )
        .flat(2);

    // Reference lines: build markLine data from referenceLines array
    const refRow = refLineData[0] || {};
    const markLineData: any[] = [];
    for (const cfg of referenceLines) {
        if (!cfg.show || !cfg.field) {
            console.log(`[SPCBoxPlot] Skip ref: field="${cfg.field}", show=${cfg.show}`);
            continue;
        }

        const val = getNum(refRow[cfg.field]);
        console.log(`[SPCBoxPlot] Ref "${cfg.label}": field=${cfg.field}, val=${val}, style=${cfg.lineStyle}, width=${cfg.width}, opacity=${cfg.opacity}`);

        if (val === 0) continue;

        // Always draw the line (no label on the line itself)
        const labelConfig: any = {};
        if (cfg.showLabel) {
            labelConfig.show = true;
            labelConfig.formatter = `${cfg.label}`;
            labelConfig.position = cfg.labelPosition || 'start';
            labelConfig.fontSize = 11;
        } else {
            labelConfig.show = false;
        }

        markLineData.push({
            name: cfg.label,
            yAxis: val,
            label: labelConfig,
            lineStyle: {
                color: rgbToCss(cfg.color),
                type: cfg.lineStyle,
                width: cfg.width,
                opacity: cfg.opacity,
            },
            tooltip: {
                formatter: () => `${cfg.label}: ${val.toFixed(2)}`,
            },
        });

        // Value label (when showValue is true)
        if (cfg.showValue) {
            markLineData.push({
                name: cfg.label,
                yAxis: val,
                label: {
                    show: false,
                    formatter: val.toFixed(2),
                    position: cfg.labelPosition || 'start',
                    fontSize: 11,
                    distance: 40, // cách đường một khoảng
                    padding: [0, 0, 0, 20], // top right bottom left
                },
                lineStyle: {
                    color: 'transparent',
                    type: 'solid' as const,
                    width: 0,
                    opacity: 0,
                },
                tooltip: {
                    formatter: () => `${cfg.label}: ${val.toFixed(2)}`,
                },
            });
        }

        // Name label (when showLabel is true)
        if (cfg.showLabel && cfg.label) {
            markLineData.push({
                name: cfg.label,
                yAxis: val,
                label: {
                    show: true,
                    formatter: cfg.label,
                    position: cfg.labelPosition || 'start',
                    fontSize: 11,
                    distance: 40, // cách đường một khoảng
                    padding: [0, 0, 0, 20], // top right bottom left
                },
                lineStyle: {
                    color: 'transparent',
                    type: 'solid' as const,
                    width: 0,
                    opacity: 0,
                },
                tooltip: {
                    formatter: () => `${cfg.label}: ${val.toFixed(2)}`,
                },
            });
        }
    }

    console.log('[SPCBoxPlot] markLineData count:', markLineData.length);

    // Compute Y-axis range to include all reference lines
    const allDataValues = transformedData.flatMap(d => {
        const v = d.value;
        if (!Array.isArray(v)) return [];
        // v[4] is `__max` (whisker-high, excludes outliers under Tukey), so
        // also fold in v[7] (`__outliers`, the raw outlier values) -- otherwise
        // outlier scatter points above the whisker get clipped by the axis.
        const outliers = Array.isArray(v[7]) ? v[7] : [];
        return [v[0], v[4], ...outliers];
    }).filter(v => v !== undefined && v !== null);
    const refValues = markLineData.map(r => r.yAxis).filter(v => v !== undefined);
    const allValues = [...allDataValues, ...refValues];
    let yMin: number | undefined;
    let yMax: number | undefined;
    if (allValues.length > 0) {
        const dataMin = Math.min(...allValues);
        const dataMax = Math.max(...allValues);
        const range = dataMax - dataMin || 1;
        yMin = dataMin - range * 0.1;
        // yMax is pinned to the true data max (each box's `__max` stat, plus
        // any reference lines) with no extra padding, so the axis top always
        // matches the actual max value instead of an inflated range.
        yMax = dataMax + range * 0.1;
        console.log('[SPCBoxPlot] Y-axis range:', { yMin, yMax, dataMin, dataMax });
    }

    // Box plot series
    const series: BoxplotSeriesOption[] = [
        {
            name: metricLabels[0] || 'boxplot',
            type: 'boxplot',
            data: transformedData,
            tooltip: {
                ...getDefaultTooltip(refs),
                formatter: (param: CallbackDataParams) => {
                    // @ts-expect-error
                    const { value, name }: {
                        value: [number, number, number, number, number, number, number, number, number[]];
                        name: string;
                    } = param;
                    const headline = name
                        ? `<p><strong>${sanitizeHtml(name)}</strong></p>`
                        : '';
                    const stats = [
                        `Max: ${numberFormatter(value[5])}`,
                        `3rd Quartile: ${numberFormatter(value[4])}`,
                        `Mean: ${numberFormatter(value[6])}`,
                        `Median: ${numberFormatter(value[3])}`,
                        `1st Quartile: ${numberFormatter(value[2])}`,
                        `Min: ${numberFormatter(value[1])}`,
                        `# Observations: ${value[7]}`,
                    ];
                    if (value[8].length > 0) {
                        stats.push(`# Outliers: ${value[8].length}`);
                    }
                    return headline + stats.join('<br/>');
                },
            },
        },
        // @ts-expect-error
        ...outlierData,
    ];

    // Attach markLines
    if (markLineData.length > 0 && series.length > 0) {
        (series[0] as any).markLine = {
            silent: false,
            symbol: 'none',
            data: markLineData,
        };
    }

    const labelMap = boxplotData.reduce((acc: Record<string, string[]>, datum) => {
        const label = extractGroupbyLabel({
            datum,
            groupby: groupbyLabels,
            coltypeMapping,
            timeFormatter: getTimeFormatter(dateFormat),
        });
        return {
            ...acc,
            [label]: groupbyLabels.map(col => datum[col] as string),
        };
    }, {});

    const selectedValues = (filterState.selectedValues || []).reduce(
        (acc: Record<string, number>, selectedValue: string) => {
            const index = transformedData.findIndex(
                ({ name }) => name === selectedValue,
            );
            return {
                ...acc,
                [index]: selectedValue,
            };
        },
        {},
    );

    let axisLabel;
    if (xTicksLayout === '45°') axisLabel = { rotate: -45 };
    else if (xTicksLayout === '90°') axisLabel = { rotate: -90 };
    else if (xTicksLayout === 'flat') axisLabel = { rotate: 0 };
    else if (xTicksLayout === 'staggered') axisLabel = { rotate: -45 };
    else axisLabel = { show: true };

    const addYAxisTitleOffset =
        !!yAxisTitle && convertInteger(yAxisTitleMargin) !== 0;
    const addXAxisTitleOffset =
        !!xAxisTitle && convertInteger(xAxisTitleMargin) !== 0;
    const chartPadding = getPadding(
        true,
        legendOrientation,
        addYAxisTitleOffset,
        false,
        null,
        addXAxisTitleOffset,
        yAxisTitlePosition,
        convertInteger(yAxisTitleMargin),
        convertInteger(xAxisTitleMargin),
    );

    const echartOptions: EChartsCoreOption = {
        grid: {
            ...defaultGrid,
            ...chartPadding,
        },
        xAxis: {
            type: 'category',
            data: transformedData.map(row => row.name),
            axisLabel,
            name: xAxisTitle,
            nameGap: convertInteger(xAxisTitleMargin),
            nameLocation: 'middle',
        },
        yAxis: {
            ...defaultYAxis,
            type: 'value',
            min: yMin,
            max: yMax,
            axisLabel: { formatter: numberFormatter },
            name: yAxisTitle,
            nameGap: convertInteger(yAxisTitleMargin),
            nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
        },
        tooltip: {
            ...getDefaultTooltip(refs),
            show: !inContextMenu,
            trigger: 'item',
            axisPointer: {
                type: 'shadow',
            },
        },
        legend: {
            show: showLegend,
        },
        series,
        toolbox: {
            show: zoomable,
            feature: {
                dataZoom: {
                    title: {
                        zoom: 'zoom area',
                        back: 'restore zoom',
                    },
                },
            },
        },
        dataZoom: zoomable
            ? [
                {
                    type: 'inside',
                    zoomOnMouseWheel: false,
                    moveOnMouseWheel: true,
                },
            ]
            : [],
    };

    return {
        formData,
        width,
        height,
        echartOptions,
        setDataMask,
        emitCrossFilters,
        labelMap,
        groupby,
        selectedValues,
        onContextMenu,
        refs,
        coltypeMapping,
    };
}