import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  plugins: [...(config.plugins || []), './plugins/with-paywall-module'],
  extra: {
    ...config.extra,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    REVENUECAT_API_KEY:
      process.env.REVENUECAT_API_KEY ||
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
      '',
  },
});
