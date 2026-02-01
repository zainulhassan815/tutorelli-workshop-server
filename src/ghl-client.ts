import HighLevel from '@gohighlevel/api-client';
import { config } from './config';

export const ghl = new HighLevel({
  privateIntegrationToken: config.ghl.accessToken,
});
