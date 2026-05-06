/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true } }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock Prisma client to avoid needing a real DB in unit tests
    '^@prisma/client$': '<rootDir>/src/__tests__/__mocks__/prisma-client.ts',
  },
}

module.exports = config
