/**
 * Whether this device should hold the price socket open or poll instead.
 *
 * The socket is not free. It delivers ~104 frames a second for the two symbols,
 * which on a phone means the modem never drops to idle and the battery pays for
 * it as heat. A desktop on mains power and wired networking has no such problem
 * and gets the better feed.
 *
 * The test is `pointer: coarse` — a touchscreen as the primary input. It is a
 * proxy, and a touchscreen laptop will be treated as a phone: it then polls
 * every few seconds instead of streaming, which is a slightly slower readout and
 * nothing worse. Getting it wrong in the other direction — streaming to a phone
 * — is the failure that prompted this.
 *
 * Not user-agent sniffing: what matters is the class of device, and a pointer
 * query answers that without a string to keep up to date.
 */
export function prefersPolledFeed(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}
