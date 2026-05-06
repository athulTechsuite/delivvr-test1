/**
 * Unit tests for order status transition business logic.
 * These tests cover TC-F-004, TC-F-005, TC-F-006, TC-E-001, TC-E-005
 * and validate the state machine rules without a running database.
 */

import { OrderStatus } from '@prisma/client'

// ---- Duplicate the transition maps from route handlers (pure logic) ----

const FINALIZED_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
]

const RESTAURANT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP],
}

const AGENT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.READY_FOR_PICKUP]: OrderStatus.OUT_FOR_DELIVERY,
  [OrderStatus.OUT_FOR_DELIVERY]: OrderStatus.DELIVERED,
}

// Only PENDING → CANCELLED for customer
const CUSTOMER_ALLOWED_FROM = OrderStatus.PENDING

function isFinalized(status: OrderStatus): boolean {
  return FINALIZED_STATUSES.includes(status)
}

function restaurantCanTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  if (isFinalized(from)) return false
  const allowed = RESTAURANT_TRANSITIONS[from] ?? []
  return allowed.includes(to)
}

function agentCanTransition(
  from: OrderStatus,
  to: OrderStatus,
  isAssigned: boolean
): boolean {
  if (!isAssigned) return false
  if (isFinalized(from)) return false
  return AGENT_TRANSITIONS[from] === to
}

function customerCanCancel(from: OrderStatus): boolean {
  return from === CUSTOMER_ALLOWED_FROM
}

// ---- Tests ----

describe('Order Status State Machine', () => {
  describe('Restaurant transitions', () => {
    // TC-F-004
    it('allows PENDING → CONFIRMED', () => {
      expect(
        restaurantCanTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)
      ).toBe(true)
    })

    it('allows CONFIRMED → PREPARING', () => {
      expect(
        restaurantCanTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING)
      ).toBe(true)
    })

    it('allows PREPARING → READY_FOR_PICKUP', () => {
      expect(
        restaurantCanTransition(
          OrderStatus.PREPARING,
          OrderStatus.READY_FOR_PICKUP
        )
      ).toBe(true)
    })

    it('allows PENDING → CANCELLED', () => {
      expect(
        restaurantCanTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)
      ).toBe(true)
    })

    it('allows CONFIRMED → CANCELLED', () => {
      expect(
        restaurantCanTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)
      ).toBe(true)
    })

    // TC-E-001 — Invalid transition: CONFIRMED → DELIVERED
    it('rejects CONFIRMED → DELIVERED (TC-E-001)', () => {
      expect(
        restaurantCanTransition(OrderStatus.CONFIRMED, OrderStatus.DELIVERED)
      ).toBe(false)
    })

    it('rejects any transition from DELIVERED (finalized)', () => {
      expect(
        restaurantCanTransition(OrderStatus.DELIVERED, OrderStatus.CONFIRMED)
      ).toBe(false)
    })

    it('rejects any transition from CANCELLED (finalized)', () => {
      expect(
        restaurantCanTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)
      ).toBe(false)
    })

    it('rejects READY_FOR_PICKUP → CONFIRMED (backwards)', () => {
      expect(
        restaurantCanTransition(
          OrderStatus.READY_FOR_PICKUP,
          OrderStatus.CONFIRMED
        )
      ).toBe(false)
    })
  })

  describe('Agent transitions', () => {
    // TC-F-005
    it('allows READY_FOR_PICKUP → OUT_FOR_DELIVERY when assigned', () => {
      expect(
        agentCanTransition(
          OrderStatus.READY_FOR_PICKUP,
          OrderStatus.OUT_FOR_DELIVERY,
          true
        )
      ).toBe(true)
    })

    it('allows OUT_FOR_DELIVERY → DELIVERED when assigned', () => {
      expect(
        agentCanTransition(
          OrderStatus.OUT_FOR_DELIVERY,
          OrderStatus.DELIVERED,
          true
        )
      ).toBe(true)
    })

    // TC-E-005 — Agent not assigned
    it('rejects transition when agent is not assigned (TC-E-005)', () => {
      expect(
        agentCanTransition(
          OrderStatus.READY_FOR_PICKUP,
          OrderStatus.OUT_FOR_DELIVERY,
          false
        )
      ).toBe(false)
    })

    it('rejects transition from finalized status even if assigned', () => {
      expect(
        agentCanTransition(OrderStatus.DELIVERED, OrderStatus.DELIVERED, true)
      ).toBe(false)
    })

    it('rejects invalid transitions (PENDING → OUT_FOR_DELIVERY)', () => {
      expect(
        agentCanTransition(
          OrderStatus.PENDING,
          OrderStatus.OUT_FOR_DELIVERY,
          true
        )
      ).toBe(false)
    })
  })

  describe('Customer cancellation', () => {
    // TC-F-006
    it('allows cancellation when status is PENDING', () => {
      expect(customerCanCancel(OrderStatus.PENDING)).toBe(true)
    })

    it('rejects cancellation when status is CONFIRMED', () => {
      expect(customerCanCancel(OrderStatus.CONFIRMED)).toBe(false)
    })

    it('rejects cancellation when status is DELIVERED', () => {
      expect(customerCanCancel(OrderStatus.DELIVERED)).toBe(false)
    })
  })

  describe('Finalized status guard', () => {
    it('identifies DELIVERED as finalized', () => {
      expect(isFinalized(OrderStatus.DELIVERED)).toBe(true)
    })

    it('identifies CANCELLED as finalized', () => {
      expect(isFinalized(OrderStatus.CANCELLED)).toBe(true)
    })

    it('does not treat PENDING as finalized', () => {
      expect(isFinalized(OrderStatus.PENDING)).toBe(false)
    })

    it('does not treat OUT_FOR_DELIVERY as finalized', () => {
      expect(isFinalized(OrderStatus.OUT_FOR_DELIVERY)).toBe(false)
    })
  })
})
