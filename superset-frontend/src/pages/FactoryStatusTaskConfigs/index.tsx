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
import { useCallback, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import { Button, Input, Switch } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskConfig = {
    id: number;
    name: string;
    description: string | null;
    task_type: string;
    sql_query: string;
    interval_min: number;
    layout_name: string;
    is_active: boolean;
    last_run_at: string | null;
    last_run_result: string | null;
};

type EditState = {
    sql_query: string;
    interval_min: number;
    is_active: boolean;
};

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Page = styled.div`
  ${({ theme }) => css`
    max-width: 900px;
    margin: 0 auto;
    padding: ${theme.sizeUnit * 6}px ${theme.sizeUnit * 4}px;
  `}
`;

const PageTitle = styled.h1`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeXL}px;
    font-weight: ${theme.fontWeightStrong};
    margin-bottom: ${theme.sizeUnit * 6}px;
    color: ${theme.colorText};
  `}
`;

const Card = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    margin-bottom: ${theme.sizeUnit * 6}px;
    background: ${theme.colorBgContainer};
    overflow: hidden;
  `}
`;

const CardHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 5}px;
    border-bottom: 1px solid ${theme.colorBorder};
    background: ${theme.colorFillAlter};
  `}
`;

const CardHeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TaskName = styled.span`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeLG}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

const TaskType = styled.span`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    font-family: ${theme.fontFamilyCode};
  `}
`;

const CardBody = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 5}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 4}px;
  `}
`;

const FieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FieldLabel = styled.label`
  ${({ theme }) => css`
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

const FieldHint = styled.span`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

const SqlArea = styled.textarea`
  ${({ theme }) => css`
    width: 100%;
    min-height: 200px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeSM}px;
    line-height: 1.6;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    resize: vertical;
    background: ${theme.colorBgLayout};
    color: ${theme.colorText};
    outline: none;

    &:focus {
      border-color: ${theme.colorPrimary};
      box-shadow: 0 0 0 2px ${theme.colorPrimaryBg};
    }
  `}
`;

const InlineRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

const MetaRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    gap: ${theme.sizeUnit * 6}px;
    padding-top: ${theme.sizeUnit * 3}px;
    border-top: 1px solid ${theme.colorBorderSecondary};
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const MetaItem = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MetaLabel = styled.span`
  ${({ theme }) => css`
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const CardFooter = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: flex-end;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 5}px;
    border-top: 1px solid ${theme.colorBorder};
    background: ${theme.colorFillAlter};
  `}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FactoryStatusTaskConfigs() {
    const { addSuccessToast, addDangerToast } = useToasts();
    const [configs, setConfigs] = useState<TaskConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [editStates, setEditStates] = useState<Record<number, EditState>>({});
    const [saving, setSaving] = useState<Record<number, boolean>>({});
    const [dirty, setDirty] = useState<Record<number, boolean>>({});

    // ── Load ──────────────────────────────────────────────────────────────────

    const fetchConfigs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await SupersetClient.get({
                endpoint: '/api/v1/factory_status/task_configs/',
            });
            const data = res.json as { result: TaskConfig[] };
            const list = data.result ?? [];
            setConfigs(list);
            // Init edit states from server values
            const states: Record<number, EditState> = {};
            list.forEach(c => {
                states[c.id] = {
                    sql_query: c.sql_query,
                    interval_min: c.interval_min,
                    is_active: c.is_active,
                };
            });
            setEditStates(states);
            setDirty({});
        } catch {
            addDangerToast(t('Failed to load task configs'));
        } finally {
            setLoading(false);
        }
    }, [addDangerToast]);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    // ── Field change ──────────────────────────────────────────────────────────

    const handleChange = useCallback(
        (id: number, field: keyof EditState, value: EditState[keyof EditState]) => {
            setEditStates(prev => ({
                ...prev,
                [id]: { ...prev[id], [field]: value },
            }));
            setDirty(prev => ({ ...prev, [id]: true }));
        },
        [],
    );

    // ── Save ──────────────────────────────────────────────────────────────────

    const handleSave = useCallback(
        async (config: TaskConfig) => {
            const state = editStates[config.id];
            if (!state) return;

            if (!state.sql_query.trim()) {
                addDangerToast(t('SQL query must not be empty'));
                return;
            }
            if (state.interval_min < 1) {
                addDangerToast(t('Interval must be at least 1 minute'));
                return;
            }

            setSaving(prev => ({ ...prev, [config.id]: true }));
            try {
                await SupersetClient.put({
                    endpoint: `/api/v1/factory_status/task_configs/${config.id}`,
                    jsonPayload: {
                        sql_query: state.sql_query.trim(),
                        interval_min: state.interval_min,
                        is_active: state.is_active,
                    },
                });
                addSuccessToast(t('Saved "%s"', config.name));
                setDirty(prev => ({ ...prev, [config.id]: false }));
                // Refresh last_run_at etc.
                fetchConfigs();
            } catch {
                addDangerToast(t('Failed to save "%s"', config.name));
            } finally {
                setSaving(prev => ({ ...prev, [config.id]: false }));
            }
        },
        [editStates, addSuccessToast, addDangerToast, fetchConfigs],
    );

    // ── Reset ─────────────────────────────────────────────────────────────────

    const handleReset = useCallback(
        (config: TaskConfig) => {
            setEditStates(prev => ({
                ...prev,
                [config.id]: {
                    sql_query: config.sql_query,
                    interval_min: config.interval_min,
                    is_active: config.is_active,
                },
            }));
            setDirty(prev => ({ ...prev, [config.id]: false }));
        },
        [],
    );

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <Page>
                <PageTitle>{t('Factory Task Configs')}</PageTitle>
                <div>{t('Loading...')}</div>
            </Page>
        );
    }

    return (
        <Page>
            <PageTitle>{t('Factory Task Configs')}</PageTitle>

            {configs.map(config => {
                const state = editStates[config.id];
                const isDirty = dirty[config.id] ?? false;
                const isSaving = saving[config.id] ?? false;
                if (!state) return null;

                return (
                    <Card key={config.id}>
                        <CardHeader>
                            <CardHeaderLeft>
                                <TaskName>{config.name}</TaskName>
                                <TaskType>{config.task_type}</TaskType>
                            </CardHeaderLeft>
                            <InlineRow>
                                <span>{t('Active')}</span>
                                <Switch
                                    checked={state.is_active}
                                    onChange={checked => handleChange(config.id, 'is_active', checked)}
                                />
                            </InlineRow>
                        </CardHeader>

                        <CardBody>
                            {config.description && (
                                <FieldHint>{config.description}</FieldHint>
                            )}

                            <FieldRow>
                                <FieldLabel>{t('SQL Query')}</FieldLabel>
                                <SqlArea
                                    value={state.sql_query}
                                    onChange={e =>
                                        handleChange(config.id, 'sql_query', e.target.value)
                                    }
                                    spellCheck={false}
                                />
                            </FieldRow>

                            <FieldRow>
                                <FieldLabel>{t('Interval (minutes)')}</FieldLabel>
                                <Input
                                    type="number"
                                    value={state.interval_min}
                                    min={1}
                                    style={{ width: 120 }}
                                    onChange={e =>
                                        handleChange(
                                            config.id,
                                            'interval_min',
                                            Math.max(1, Number(e.target.value)),
                                        )
                                    }
                                />
                                <FieldHint>
                                    {t('Task runs at most once every %s minute(s)', state.interval_min)}
                                </FieldHint>
                            </FieldRow>

                            <MetaRow>
                                <MetaItem>
                                    <MetaLabel>{t('Last run')}</MetaLabel>
                                    <span>{config.last_run_at ?? '—'}</span>
                                </MetaItem>
                                <MetaItem>
                                    <MetaLabel>{t('Last result')}</MetaLabel>
                                    <span>{config.last_run_result ?? '—'}</span>
                                </MetaItem>
                            </MetaRow>
                        </CardBody>

                        <CardFooter>
                            <Button
                                buttonSize="small"
                                disabled={!isDirty || isSaving}
                                onClick={() => handleReset(config)}
                            >
                                {t('Reset')}
                            </Button>
                            <Button
                                buttonSize="small"
                                buttonStyle="primary"
                                disabled={!isDirty}
                                loading={isSaving}
                                onClick={() => handleSave(config)}
                            >
                                {t('Save')}
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </Page>
    );
}
