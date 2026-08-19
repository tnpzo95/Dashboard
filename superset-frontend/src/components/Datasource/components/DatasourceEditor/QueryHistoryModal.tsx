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
import { useState, useEffect, useCallback } from 'react';
import { css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { Button, Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import copyTextToClipboard from 'src/utils/copy';

interface HistoryEntry {
  id: number;
  sql: string;
  changed_on: string | null;
  changed_by: string | null;
}

interface QueryHistoryModalProps {
  datasetId: number;
  open: boolean;
  onClose: () => void;
  onRestoreSQL: (sql: string) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function QueryHistoryModal({
  datasetId,
  open,
  onClose,
  onRestoreSQL,
}: QueryHistoryModalProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!open || !datasetId) return;
    setLoading(true);
    try {
      const res = await SupersetClient.get({
        endpoint: `/api/v1/dataset/${datasetId}/query_history/`,
      });
      setEntries((res.json as any).result || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [open, datasetId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCopy = (entry: HistoryEntry) => {
    copyTextToClipboard(() => Promise.resolve(entry.sql)).then(() => {
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleRestore = (entry: HistoryEntry) => {
    onRestoreSQL(entry.sql);
    onClose();
  };

  return (
    <Modal
      title={t('SQL Query History')}
      show={open}
      onHide={onClose}
      footer={
        <Button buttonStyle="secondary" onClick={onClose}>
          {t('Close')}
        </Button>
      }
      width="800px"
    >
      {loading && <div css={css`text-align: center; padding: 24px;`}>{t('Loading...')}</div>}
      {!loading && entries.length === 0 && (
        <div css={css`text-align: center; padding: 24px; color: #999;`}>
          {t('No query history found for this dataset.')}
        </div>
      )}
      {!loading && entries.map(entry => (
        <div
          key={entry.id}
          css={theme => css`
            border: 1px solid ${theme.colorBorderSecondary};
            border-radius: ${theme.borderRadius}px;
            margin-bottom: ${theme.sizeUnit * 3}px;
            overflow: hidden;
          `}
        >
          <div
            css={theme => css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
              background: ${theme.colorFillTertiary};
              cursor: pointer;
            `}
            role="button"
            tabIndex={0}
            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            onKeyDown={e => e.key === 'Enter' && setExpandedId(expandedId === entry.id ? null : entry.id)}
          >
            <div css={css`display: flex; align-items: center; gap: 12px;`}>
              <Icons.HistoryOutlined iconSize="s" />
              <span css={theme => css`font-weight: ${theme.fontWeightStrong}; font-size: ${theme.fontSizeSM}px;`}>
                {formatDate(entry.changed_on)}
              </span>
              {entry.changed_by && (
                <span css={theme => css`color: ${theme.colorTextSecondary}; font-size: ${theme.fontSizeSM}px;`}>
                  {t('by')} {entry.changed_by}
                </span>
              )}
            </div>
            <div css={css`display: flex; gap: 8px;`}>
              <Button
                buttonSize="xsmall"
                buttonStyle="secondary"
                tooltip={copiedId === entry.id ? t('Copied!') : t('Copy SQL')}
                onClick={e => { e.stopPropagation(); handleCopy(entry); }}
                icon={<Icons.CopyOutlined iconSize="xs" />}
              >
                {copiedId === entry.id ? t('Copied!') : t('Copy')}
              </Button>
              <Button
                buttonSize="xsmall"
                buttonStyle="primary"
                tooltip={t('Restore this SQL to the editor')}
                onClick={e => { e.stopPropagation(); handleRestore(entry); }}
                icon={<Icons.ReloadOutlined iconSize="xs" />}
              >
                {t('Restore')}
              </Button>
            </div>
          </div>
          {expandedId === entry.id && (
            <pre
              css={theme => css`
                margin: 0;
                padding: ${theme.sizeUnit * 3}px;
                background: ${theme.colorBgContainer};
                font-size: ${theme.fontSizeSM}px;
                font-family: ${theme.fontFamilyCode};
                white-space: pre-wrap;
                word-break: break-all;
                max-height: 300px;
                overflow-y: auto;
              `}
            >
              {entry.sql}
            </pre>
          )}
        </div>
      ))}
    </Modal>
  );
}
