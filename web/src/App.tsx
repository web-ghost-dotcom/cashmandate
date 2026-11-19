import { MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { BlockedAttempts } from './components/BlockedAttempts';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Ledger } from './components/Ledger';
import { MandateDrafter } from './components/MandateDrafter';
import { PolicyPlayground } from './components/PolicyPlayground';
import { useMandateRecord } from './hooks/useMandateRecord';

const AgentConsole = lazy(async function loadAgentConsole() {
  const module = await import('./components/AgentConsole');
  return { default: module.AgentConsole };
});

export function App() {
  const recordState = useMandateRecord();
  const record = recordState.status === 'ready' ? recordState.record : null;

  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <main>
        <Hero recordState={recordState} />
        <PolicyPlayground record={record} />
        <Ledger record={record} />
        <BlockedAttempts record={record} />
        <Suspense fallback={null}>
          <AgentConsole />
        </Suspense>
        <MandateDrafter record={record} />
      </main>
      <Footer />
    </MotionConfig>
  );
}
