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
import { FormItem, Input, FormInstance } from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';
import { ValidationObject } from 'src/components/Modal/useModalValidation';
import getUserGuideUrl from 'src/dashboard/util/getUserGuideUrl';

interface BasicInfoSectionProps {
  form: FormInstance;
  validationStatus: ValidationObject;
}

const BasicInfoSection = ({
  form,
  validationStatus,
}: BasicInfoSectionProps) => {
  const titleValue = form.getFieldValue('title');
  const hasError =
    validationStatus.basic?.hasErrors &&
    (!titleValue || titleValue.trim().length === 0);
  const userGuideUrl: string = form.getFieldValue('userGuideUrl') || '';
  const hasGuideUrlError =
    validationStatus.basic?.hasErrors &&
    userGuideUrl.trim() &&
    !getUserGuideUrl(userGuideUrl);

  return (
    <>
      <ModalFormField
        label={t('Name')}
        required
        testId="dashboard-name-field"
        error={hasError ? t('Dashboard name is required') : undefined}
      >
        <FormItem
          name="title"
          noStyle
          rules={[
            {
              required: true,
              message: t('Dashboard name is required'),
              whitespace: true,
            },
          ]}
        >
          <Input
            placeholder={t('The display name of your dashboard')}
            data-test="dashboard-title-input"
            type="text"
          />
        </FormItem>
      </ModalFormField>
      <ModalFormField label={t('URL Slug')} testId="dashboard-slug-field">
        <FormItem name="slug" noStyle>
          <Input
            placeholder={t('A readable URL for your dashboard')}
            data-test="dashboard-slug-input"
            type="text"
          />
        </FormItem>
      </ModalFormField>
      <ModalFormField
        label={t('User guide URL')}
        helperText={t(
          'Opens the user guide in a new tab. Leave empty to hide the button.',
        )}
        error={
          hasGuideUrlError
            ? t('Enter a valid URL starting with http:// or https://')
            : undefined
        }
        testId="dashboard-user-guide-field"
        bottomSpacing={false}
      >
        <FormItem
          name="userGuideUrl"
          noStyle
          rules={[
            {
              validator: (_, value: string) =>
                !value?.trim() || getUserGuideUrl(value)
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        t(
                          'Enter a valid URL starting with http:// or https://',
                        ),
                      ),
                    ),
            },
          ]}
        >
          <Input
            aria-label={t('User guide URL')}
            placeholder="https://example.com/dashboard-guide"
            data-test="dashboard-user-guide-input"
            type="text"
          />
        </FormItem>
      </ModalFormField>
    </>
  );
};

export default BasicInfoSection;
