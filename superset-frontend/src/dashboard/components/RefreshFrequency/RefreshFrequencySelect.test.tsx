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
import {
  decodeScheduledRefresh,
  encodeDailyScheduledRefresh,
  encodeHourlyScheduledRefresh,
  getNextRefreshDelayMs,
  getRefreshFrequencyLabel,
  getRefreshWarningMessage,
  validateRefreshFrequency,
} from './RefreshFrequencySelect';

test('validateRefreshFrequency treats millisecond refreshLimit as seconds', () => {
  const errors = validateRefreshFrequency(5, 10000);

  expect(errors[0]).toContain('10');
});

test('validateRefreshFrequency treats second refreshLimit as seconds', () => {
  const errors = validateRefreshFrequency(5, 10);

  expect(errors[0]).toContain('10');
});

test('getRefreshWarningMessage normalizes refreshLimit', () => {
  expect(getRefreshWarningMessage(5, 10000, 'warn')).toBe('warn');
  expect(getRefreshWarningMessage(5, 10, 'warn')).toBe('warn');
  expect(getRefreshWarningMessage(15, 10000, 'warn')).toBeNull();
});

test('encodes and decodes custom daily scheduled refresh frequency', () => {
  const frequency = encodeDailyScheduledRefresh(7, 30);

  expect(decodeScheduledRefresh(frequency)).toEqual({
    type: 'daily',
    hour: 7,
    minute: 30,
  });
  expect(getRefreshFrequencyLabel(frequency)).toBe('Every day at 07:30');
});

test('encodes and decodes custom hourly scheduled refresh frequency', () => {
  const frequency = encodeHourlyScheduledRefresh(5);

  expect(decodeScheduledRefresh(frequency)).toEqual({
    type: 'hourly',
    minute: 5,
  });
  expect(getRefreshFrequencyLabel(frequency)).toBe('Every hour at minute 05');
});

test('gets the next delay for custom daily scheduled refresh frequency', () => {
  const frequency = encodeDailyScheduledRefresh(12, 0);
  const currentDate = new Date('2026-06-07T11:30:00');

  expect(getNextRefreshDelayMs(frequency, currentDate)).toBe(30 * 60 * 1000);
});

test('gets the next delay for custom hourly scheduled refresh frequency', () => {
  const frequency = encodeHourlyScheduledRefresh(5);
  const currentDate = new Date('2026-06-07T11:06:00');

  expect(getNextRefreshDelayMs(frequency, currentDate)).toBe(59 * 60 * 1000);
});
