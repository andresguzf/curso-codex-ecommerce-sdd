const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const MINOR_UNITS_PER_MAJOR_UNIT = 100n;

type PricedCartLine = Readonly<{
  quantity: number;
  unitPrice: string;
}>;

export type CartTotals = Readonly<{
  lineSubtotals: readonly string[];
  subtotal: string;
  total: string;
}>;

function toMinorUnits(amount: string): bigint {
  if (!MONEY_PATTERN.test(amount)) {
    throw new Error(`Invalid fixed-precision monetary amount: ${amount}`);
  }

  const [majorUnits = "0", decimalUnits = ""] = amount.split(".");
  return (
    BigInt(majorUnits) * MINOR_UNITS_PER_MAJOR_UNIT +
    BigInt(decimalUnits.padEnd(2, "0"))
  );
}

function fromMinorUnits(amount: bigint): string {
  const majorUnits = amount / MINOR_UNITS_PER_MAJOR_UNIT;
  const decimalUnits = amount % MINOR_UNITS_PER_MAJOR_UNIT;
  return `${majorUnits}.${decimalUnits.toString().padStart(2, "0")}`;
}

export function addMoneyAmounts(...amounts: readonly string[]): string {
  return fromMinorUnits(
    amounts.reduce((total, amount) => total + toMinorUnits(amount), 0n),
  );
}

export function calculateCartTotals(
  lines: readonly PricedCartLine[],
): CartTotals {
  const lineSubtotalMinorUnits = lines.map(
    ({ quantity, unitPrice }) => toMinorUnits(unitPrice) * BigInt(quantity),
  );
  const subtotalMinorUnits = lineSubtotalMinorUnits.reduce(
    (sum, lineSubtotal) => sum + lineSubtotal,
    0n,
  );
  const subtotal = fromMinorUnits(subtotalMinorUnits);

  return {
    lineSubtotals: lineSubtotalMinorUnits.map(fromMinorUnits),
    subtotal,
    total: subtotal,
  };
}
