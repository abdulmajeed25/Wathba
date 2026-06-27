/* eslint-disable @typescript-eslint/no-require-imports */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all monorepo files so changes in packages/* hot-reload.
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from this app first, then from the monorepo root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Ensure pnpm-hoisted packages resolve correctly.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
