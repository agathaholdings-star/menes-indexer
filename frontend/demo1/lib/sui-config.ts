import "server-only";

// SUI Payment (PV-Pay) configuration
export const SUI_FORM_URL = "https://pv-pay.com/service/credit/input.html";
export const SUI_CANCEL_URL = "https://pv-pay.com/service/continue/cancel.html";

// Site credentials from env
export const SUI_SITES = {
  onetime: {
    siteId: process.env.SUI_SITE_ID_ONETIME || "76412201",
    sitePass: process.env.SUI_SITE_PASS_ONETIME || "placeholder",
  },
  subscriptionVisa: {
    siteId: process.env.SUI_SITE_ID_SUB_VISA || "76412202",
    sitePass: process.env.SUI_SITE_PASS_SUB_VISA || "placeholder",
  },
  subscriptionJcb: {
    siteId: process.env.SUI_SITE_ID_SUB_JCB || "76412203",
    sitePass: process.env.SUI_SITE_PASS_SUB_JCB || "placeholder",
  },
} as const;

// Plan pricing (JPY)
export const SUI_PLANS = {
  single_unlock: { amount: 1000 },
  standard: { amount: 4980, amount2: 4980 },
  vip: { amount: 9800, amount2: 9800 },
} as const;
