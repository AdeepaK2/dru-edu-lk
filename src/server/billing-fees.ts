import 'server-only';

import type {
  BillingFeeCode,
  BillingFeeContext,
  BillingFeeDefinition,
  BillingLineItem,
  BillingSettings,
} from '@/models/billingSchema';

const BILLING_FEE_DEFINITIONS: Record<BillingFeeCode, BillingFeeDefinition> = {
  admission_fee: {
    code: 'admission_fee',
    label: 'Admission Fee',
    scope: 'student',
    getAmount: (settings) => settings.admissionFeeAmount,
    getDescription: (context) =>
      `New student admission for ${context.studentName || 'student'}`,
  },
  parent_portal_yearly: {
    code: 'parent_portal_yearly',
    label: 'Parent Portal Fee',
    scope: 'parent',
    getAmount: (settings) => settings.parentPortalYearlyFeeAmount,
    getDescription: () => 'Yearly DRU EDU parent portal access',
  },
};

export function getBillingFeeDefinition(code: BillingFeeCode): BillingFeeDefinition {
  return BILLING_FEE_DEFINITIONS[code];
}

export function buildBillingLineItem(
  code: BillingFeeCode,
  settings: BillingSettings,
  context: BillingFeeContext,
  overrides?: Partial<Pick<BillingLineItem, 'quantity' | 'description'>>,
): BillingLineItem {
  const definition = getBillingFeeDefinition(code);
  const amount = Number(definition.getAmount(settings) || 0);

  if (amount <= 0) {
    throw new Error(`${definition.label} amount is not configured`);
  }

  return {
    type: definition.code,
    label: definition.label,
    description: overrides?.description || definition.getDescription(context),
    amount,
    quantity: overrides?.quantity || 1,
    studentEmail: context.studentEmail,
    studentName: context.studentName,
  };
}

export function hasBillingFee(lineItems: BillingLineItem[], code: BillingFeeCode) {
  return lineItems.some((item) => item.type === code);
}

export function getBillingInvoiceTotal(lineItems: BillingLineItem[]) {
  return lineItems.reduce((total, item) => total + item.amount * item.quantity, 0);
}

export const billingFeeDefinitions = BILLING_FEE_DEFINITIONS;
