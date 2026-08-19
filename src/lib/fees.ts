/** IBKR Pro Fixed (EE.UU.), más un extra chico de bolsa/OCC. Ida y vuelta = abrir y cerrar. */
export const IBKR = {
  id: "ibkr",
  name: "IBKR",
  optionPer: 0.65,
  optionExch: 0.03,
  optionMin: 1,
  stockPerShare: 0.005,
  stockMin: 1,
} as const;

export function optionOpenFee(contracts: number) {
  if (contracts <= 0) return 0;
  return Math.max(IBKR.optionMin, contracts * (IBKR.optionPer + IBKR.optionExch));
}

export function optionRoundTripFee(contracts: number) {
  return optionOpenFee(contracts) * 2;
}

export function stockFee(shares: number) {
  if (shares <= 0) return 0;
  return Math.max(IBKR.stockMin, shares * IBKR.stockPerShare);
}

export function maxOptionContracts(budget: number, debit: number) {
  if (debit <= 0) return 0;
  let n = Math.floor(budget / debit);
  while (n > 0 && n * debit + optionOpenFee(n) > budget + 0.009) n -= 1;
  return n;
}
