import pkg from '../../package.json' with { type: 'json' };

/** Inspector release version, single-sourced from package.json. */
export const INSPECTOR_VERSION: string = pkg.version;
