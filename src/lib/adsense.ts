const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ?? "";
const bannerSlotId =
  process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT?.trim() ?? "";

export const adsenseClientId = /^ca-pub-\d+$/.test(clientId)
  ? clientId
  : null;

export const adsenseBannerSlotId = /^\d+$/.test(bannerSlotId)
  ? bannerSlotId
  : null;

export const isAdsenseBannerEnabled =
  adsenseClientId !== null && adsenseBannerSlotId !== null;
