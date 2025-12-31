/**
 * SDK version imported directly from package.json
 * This ensures version is always in sync with the published package.
 */
import packageJson from '../package.json' with { type: 'json' };

export const SDK_VERSION: string = packageJson.version;
export const SDK_NAME = 'brokle';
