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
import { Behavior } from '@superset-ui/core';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import { LineAndKPIChartProps, LineAndKPIFormData } from './types';
import { EchartsChartPlugin } from '../types';

const metadata = {
    category: t('MES Dashboard'),
    description: t(
        'Modern manufacturing MES dashboard combining a line chart with KPI cards. ' +
        'Displays time-series data on the left and key performance indicators on the right.',
    ),
    name: t('Line And KPI'),
    tags: [
        t('ECharts'),
        t('MES'),
        t('Manufacturing'),
        t('KPI'),
        t('Line'),
        t('Dashboard'),
        t('Featured'),
    ],
    thumbnail,
    thumbnailDark,
    behaviors: [Behavior.DrillToDetail],
};

export default class LineAndKPIChartPlugin extends EchartsChartPlugin<
    LineAndKPIFormData,
    LineAndKPIChartProps
> {
    constructor() {
        super({
            loadChart: () => import('./LineAndKPIViz'),
            metadata,
            buildQuery,
            transformProps,
            controlPanel,
        });
    }
}