import { useId } from 'react';
import type { ModelSettings } from '../agent/modelClient';
import styles from './ModelSettingsForm.module.css';

interface ModelSettingsFormProps {
  readonly settings: ModelSettings;
  readonly onChange: (settings: ModelSettings) => void;
  readonly isDisabled: boolean;
}

export function ModelSettingsForm({ settings, onChange, isDisabled }: ModelSettingsFormProps) {
  const formId = useId();

  function updateField(fieldName: keyof ModelSettings, value: string): void {
    onChange({ ...settings, [fieldName]: value });
  }

  return (
    <fieldset className={styles.fieldset} disabled={isDisabled}>
      <legend className={styles.legend}>Model</legend>
      <p className={styles.note}>
        Any OpenAI-compatible provider that supports tool calling. Your key stays in this tab and is sent only to the
        address below.
      </p>
      <label className={styles.field} htmlFor={`${formId}-key`}>
        <span>API key</span>
        <input
          id={`${formId}-key`}
          className={styles.input}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste a key to run the agent"
          value={settings.apiKey}
          onChange={function onKeyChange(event) {
            updateField('apiKey', event.target.value);
          }}
        />
      </label>
      <div className={styles.row}>
        <label className={styles.field} htmlFor={`${formId}-url`}>
          <span>Provider address</span>
          <input
            id={`${formId}-url`}
            className={styles.input}
            type="url"
            value={settings.baseUrl}
            onChange={function onUrlChange(event) {
              updateField('baseUrl', event.target.value);
            }}
          />
        </label>
        <label className={styles.field} htmlFor={`${formId}-model`}>
          <span>Model</span>
          <input
            id={`${formId}-model`}
            className={styles.input}
            value={settings.model}
            onChange={function onModelChange(event) {
              updateField('model', event.target.value);
            }}
          />
        </label>
      </div>
    </fieldset>
  );
}
