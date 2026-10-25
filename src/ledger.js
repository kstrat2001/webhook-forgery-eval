/**
 * An in-memory account ledger.
 *
 * Not a database: it models the two things the receiver relies on, a
 * balance per account and a record of which event ids have been applied.
 */
export class Ledger {
  #balances = new Map();
  #applied = new Set();

  balance(accountId) {
    return this.#balances.get(accountId) ?? 0;
  }

  hasApplied(eventId) {
    return this.#applied.has(eventId);
  }

  /** Apply `amount` cents to an account, remembering the event id. */
  apply(eventId, accountId, amount) {
    if (!Number.isInteger(amount)) {
      throw new Error("amount must be a whole number of cents");
    }
    this.#balances.set(accountId, this.balance(accountId) + amount);
    this.#applied.add(eventId);
  }
}
