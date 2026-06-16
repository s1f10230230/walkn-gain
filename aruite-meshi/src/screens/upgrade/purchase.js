import { PRICING } from './config';

export const getPriceWithPeriod = (planKey) => {
  const pricing = PRICING[planKey];
  return `${pricing.price}${pricing.renewalSuffix}`;
};

export const getBillingDisclosure = (planKey, trialEligible) => {
  const priceWithPeriod = getPriceWithPeriod(planKey);

  if (trialEligible) {
    return `3日間無料。終了後は${priceWithPeriod}で自動更新されます（いつでもキャンセル可）。`;
  }

  return `${priceWithPeriod}で自動更新されます（いつでもキャンセル可）。`;
};

export const pickPackage = (packages, planKey) => {
  const pricing = PRICING[planKey];
  const byId = packages.find(
    (pkg) => pkg?.product?.identifier === pricing.productId || pkg?.identifier === pricing.productId
  );

  if (byId) return byId;

  const byType = packages.find((pkg) => pkg?.packageType === pricing.packageType);
  return byType || packages[0];
};
