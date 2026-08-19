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
import thumbnail from '../../../plugin-chart-table/src/images/thumbnail.png';
import thumbnailDark from '../../../plugin-chart-table/src/images/thumbnail-dark.png';
import {
    SummaryStatsChartProps,
    SummaryStatsFormData,
} from './types';

export default class EchartsSummaryStatsChartPlugin extends ChartPlugin<
    SummaryStatsFormData,
    SummaryStatsChartProps
> {
    constructor() {
        super({
            buildQuery,
            controlPanel,
            loadChart: () => import('./SummaryStatsViz'),
            metadata: new ChartMetadata({
                credits: ['https://echarts.apache.org'],
                category: t('EMI'),
                description: t(
                    'Summary Statistics Table - 4x4 table with Mean, Sigma, CP, CPK, PP, PPK',
                ),
                name: t('Summary Statistics'),
                tags: [t('EMI'), t('SPC'), t('Statistics'), t('Report')],
                thumbnail,
                thumbnailDark,
            }),
            transformProps,
        });
    }
}