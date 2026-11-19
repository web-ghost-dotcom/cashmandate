import { mandateRecordSchema, type MandateRecord } from '../../../src/core/mandateRecord';

export async function loadMandateRecord(): Promise<MandateRecord> {
  const response = await fetch('/mandate.json');
  if (!response.ok) {
    throw new Error(`The mandate record could not be loaded (status ${response.status})`);
  }
  return mandateRecordSchema.parse(await response.json());
}
