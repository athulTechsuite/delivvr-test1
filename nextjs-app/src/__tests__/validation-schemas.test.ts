/**
 * Unit tests for Zod validation schemas used across API routes.
 * Covers TC-F-001 (register validation), TC-E-003 (invalid price),
 * TC-E-006 (duplicate email handled at DB level — schema tested here),
 * and AC password complexity rules.
 */

import { z } from 'zod'
import { Role } from '@prisma/client'

// ---- Replicate validation schemas from route handlers ----

const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name may only contain letters and spaces'),
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  role: z.nativeEnum(Role, {
    errorMap: () => ({
      message: 'Role must be CUSTOMER, RESTAURANT, or AGENT',
    }),
  }),
})

const MAX_PRICE = 9999.99
const createMenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  price: z
    .number()
    .positive('Price must be a positive number')
    .max(MAX_PRICE),
  available: z.boolean().default(true),
})

const orderItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
})

const placeOrderSchema = z.object({
  restaurantId: z.string().min(1),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  deliveryAddress: z.string().min(5).max(500),
})

// ---- Tests ----

describe('Register schema validation (TC-F-001)', () => {
  const validPayload = {
    name: 'Jane Doe',
    email: 'jane@test.com',
    password: 'Test1234!',
    role: 'CUSTOMER',
  }

  it('accepts a valid registration payload', () => {
    const result = registerSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('rejects a name with only 1 character', () => {
    const result = registerSchema.safeParse({ ...validPayload, name: 'J' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/at least 2/)
    }
  })

  it('rejects a name with numbers', () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      name: 'Jane123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Invalid email')
    }
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...validPayload, password: 'Ab1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/at least 8/)
    }
  })

  it('rejects a password without uppercase (PRD AC)', () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      password: 'allowercase1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/uppercase/)
    }
  })

  it('rejects a password without lowercase', () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      password: 'ALLUPPERCASE1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/lowercase/)
    }
  })

  it('rejects a password without a digit', () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      password: 'NoDigitsHere!',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/digit/)
    }
  })

  it('rejects an invalid role', () => {
    const result = registerSchema.safeParse({ ...validPayload, role: 'ADMIN' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('CUSTOMER, RESTAURANT, or AGENT')
    }
  })

  it('accepts RESTAURANT role', () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      role: 'RESTAURANT',
    })
    expect(result.success).toBe(true)
  })

  it('accepts AGENT role', () => {
    const result = registerSchema.safeParse({ ...validPayload, role: 'AGENT' })
    expect(result.success).toBe(true)
  })
})

describe('Menu item schema validation (TC-E-003)', () => {
  const validItem = { name: 'Margherita', price: 12.99, available: true }

  it('accepts a valid menu item', () => {
    const result = createMenuItemSchema.safeParse(validItem)
    expect(result.success).toBe(true)
  })

  it('rejects negative price (TC-E-003)', () => {
    const result = createMenuItemSchema.safeParse({ ...validItem, price: -5 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/positive/)
    }
  })

  it('rejects zero price', () => {
    const result = createMenuItemSchema.safeParse({ ...validItem, price: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects price above maximum', () => {
    const result = createMenuItemSchema.safeParse({
      ...validItem,
      price: 10000,
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = createMenuItemSchema.safeParse({ ...validItem, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/Name is required/)
    }
  })

  it('defaults available to true when omitted', () => {
    const result = createMenuItemSchema.safeParse({
      name: 'Pizza',
      price: 10,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.available).toBe(true)
    }
  })
})

describe('Place order schema validation', () => {
  const validOrder = {
    restaurantId: 'rest-123',
    items: [{ menuItemId: 'item-1', quantity: 2 }],
    deliveryAddress: '123 Main Street, City',
  }

  it('accepts a valid order payload', () => {
    const result = placeOrderSchema.safeParse(validOrder)
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = placeOrderSchema.safeParse({ ...validOrder, items: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/At least one item/)
    }
  })

  it('rejects quantity of 0', () => {
    const result = placeOrderSchema.safeParse({
      ...validOrder,
      items: [{ menuItemId: 'item-1', quantity: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer quantity', () => {
    const result = placeOrderSchema.safeParse({
      ...validOrder,
      items: [{ menuItemId: 'item-1', quantity: 1.5 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects delivery address shorter than 5 characters', () => {
    const result = placeOrderSchema.safeParse({
      ...validOrder,
      deliveryAddress: '123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing restaurantId', () => {
    const result = placeOrderSchema.safeParse({
      ...validOrder,
      restaurantId: '',
    })
    expect(result.success).toBe(false)
  })
})
