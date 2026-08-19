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
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts';
import type { GridComponentOption } from 'echarts/components';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import { isEmpty } from 'lodash';
import {
    CategoricalColorNamespace,
    getColumnLabel,
    getMetricLabel,
    getValueFormatter,
    tooltipHtml,
} from '@superset-ui/core';
import { CycleTimeCapabilityChartProps, CycleTimeCapabilityTransformedProps } from './types';
import { LegendOrientation, LegendType, Refs } from '../types';
import { getLegendProps } from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';

function getNum(row: any, field: string): number {
    if (!row || !field) return 0;
    const val = row[field];
    if (val === null || val === undefined) return 0;
    const num = parseFloat(String(val));
    return isNaN(num) ? 0 : num;
}

function rgbToCss(color: any): string {
    if (typeof color === 'string') return color;
    if (color && 'r' in color && 'g' in color && 'b' in color) {
        const a = color.a !== undefined ? color.a : 1;
        return a < 1 ? `rgba(${color.r},${color.g},${color.b},${a})` : `rgb(${color.r},${color.g},${color.b})`;
    }
    return '#FF0000';
}

export default function transformProps(chartProps: CycleTimeCapabilityChartProps): CycleTimeCapabilityTransformedProps {
    const refs: Refs = {};
    let focusedSeries: number | undefined;
    const {
        datasource: { currencyFormats = {}, columnFormats = {} },
        formData,
        height,
        hooks,
        legendState = {},
        queriesData,
        theme,
        width,
    } = chartProps;
    const { onLegendStateChanged } = hooks;
    const {
        colorScheme,
        column,
        metrics = [],
        showLegend,
        showValue,
        sliceId,
        xAxisFormat,
        yAxisTitle,
        yAxisFormat,
        y_axis_label_margin = 8,
        referenceLines = [],
        showNormalCurve, normalCurveColor, normalCurveOpacity,
    } = formData;
    const metricLabels = metrics.map(getMetricLabel);
    const colorFn = CategoricalColorNamespace.getScale(colorScheme);

    const fmt = (f: string) => {
        try {
            return getValueFormatter(column, currencyFormats, columnFormats, f, undefined);
        } catch {
            return { format: (v: number) => String(v) };
        }
    };
    const xFmt = fmt(xAxisFormat);
    const yFmt = fmt(yAxisFormat);

    // ---------- 1. Kiểm tra data ----------
    if (!queriesData || !queriesData[0] || !queriesData[0].data || queriesData[0].data.length === 0) {
        // Return empty chart
        return {
            refs,
            formData,
            width,
            height,
            echartOptions: {
                series: [],
                xAxis: { type: 'value' },
                yAxis: { type: 'value' },
            },
            onFocusedSeries: () => { },
            onLegendStateChanged,
            capabilityMetrics: {
                cp: null, cpk: null, pp: null, ppk: null,
                mean: 0, stdDev: 0, n: 0,
                lsl: null, usl: null, target: null, ucl: null, lcl: null,
                custom: {},
            },
        };
    }

    const { data } = queriesData[0];

    // Log field names of first row for debugging
    if (data[0]) {
        console.log('[CycleTimeCapability] Fields:', Object.keys(data[0]).join(', '));
        console.log('[CycleTimeCapability] First row:', JSON.stringify(data[0]));
    }

    // ---------- 2. Đọc statistics từ row đầu ----------
    const r0 = data[0];
    const mean = getNum(r0, 'MEAN');
    const sigma = getNum(r0, 'SIGMA') || 1;
    const n = getNum(r0, 'N');
    const lsl = getNum(r0, 'LSL');
    const usl = getNum(r0, 'USL');
    const target = getNum(r0, 'TARGET');
    const ucl = getNum(r0, 'PLUS_3_SIGMA');
    const lclVal = getNum(r0, 'MINUS_3_SIGMA');
    const cp = getNum(r0, 'CP') || null;
    const cpk = getNum(r0, 'CPK') || null;

    // ---------- Dynamic metrics added via the Metrics control ----------
    const customMetrics: Record<string, number> = {};
    metricLabels.forEach(label => {
        customMetrics[label] = getNum(r0, label);
    });

    // ---------- 2. Bar series (histogram) ----------
    const seriesName = column ? getColumnLabel(column) : 'Frequency';
    const chartData: [number, number][] = data.map(d => [getNum(d, 'BIN_CENTER'), getNum(d, 'FREQUENCY')]);

    const series: (BarSeriesOption | LineSeriesOption)[] = [{
        name: seriesName,
        type: 'bar',
        data: chartData,
        itemStyle: { color: colorFn(seriesName, sliceId) },
        label: {
            show: showValue,
            position: 'inside',
            formatter: (p: any) => {
                const val = Array.isArray(p.value) ? p.value[1] : p.value;
                return yFmt.format(val);
            },
        },
    }];

    // ---------- 3. Normal curve (sử dụng NORMAL_Y từ SQL) ----------
    if (showNormalCurve && data.length > 0) {
        const curveData: [number, number][] = data
            .map(d => [getNum(d, 'BIN_CENTER'), getNum(d, 'NORMAL_Y')] as [number, number])
            .filter(([, y]) => y > 0);

        const cssColor = rgbToCss(normalCurveColor);
        series.push({
            name: 'NORMAL_Y',
            type: 'line',
            data: curveData,
            smooth: true,
            showSymbol: false,
            lineStyle: { color: cssColor, width: 2, opacity: normalCurveOpacity },
            itemStyle: { color: cssColor },
            areaStyle: { color: cssColor, opacity: (normalCurveOpacity || 0.8) * 0.15 },
            z: 2,
        });
    }

    // ---------- 4. Reference lines from referenceLines array ----------
    // Build a lookup from column name to computed value
    const computedValues: Record<string, number> = {
        'LSL': lsl,
        'USL': usl,
        'TARGET': target,
        'MEAN': mean,
        'PLUS_3_SIGMA': ucl,
        'MINUS_3_SIGMA': lclVal,
    };

    const markLineData: any[] = [];
    for (const cfg of referenceLines) {
        if (!cfg.show || !cfg.field) continue;

        const val = computedValues[cfg.field] ?? getNum(r0, cfg.field);
        if (val === null || val === undefined || val === 0) continue;

        if (cfg.showValue) {
            // Value at top
            markLineData.push({
                xAxis: val,
                label: {
                    show: true,
                    formatter: val.toFixed(2),
                    position: cfg.labelPosition || 'start',
                    fontSize: 10,
                    rotate: 0,
                },
                lineStyle: {
                    color: rgbToCss(cfg.color),
                    type: cfg.lineStyle as 'solid' | 'dashed' | 'dotted',
                    width: cfg.width,
                    opacity: cfg.opacity,
                },
                tooltip: {
                    formatter: () => `${cfg.label}: ${val.toFixed(2)}`,
                },
            });
        }
        else {
            // Simple line without labels
            markLineData.push({
                xAxis: val,
                label: {
                    show: true,
                    formatter: cfg.label,
                    position: 'end',
                    fontSize: 11,
                    rotate: 0,
                },
                lineStyle: {
                    color: rgbToCss(cfg.color),
                    type: cfg.lineStyle as 'solid' | 'dashed' | 'dotted',
                    width: cfg.width,
                    opacity: cfg.opacity,
                },
                tooltip: {
                    formatter: () => `${cfg.label}: ${val.toFixed(2)}`,
                },
                symbol: 'none',
            });
        }
        // Label (name) always shown at bottom if showLabel is enabled
        if (cfg.showLabel) {
            markLineData.push({
                xAxis: val,
                label: {
                    show: true,
                    formatter: cfg.label,
                    position: 'end',
                    fontSize: 11,
                    rotate: 0,
                },
                lineStyle: {
                    color: rgbToCss(cfg.color),
                    type: cfg.lineStyle as 'solid' | 'dashed' | 'dotted',
                    width: 0,
                    opacity: cfg.opacity,
                },
                tooltip: {
                    formatter: () => `${cfg.label}: ${val.toFixed(2)}`,
                },
                symbol: 'none',
            });
        } else {
            // Simple line without labels
            markLineData.push({
                xAxis: val,
                label: { show: false },
                lineStyle: {
                    color: rgbToCss(cfg.color),
                    type: cfg.lineStyle as 'solid' | 'dashed' | 'dotted',
                    width: cfg.width,
                    opacity: cfg.opacity,
                },
                tooltip: {
                    formatter: () => `${cfg.label}: ${val.toFixed(2)}`,
                },
                symbol: 'none',
            });
        }
    }

    // Add markLines to the bar series
    if (markLineData.length > 0 && series.length > 0) {
        (series[0] as any).markLine = {
            silent: true,
            symbol: 'none',
            data: markLineData,
        };
    }

    // ---------- 5. Legend ----------
    const legendOpts = series.map(s => s.name as string).filter(Boolean);
    if (isEmpty(legendState)) {
        legendOpts.forEach(l => { legendState[l] = true; });
    }

    // ---------- 6. Tooltip ----------
    const tooltipFormatter = (params: CallbackDataParams[]) => {
        const title = params[0].name;
        const rows = params.map(p => {
            const val = Array.isArray((p as any).value) ? (p as any).value[1] : (p as any).value;
            return [`${p.marker}${p.seriesName}`, yFmt.format(val)];
        });
        return tooltipHtml(rows, title, focusedSeries);
    };

    const onFocusedSeries = (index?: number) => { focusedSeries = index; };

    // ---------- 7. Xử lý bin bounds (mở rộng để bao gồm reference lines) ----------
    const binCenters = data.map(d => getNum(d, 'BIN_CENTER'));
    const binStart = Math.min(...binCenters);
    const binEnd = Math.max(...binCenters);
    const binWidth = binCenters.length > 1 ? (binEnd - binStart) / (binCenters.length - 1) : 1;

    // Collect all reference line values to extend chart bounds
    const refValues = [
        lsl, usl, target, mean, ucl, lclVal,
    ].filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v !== 0);
    const minRef = refValues.length > 0 ? Math.min(...refValues) : Infinity;
    const maxRef = refValues.length > 0 ? Math.max(...refValues) : -Infinity;

    const chartMin = Math.min(binStart - binWidth, minRef - binWidth);
    const chartMax = Math.max(binEnd + binWidth, maxRef + binWidth);

    const echartOptions: ComposeOption<GridComponentOption | BarSeriesOption | LineSeriesOption> = {
        grid: { left: `${y_axis_label_margin}%`, right: '5%', top: '10%', bottom: '10%', containLabel: false },
        xAxis: {
            type: 'value',
            // name: xAxisTitle,
            nameGap: 35,
            nameLocation: 'middle',
            axisLabel: { formatter: (v: number) => xFmt.format(v) },
            min: chartMin,
            max: chartMax,
        },
        yAxis: {
            type: 'value',
            scale: true,
            name: yAxisTitle,
            nameGap: 40,
            nameLocation: 'middle',
            axisLabel: {
                formatter: (v: number) => yFmt.format(v),
                margin: y_axis_label_margin * 2,
            },
        },
        series,
        legend: {
            ...getLegendProps(LegendType.Scroll, LegendOrientation.Top, showLegend, theme, false, legendState),
            data: legendOpts,
        },
        tooltip: {
            ...getDefaultTooltip(refs),
            trigger: 'axis',
            formatter: tooltipFormatter,
        },
    };

    return {
        refs,
        formData,
        width,
        height,
        echartOptions,
        onFocusedSeries,
        onLegendStateChanged,
        capabilityMetrics: {
            cp, cpk, pp: cp, ppk: cpk,
            mean, stdDev: sigma, n,
            lsl: lsl || null,
            usl: usl || null,
            target: target || null,
            ucl: ucl || null,
            lcl: lclVal || null,
            custom: customMetrics,
        },
    };
}