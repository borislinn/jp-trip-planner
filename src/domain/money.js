// Sum in integer minor units to avoid float drift, then back to a number.
export function sumMoney(values) {
  const cents = values.reduce((acc, v) => acc + Math.round((Number(v) || 0) * 100), 0);
  return cents / 100;
}

export function parseCurrencyInput(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const clean = String(value || "").replace(/[¥￥,\s]/g, "");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Optional secondary "≈ $X" figure in the traveller's home currency.
// `homeRate` is JPY per 1 unit of home currency. Returns null when no
// usable rate/currency is configured (the feature is opt-in).
export function homeApprox(jpyAmount, homeCurrency, homeRate) {
  const rate = Number(homeRate) || 0;
  if (!homeCurrency || !(rate > 0)) return null;
  return "≈ " + formatCurrency((Number(jpyAmount) || 0) / rate, homeCurrency);
}

export function formatCurrency(amount, code = "JPY") {
  try {
    return new Intl.NumberFormat(code === "JPY" ? "ja-JP" : undefined,
      { style: "currency", currency: code })
      .format(Number(amount) || 0);
  } catch {
    return `${code} ${(Number(amount) || 0).toFixed(2)}`;
  }
}
