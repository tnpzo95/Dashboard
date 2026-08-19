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
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import {
    MergedHeaderTableChartProps,
    MergedHeaderTableFormData,
} from './types';
import { EchartsChartPlugin } from '../types';

const metadata = {
    category: t('MES Dashboard'),
    description: t(
        'A table with a manually declared, multi-level merged header (colSpan/rowSpan), ' +
        'like an Excel report. Row header columns are merged (rowSpan) for consecutive ' +
        'repeated values.',
    ),
    name: t('Merged Header Table'),
    tags: [
        t('Table'),
        t('MES'),
        t('Manufacturing'),
        t('Report'),
        t('Pivot'),
    ],
    thumbnail,
    thumbnailDark,
};

export default class MergedHeaderTableChartPlugin extends EchartsChartPlugin<
    MergedHeaderTableFormData,
    MergedHeaderTableChartProps
> {
    constructor() {
        super({
            loadChart: () => import('./MergedHeaderTableViz'),
            metadata,
            buildQuery,
            transformProps,
            controlPanel,
        });
    }
}
