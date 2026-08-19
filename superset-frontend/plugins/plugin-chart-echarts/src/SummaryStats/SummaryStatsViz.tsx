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
import { styled, css } from '@apache-superset/core/theme';
import { SummaryStatsVizProps } from './types';

const Container = styled.div`
    ${({ theme }) => css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow: auto;
        padding: ${theme.sizeUnit * 2}px;
        font-family: ${theme.fontFamily};
    `}
`;

const Table = styled.table`
    ${({ theme }) => css`
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        color: ${theme.colorText};
    `}
`;

const Td = styled.td`
    ${({ theme }) => css`
        border: 1px solid ${theme.colorBorderSecondary};
        padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 2}px;
        font-size: ${theme.fontSizeSM}px;
        white-space: nowrap;
    `}
`;

const LabelCell = styled(Td)`
    background: ${({ theme }) => theme.colorBgLayout};
    font-weight: ${({ theme }) => theme.fontWeightBold};
    color: ${({ theme }) => theme.colorTextSecondary};
    text-align: right;
    width: 12.5%;
`;

const ValueCell = styled(Td)`
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizeXL}px;
    font-weight: ${({ theme }) => theme.fontWeightBold};
    width: 12.5%;
    color: ${({ theme }) => theme.colorPrimary};
`;

export default function SummaryStatsViz({
    width,
    height,
    rows,
}: SummaryStatsVizProps) {
    return (
        <Container>
            <Table>
                <tbody>
                    {rows.map((row, ri) => (
                        <tr key={ri}>
                            {row.cells.flatMap((cell, ci) => [
                                <LabelCell key={`l${ri}-${ci}`}>{cell.label}</LabelCell>,
                                <ValueCell key={`v${ri}-${ci}`}>{cell.value}</ValueCell>,
                            ])}
                        </tr>
                    ))}
                </tbody>
            </Table>
        </Container>
    );
}
