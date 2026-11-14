export type FeeInput = {
  contractValue: number;
  managerBps: number;
  hunterBps: number;
  cashBps: number;
  dj: number;
  mc2: number;
  soundman: number;
  mc1?: number;
};
export type FeeResult = {
  manager: number;
  hunter: number;
  cash: number;
  dj: number;
  mc2: number;
  soundman: number;
  mc1: number;
  total: number;
  difference: number;
  valid: boolean;
};
const percent = (value: number, bps: number) =>
  Math.round((value * bps) / 10_000);
export function calculateFee(input: FeeInput): FeeResult {
  const manager = percent(input.contractValue, input.managerBps);
  const hunter = percent(input.contractValue, input.hunterBps);
  const cash = percent(input.contractValue, input.cashBps);
  const fixed = input.dj + input.mc2 + input.soundman;
  const automaticRemainder =
    input.contractValue - manager - hunter - cash - fixed;
  const mc1 = input.mc1 ?? automaticRemainder;
  const total = manager + hunter + cash + fixed + Math.max(0, mc1);
  const difference = input.contractValue - total;
  return {
    manager,
    hunter,
    cash,
    dj: input.dj,
    mc2: input.mc2,
    soundman: input.soundman,
    mc1,
    total,
    difference,
    valid: difference === 0 && mc1 >= 0,
  };
}
