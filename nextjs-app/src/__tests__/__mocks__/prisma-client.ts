/**
 * Mock for @prisma/client used in unit tests.
 * Exports only the enum values needed by validation schemas and state machines.
 */

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export const Role = {
  CUSTOMER: 'CUSTOMER',
  RESTAURANT: 'RESTAURANT',
  AGENT: 'AGENT',
} as const

export type Role = (typeof Role)[keyof typeof Role]

// Stub PrismaClient — not used in pure-logic unit tests
export class PrismaClient {
  $transaction = jest.fn()
  user = { findUnique: jest.fn(), create: jest.fn() }
  restaurant = { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() }
  menuItem = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
  order = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  }
  orderItem = { create: jest.fn() }
}
