/**
 * Liveness signal for the container healthcheck.
 *
 * Device state is published only when it changes, so "time since last publish"
 * is not liveness: a console left in standby overnight is silent and perfectly
 * healthy. What does run on a fixed interval is the device check loop, so that
 * is what gets recorded here.
 */
let lastPollAt = 0

export function markPoll(): void {
  lastPollAt = Date.now()
}

export function pollAgeMs(): number | undefined {
  return lastPollAt === 0 ? undefined : Date.now() - lastPollAt
}
