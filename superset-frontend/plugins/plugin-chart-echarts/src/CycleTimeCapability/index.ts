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
import { ChartMetadata, ChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from '../Histogram/images/thumbnail.png';
import thumbnailDark from '../Histogram/images/thumbnail-dark.png';
import {
    CycleTimeCapabilityChartProps,
    CycleTimeCapabilityFormData,
} from './types';

export default class EchartsCycleTimeCapabilityChartPlugin extends ChartPlugin<
    CycleTimeCapabilityFormData,
    CycleTimeCapabilityChartProps
> {
    constructor() {
        super({
            buildQuery,
            controlPanel,
            loadChart: () => import('./CycleTimeCapability'),
            metadata: new ChartMetadata({
                credits: ['https://echarts.apache.org'],
                category: t('Distribution'),
                description: t(
                    `Cycle Time Capability Analysis - displays a histogram with normal distribution curve,
                     specification limits and process capability metrics (Cp, Cpk).`,
                ),
                name: t('Cycle Time Capability Analysis'),
                tags: [
                    t('Distribution'),
                    t('ECharts'),
                    t('Statistical'),
                    t('Process Control'),
                    t('Quality'),
                ],
                thumbnail,
                thumbnailDark,
            }),
            transformProps,
        });
    }
}