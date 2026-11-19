import { motion } from 'motion/react';
import type { AgentEvent } from '../agent/modelClient';
import styles from './SessionTrace.module.css';

export interface TraceEntry {
  readonly identifier: number;
  readonly stage: string;
  readonly event: AgentEvent;
}

const KIND_LABELS: Readonly<Record<AgentEvent['kind'], string>> = {
  task: 'Task',
  'agent-says': 'Agent',
  'tool-call': 'Calls',
  'tool-result': 'Result',
};

const REFUSAL_MARKERS = ['"ok":false', '"accepted":false', '"error"'] as const;
const MAXIMUM_DISPLAYED_CHARACTERS = 420;

function isRefusal(entry: TraceEntry): boolean {
  return entry.event.kind === 'tool-result' && REFUSAL_MARKERS.some(function appears(marker) {
    return entry.event.text.includes(marker);
  });
}

function describeEntry(entry: TraceEntry): string {
  const { event } = entry;
  const text = event.kind === 'tool-call' ? `${event.toolName}(${event.text})` : event.text;
  return text.length > MAXIMUM_DISPLAYED_CHARACTERS ? `${text.slice(0, MAXIMUM_DISPLAYED_CHARACTERS)}...` : text;
}

export function SessionTrace({ entries }: { readonly entries: readonly TraceEntry[] }) {
  if (entries.length === 0) {
    return <p className={styles.empty}>The session appears here as the agent works: each tool call, and what came back.</p>;
  }
  return (
    <ol className={styles.list} aria-live="polite">
      {entries.map(function renderEntry(entry) {
        const refused = isRefusal(entry);
        return (
          <motion.li
            key={entry.identifier}
            className={styles.entry}
            data-kind={entry.event.kind}
            data-refused={refused}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <span className={styles.stage}>{entry.stage}</span>
            <span className={styles.kind}>{refused ? 'Refused' : KIND_LABELS[entry.event.kind]}</span>
            <span className={styles.text}>{describeEntry(entry)}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}
