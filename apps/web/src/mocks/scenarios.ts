export const MOCK_SCENARIOS = ['success', 'empty', '401', '403', '404', '409', '422', 'slow'] as const;
export type MockScenario = typeof MOCK_SCENARIOS[number];
export const MOCK_PERSONAS = ['OWNER', 'MANAGER', 'STAFF', 'ADMIN', 'NEW_USER'] as const;
export type MockPersona = typeof MOCK_PERSONAS[number];
export type MockConfig = { scenario: MockScenario; persona: MockPersona; supplierStatus: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' };
export const DEFAULT_MOCK_CONFIG: MockConfig = { scenario: 'success', persona: 'OWNER', supplierStatus: 'APPROVED' };
const KEY = 'sellonit.api-mock.config';

/** Only fixture selectors, never credentials or authorization state for real requests. */
export function readMockConfig(): MockConfig {
  if (typeof window === 'undefined') return DEFAULT_MOCK_CONFIG;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? '{}');
    if (typeof value !== 'object' || value === null) return DEFAULT_MOCK_CONFIG;
    const candidate = value as Record<string, unknown>;
    return {
      scenario: MOCK_SCENARIOS.includes(candidate.scenario as MockScenario) ? candidate.scenario as MockScenario : 'success',
      persona: MOCK_PERSONAS.includes(candidate.persona as MockPersona) ? candidate.persona as MockPersona : 'OWNER',
      supplierStatus: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(candidate.supplierStatus as string) ? candidate.supplierStatus as MockConfig['supplierStatus'] : 'APPROVED',
    };
  } catch { return DEFAULT_MOCK_CONFIG; }
}
export function writeMockConfig(config: MockConfig): void {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(config)); } catch { /* In-memory fixture defaults still work. */ }
}
