import { config } from './config';

const HighLevelModule = require('@gohighlevel/api-client');
const HighLevel = HighLevelModule.default ?? HighLevelModule;

export const ghl = new HighLevel({
  privateIntegrationToken: config.ghl.accessToken,
});
