import type { Scenario } from '../engine/types';
import { assertValidScenario } from '../engine/validate';

const modules = import.meta.glob('./scenarios/*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>;

export const scenarios: Scenario[] = Object.values(modules)
  .map((m) => assertValidScenario(m.default))
  .sort((a, b) => a.id.localeCompare(b.id));

export function getScenario(id: string): Scenario {
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) throw new Error(`シナリオが見つからない: ${id}`);
  return scenario;
}
