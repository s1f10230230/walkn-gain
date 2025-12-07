// Pro tour slide data with static screenshots for bundling.
// Keeping require paths here avoids duplicating the asset list across screens.
const PRO_TOUR_IMAGES = {
  aiToday: require('../../docs/screenshots/ai-insights/today.jpg'),
  environment: require('../../docs/screenshots/pro-tour/environment.jpg'),
  ranking: require('../../docs/screenshots/pro-tour/ranking.jpg'),
  weekdayAverage: require('../../docs/screenshots/pro-tour/weekday-average.jpg'),
  photos: require('../../docs/screenshots/pro-tour/photos-unlimited.jpg'),
};

export function buildProTourSlides(t) {
  return [
    {
      // ② 思い出（写真＆歩数）
      title: t('settings.premium.proTour.slide4Title'),
      desc: t('settings.premium.proTour.slide4Desc'),
      image: PRO_TOUR_IMAGES.photos,
    },
    {
      // ③ グラフ＆ランキング
      title: t('settings.premium.proTour.slide3Title'),
      desc: t('settings.premium.proTour.slide3Desc'),
      image: PRO_TOUR_IMAGES.ranking,
    },
    {
      // ④ AIインサイト（まとめスライド：2枚以内）A
      title: t('settings.premium.proTour.slide1Title'),
      desc: t('settings.premium.proTour.slide1Desc'),
      image: PRO_TOUR_IMAGES.aiToday,
    },
    {
      // ④ AIインサイト（まとめスライド：2枚以内）B
      title: t('settings.premium.proTour.slide2Title'),
      desc: t('settings.premium.proTour.slide2Desc'),
      image: PRO_TOUR_IMAGES.environment,
    },
    {
      // ⑤ トライアル開始へ誘導
      title: t('settings.premium.proTour.slide5Title'),
      desc: t('settings.premium.proTour.slide5Desc'),
    },
  ];
}

export { PRO_TOUR_IMAGES };
