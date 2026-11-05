'use client';
import { useState } from 'react';
import { DEFAULT_MOCK_CONFIG, MOCK_PERSONAS, MOCK_SCENARIOS, readMockConfig, writeMockConfig, type MockConfig } from '@/mocks/scenarios';
import { resetMockSignup } from '@/mocks/data';

/** Explicit opt-in fixture controls. Never mounted when API mocking is off. */
export function MockControls() {
  const [config, setConfig] = useState<MockConfig>(() => readMockConfig());
  if (process.env.NEXT_PUBLIC_API_MOCK !== 'true') return null;
  function update(changes: Partial<MockConfig>) {
    const next = { ...config, ...changes }; writeMockConfig(next); setConfig(next);
    // Reload gates all queries on worker startup and prevents stale persona data.
    window.location.reload();
  }
  return <details className="fixed bottom-3 left-3 z-40 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-3 text-xs shadow-lg">
    <summary className="cursor-pointer font-semibold">API mocks · {config.persona}</summary>
    <div className="mt-3 grid gap-3">
      <label>Persona<select aria-label="Mock persona" value={config.persona} onChange={(event) => update({ persona: event.target.value as MockConfig['persona'] })} className="mt-1 block min-h-11 rounded border border-line px-2">{MOCK_PERSONAS.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Response<select aria-label="Mock response" value={config.scenario} onChange={(event) => update({ scenario: event.target.value as MockConfig['scenario'] })} className="mt-1 block min-h-11 rounded border border-line px-2">{MOCK_SCENARIOS.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Supplier status<select aria-label="Mock supplier status" value={config.supplierStatus} onChange={(event) => update({ supplierStatus: event.target.value as MockConfig['supplierStatus'] })} className="mt-1 block min-h-11 rounded border border-line px-2">{['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <button type="button" className="min-h-11 rounded border border-line" onClick={() => update(DEFAULT_MOCK_CONFIG)}>Reset selectors</button>
      <button type="button" className="min-h-11 rounded border border-line" onClick={() => { resetMockSignup(); update(DEFAULT_MOCK_CONFIG); }}>Reset mock signup</button>
      <p>Fixtures only. Selectors reload this tab. Product/admin edits live in this tab’s worker; mock signup membership is shared across tabs.</p>
    </div>
  </details>;
}
