import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^.+\\.(css|scss|sass)$': 'identity-obj-proxy',
    '^react-markdown$': '<rootDir>/tests/__mocks__/react-markdown.tsx',
    '^remark-gfm$': '<rootDir>/tests/__mocks__/remark-gfm.ts',
    '^rehype-katex$': '<rootDir>/tests/__mocks__/rehype-katex.ts',
    '^remark-math$': '<rootDir>/tests/__mocks__/remark-math.ts',
    '^react-syntax-highlighter$': '<rootDir>/tests/__mocks__/react-syntax-highlighter.tsx',
    '^react-syntax-highlighter/(.*)$': '<rootDir>/tests/__mocks__/react-syntax-highlighter.tsx',
  },
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(react-markdown|remark-|rehype-|vfile|unist|unified|mdast|micromark|hast|devlop|is-plain-obj|hast-util-|property-|space-|comma-|stringify-|character-|entities|to-|ccount|direction|longest-|markdown-|trim-|decode-|fault|gemoji|github-|zwitch|web-names|svg|trim|estree|acorn|escape|style)/)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};

export default config;
