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
import { MouseEvent, useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import {
    getNumberFormatter,
    computeMaxFontSize,
} from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/theme';
import { KPIVizProps } from './types';

const defaultNumberFormatter = getNumberFormatter();

const CardContainer = styled.div<{
    backgroundColor?: string;
    borderRadius?: number;
    cardPadding?: string;
}>`
    ${({ theme, backgroundColor, borderRadius, cardPadding }) => `
        background: ${backgroundColor || theme.colorBgContainer};
        border-radius: ${borderRadius ?? 8}px;
        padding: ${cardPadding || '16px'};
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
        font-family: ${theme.fontFamily};
    `}
`;

const TitleText = styled.div<{
    titleColor?: string;
    titleFontSize?: number;
}>`
    ${({ theme, titleColor, titleFontSize }) => `
        color: ${titleColor || theme.colorTextTertiary};
        font-size: ${titleFontSize ?? 16}px;
        font-weight: ${theme.fontWeightNormal};
        line-height: 1.4;
        margin-bottom: ${theme.sizeUnit * 2}px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    `}
`;

const ValueText = styled.div<{
    valueColor?: string;
    valueFontSize?: number;
}>`
    ${({ theme, valueColor, valueFontSize }) => `
        color: ${valueColor || theme.colorText};
        font-size: ${valueFontSize ?? 48}px;
        font-weight: ${theme.fontWeightBold};
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    `}
`;

function KPICardViz({
    className = '',
    width,
    height,
    bigNumber,
    headerFormatter = defaultNumberFormatter,
    metricName,
    showMetricName = true,
    titleFontSize = 16,
    valueFontSize = 48,
    titleColor,
    valueColor,
    backgroundColor,
    borderRadius = 8,
    padding = '16px',
    colorThresholdFormatters,
    onContextMenu,
}: KPIVizProps) {
    const theme = useTheme();

    // Format the big number value
    const formattedValue = useMemo(() => {
        if (bigNumber === null || bigNumber === undefined) {
            return t('No data');
        }
        if (typeof bigNumber === 'number') {
            return headerFormatter(bigNumber);
        }
        const numValue = Number(bigNumber);
        return Number.isNaN(numValue)
            ? String(bigNumber)
            : headerFormatter(numValue);
    }, [bigNumber, headerFormatter]);

    // Apply color threshold if any
    const resolvedValueColor = useMemo(() => {
        if (
            Array.isArray(colorThresholdFormatters) &&
            colorThresholdFormatters.length > 0 &&
            bigNumber !== null &&
            bigNumber !== undefined
        ) {
            let thresholdColor: string | false = false;
            colorThresholdFormatters.forEach(formatter => {
                const result = formatter.getColorFromValue(
                    bigNumber as number,
                );
                if (result) {
                    thresholdColor = result;
                }
            });
            if (thresholdColor) {
                return thresholdColor;
            }
        }
        return valueColor;
    }, [colorThresholdFormatters, bigNumber, valueColor]);

    // Compute responsive font size for the value
    const responsiveValueFontSize = useMemo(() => {
        const text = String(formattedValue);
        // Estimate: value area takes about 60% of height, minus title area
        const availableHeight = height * 0.55;
        const availableWidth = width * 0.85;
        // Only compute if we have a DOM context (in Superset we always do)
        try {
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.opacity = '0';
            container.style.fontWeight = String(theme.fontWeightBold);
            document.body.append(container);
            const fontSize = computeMaxFontSize({
                text,
                maxWidth: availableWidth,
                maxHeight: availableHeight,
                className: 'kpi-card-value',
                container,
            });
            container.remove();
            // Clamp between configured font size and available space
            return Math.min(fontSize, valueFontSize);
        } catch {
            return valueFontSize;
        }
    }, [formattedValue, width, height, valueFontSize, theme.fontWeightBold]);

    const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
        if (onContextMenu) {
            e.preventDefault();
            onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY);
        }
    };

    const title = showMetricName && metricName ? metricName : '';

    return (
        <CardContainer
            className={`kpi-card-container ${className}`}
            backgroundColor={backgroundColor}
            borderRadius={borderRadius}
            cardPadding={padding}
            onContextMenu={handleContextMenu}
        >
            {title && (
                <TitleText
                    titleColor={titleColor}
                    titleFontSize={titleFontSize}
                >
                    {title}
                </TitleText>
            )}
            <ValueText
                valueColor={resolvedValueColor || valueColor}
                valueFontSize={responsiveValueFontSize}
            >
                {formattedValue}
            </ValueText>
        </CardContainer>
    );
}

export default KPICardViz;