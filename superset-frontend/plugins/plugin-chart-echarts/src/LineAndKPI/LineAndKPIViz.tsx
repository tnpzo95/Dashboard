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
import { MouseEvent } from 'react';
import { styled } from '@apache-superset/core/theme';
import Echart from '../components/Echart';
import { LineAndKPIVizProps, KPIItem } from './types';

const Container = styled.div<{
    backgroundColor?: string;
    borderRadius?: number;
}>`
    ${({ theme, backgroundColor, borderRadius }) => `
        background: ${backgroundColor || theme.colorBgContainer};
        border-radius: ${borderRadius ?? 12}px;
        padding: ${theme.sizeUnit * 3}px;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
        font-family: ${theme.fontFamily};
        display: flex;
        flex-direction: column;
    `}
`;

const ContentRow = styled.div`
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 16px;
`;

const ChartArea = styled.div`
    flex: 1;
    min-width: 0;
    height: 100%;
    min-height: 0;
`;

const KPIArea = styled.div`
    width: 150px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
`;

const KPICard = styled.div<{
    borderColor?: string;
    titleColor?: string;
    valueColor?: string;
    titleFontSize?: number;
}>`
    ${({ theme, borderColor, titleColor, valueColor, titleFontSize }) => `
        background: ${theme.colorBgContainer};
        border-left: 4px solid ${borderColor || theme.colorPrimary};
        border-radius: ${theme.borderRadius}px;
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 70px;
        transition: background 0.2s;
        box-shadow: ${theme.boxShadowSecondary};
        &:hover {
            background: ${theme.colorBgLayout};
        }
    `}
`;

const KPITitle = styled.div<{ titleColor?: string; titleFontSize?: number }>`
    ${({ theme, titleColor, titleFontSize }) => `
        color: ${titleColor || theme.colorTextSecondary};
        font-size: ${titleFontSize ?? 14}px;
        font-weight: ${theme.fontWeightNormal};
        margin-bottom: ${theme.sizeUnit}px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `}
`;

const KPIValue = styled.div<{ valueColor?: string; valueFontSize?: number }>`
    ${({ theme, valueColor, valueFontSize }) => `
        color: ${valueColor || theme.colorText};
        font-size: ${valueFontSize ?? theme.fontSizeXXL}px;
        font-weight: ${theme.fontWeightBold};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `}
`;

function LineAndKPIViz({
    className = '',
    width,
    height,
    echartOptions,
    chartRefs,
    kpiItems = [],
    containerTitle,
    containerTitleColor,
    containerBackgroundColor,
    containerBorderRadius = 12,
    kpiTitleColor,
    kpiValueColor,
    kpiTitleFontSize = 14,
    showLineChart = true,
    onContextMenu,
}: LineAndKPIVizProps) {
    const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
        if (onContextMenu) {
            e.preventDefault();
            onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY);
        }
    };

    return (
        <Container
            className={`line-and-kpi-container ${className}`}
            backgroundColor={containerBackgroundColor}
            borderRadius={containerBorderRadius}
            onContextMenu={handleContextMenu}
        >
            <ContentRow>
                {showLineChart && echartOptions && (
                    <ChartArea>
                        <Echart
                            width={width - 150}
                            height={height}
                            echartOptions={echartOptions}
                            refs={chartRefs}
                        />
                    </ChartArea>
                )}
                {kpiItems.length > 0 && (
                    <KPIArea>
                        {kpiItems.map((kpi: KPIItem, index: number) => (
                            <KPICard
                                key={index}
                                borderColor={kpi.borderColor}
                                titleColor={kpiTitleColor}
                                valueColor={kpiValueColor}
                                titleFontSize={kpi.titleFontSize ?? kpiTitleFontSize}
                            >
                                <KPITitle
                                    titleColor={kpiTitleColor}
                                    titleFontSize={kpi.titleFontSize ?? kpiTitleFontSize}
                                >
                                    {kpi.title}
                                </KPITitle>
                                <KPIValue
                                    valueColor={kpiValueColor}
                                    valueFontSize={kpi.valueFontSize}
                                >
                                    {kpi.value}
                                </KPIValue>
                            </KPICard>
                        ))}
                    </KPIArea>
                )}
            </ContentRow>
        </Container>
    );
}

export default LineAndKPIViz;