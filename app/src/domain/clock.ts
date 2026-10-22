/** Injectable so tests can produce deterministic, ordered timestamps. */
export type Clock = () => string

export const systemClock: Clock = () => new Date().toISOString()

export function newId(): string {
  return crypto.randomUUID()
}
