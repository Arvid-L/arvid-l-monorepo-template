module.exports = {
  displayName: 'frontend',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/apps/frontend',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // @jsverse/* ships an ESM-only "index.esm.js" (not ".mjs"), so the
  // default "*.mjs$" carve-out misses it and Jest chokes on `export`.
  // pnpm puts the real files under node_modules/.pnpm/@jsverse+<pkg>@<v>/,
  // hence the second spelling.
  transformIgnorePatterns: [
    'node_modules/(?!.*\\.mjs$|@jsverse|\\.pnpm/@jsverse\\+)',
  ],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
