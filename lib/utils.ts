export function formatCurrency(
  amount: number,
  currencyCode: string = "GBP",
  symbol: string = "£"
): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${symbol}${amount.toFixed(2)}`;
  }
}

export function feetToMeters(feet: number): number {
  return Math.round(feet * 0.3048 * 100) / 100;
}

export function metersToFeet(meters: number): number {
  return Math.round(meters * 3.28084 * 100) / 100;
}

export function calculateQuoteTotal(params: {
  tierPricePerFoot: number;
  lengthFeet: number;
  addonTotal: number;
  packagePrice: number;
  deliveryFee: number;
  rushFee: number;
  discountAmount: number;
  discountPercent: number;
  platformFeePercent: number;
  passFeeToCust: boolean;
}): {
  subtotal: number;
  discountValue: number;
  platformFee: number;
  total: number;
} {
  const {
    tierPricePerFoot,
    lengthFeet,
    addonTotal,
    packagePrice,
    deliveryFee,
    rushFee,
    discountAmount,
    discountPercent,
    platformFeePercent,
    passFeeToCust,
  } = params;

  const garlandCost = tierPricePerFoot * lengthFeet;
  const subtotalBeforeDiscount =
    garlandCost + packagePrice + addonTotal + deliveryFee + rushFee;

  const discountValue =
    discountAmount +
    (subtotalBeforeDiscount * discountPercent) / 100;

  const subtotal = Math.max(0, subtotalBeforeDiscount - discountValue);
  const platformFee = passFeeToCust
    ? (subtotal * platformFeePercent) / 100
    : 0;
  const total = subtotal + platformFee;

  return {
    subtotal,
    discountValue,
    platformFee,
    total,
  };
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-100 text-blue-700",
    viewed: "bg-purple-100 text-purple-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    expired: "bg-orange-100 text-orange-700",
    paid: "bg-emerald-100 text-emerald-700",
    scheduled: "bg-blue-100 text-blue-700",
    in_progress: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return colors[status] || "bg-gray-100 text-gray-600";
}
