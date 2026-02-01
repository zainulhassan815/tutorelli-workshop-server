# Workshop Booking API - Implementation Plan

> Last updated: 2026-02-01

## Overview

Refactor the workshop booking system to have a robust backend with proper validations, and a minimal frontend that simply collects data and redirects to payment.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GHL Form       │────▶│  Bun API Proxy  │────▶│  GHL API        │
│  (Minimal JS)   │◀────│  (All Logic)    │◀────│  (LeadConnector)│
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  GHL Checkout   │  ← Single dynamic page (replaces 2 separate pages)
│  (Product ID)   │
└─────────────────┘
```

---

## Task Tracker

### Phase 1: Preparation (Manual)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Add `productId` field to offering schema in GHL | ⬜ Todo | Required for payment linking |
| 1.2 | Populate `productId` for existing offerings | ⬜ Todo | Map each offering to its GHL product |
| 1.3 | Verify GHL checkout product selection via URL param | ⬜ Todo | Test if `?product=ID` works |
| 1.4 | Create single checkout page in GHL funnel | ⬜ Todo | Replace the 2 year-group pages |

### Phase 2: Backend Refactor

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Update `src/types.ts` - Add new types and fields | ✅ Done | BookingInput, productId in offering |
| 2.2 | Update `src/validation.ts` - New booking schema | ✅ Done | Full form validation |
| 2.3 | Add `fetchOfferingById` to `src/ghl.ts` | ✅ Done | Fetch single offering |
| 2.4 | Add `findBookingByStudentAndOffering` to `src/ghl.ts` | ✅ Done | Duplicate check |
| 2.5 | Update `fetchOfferings` - Filter past dates | ✅ Done | Server-side date filtering |
| 2.6 | Update `getOrCreateContact` - Handle custom fields by type | ✅ Done | Backend sets contactType, parentId, yearGroup |
| 2.7 | Rewrite `handleCreateBooking` - Complete flow | ✅ Done | All validation + contact creation |
| 2.8 | Remove `POST /api/contacts` endpoint | ✅ Done | No longer needed |
| 2.9 | Update `src/handlers.ts` - Build checkout URL | ✅ Done | Return redirect URL with params |
| 2.10 | Add config for checkout base URL | ✅ Done | Environment variable |

### Phase 3: Frontend Simplification

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Remove contact creation calls from form | ✅ Done | Backend handles it |
| 3.2 | Update booking submission - Send full form data | ✅ Done | Single POST to /api/bookings |
| 3.3 | Handle redirect from API response | ✅ Done | Use returned checkoutUrl |
| 3.4 | Remove hardcoded checkout URLs | ✅ Done | Server provides URL |
| 3.5 | Clean up unused code | ✅ Done | Reduced from 1000 to 400 lines |

### Phase 4: Testing & Deployment

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Test offering filtering (past dates hidden) | ⬜ Todo | |
| 4.2 | Test duplicate booking prevention | ⬜ Todo | |
| 4.3 | Test contact creation with custom fields | ⬜ Todo | |
| 4.4 | Test full booking flow end-to-end | ⬜ Todo | |
| 4.5 | Test checkout redirect with product selection | ⬜ Todo | |
| 4.6 | Deploy to production | ⬜ Todo | |

---

## API Specification

### Endpoints (After Refactor)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/offerings?yearGroup=gcse` | Get available workshops (filtered) |
| POST | `/api/bookings` | Create complete booking |

### `GET /api/offerings`

**Query Parameters:**
- `yearGroup` (required): `gcse` or `alevel`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "69760426bd32611bd93aec41",
      "offering": "GCSE English – 26 Jan 2026 – 14:00–17:00",
      "intake": "feb_half_term_2026",
      "yearGroup": "gcse",
      "subject": "English",
      "workshopDate": "2026-01-26",
      "sessionTime": "14:00–17:00",
      "availability": "available",
      "price": 125,
      "priceLabel": "Premium Examiner Session",
      "zoomLink": "",
      "productId": "ghl_product_abc123"
    }
  ]
}
```

**Server-side Filtering:**
- Excludes `availability === 'inactive'`
- Excludes `availability === 'full'`
- Excludes `workshopDate < today`

### `POST /api/bookings`

**Request Body:**
```json
{
  "offeringId": "69760426bd32611bd93aec41",
  "parent": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "07123456789"
  },
  "student": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phone": "07987654321"
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "bookingId": "BK-M5X7K2-ABC123",
    "parentContactId": "contact_123",
    "studentContactId": "contact_456",
    "checkoutUrl": "https://book.tutorelli.co.uk/checkout?product_id=xxx&email=john@example.com&name=John%20Doe&phone=07123456789&booking_id=BK-M5X7K2-ABC123"
  }
}
```

**Error Responses:**

| Code | Message | When |
|------|---------|------|
| `VALIDATION_ERROR` | Field-specific message | Invalid input |
| `OFFERING_NOT_FOUND` | Offering not found | Invalid offeringId |
| `OFFERING_UNAVAILABLE` | Workshop is no longer available | Full or inactive |
| `OFFERING_PAST` | Workshop date has passed | Past date |
| `OFFERING_NO_PRODUCT` | Offering not configured for payment | Missing productId |
| `DUPLICATE_BOOKING` | Student already booked for this workshop | Existing booking found |
| `CREATE_ERROR` | Failed to create booking | GHL API error |

---

## Backend Flow Detail

### `POST /api/bookings` - Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. VALIDATE INPUT                                               │
│    └─ Zod schema validation                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. VALIDATE OFFERING                                            │
│    ├─ Fetch offering by ID                                      │
│    ├─ Check: exists                                             │
│    ├─ Check: availability !== 'inactive'                        │
│    ├─ Check: availability !== 'full'                            │
│    ├─ Check: workshopDate >= today                              │
│    └─ Check: productId exists                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. GET OR CREATE PARENT CONTACT                                 │
│    ├─ Find by email                                             │
│    ├─ If exists: merge workshop tag only (keep existing data)   │
│    └─ If not exists: create with:                               │
│        ├─ tags: ['parent', workshop-tag]                        │
│        └─ customFields.contactType = 'parent'                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. GET OR CREATE STUDENT CONTACT                                │
│    ├─ Find by email                                             │
│    ├─ If exists: merge workshop tag only (keep existing data)   │
│    └─ If not exists: create with:                               │
│        ├─ tags: ['student', workshop-tag]                       │
│        ├─ customFields.contactType = 'student'                  │
│        ├─ customFields.parentContactId = parent.id              │
│        └─ customFields.yearGroup = offering.yearGroup           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CHECK DUPLICATE BOOKING                                      │
│    ├─ Search bookings: studentContactId = X AND offeringId = Y  │
│    └─ If found: return DUPLICATE_BOOKING error                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. CREATE BOOKING RECORD                                        │
│    ├─ Generate booking ID                                       │
│    ├─ Set paymentStatus = 'pending'                             │
│    └─ Set price from offering (not from input)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. BUILD CHECKOUT URL                                           │
│    └─ Base URL + query params:                                  │
│        ├─ product_id (from offering)                            │
│        ├─ email (parent)                                        │
│        ├─ name (parent)                                         │
│        ├─ phone (parent)                                        │
│        ├─ booking_id                                            │
│        └─ offering details (for display)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. RETURN RESPONSE                                              │
│    └─ { bookingId, parentContactId, studentContactId,          │
│         checkoutUrl }                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Schemas

### Offering (GHL Custom Object)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | GHL record ID |
| `offering` | string | Display name |
| `intake` | string | Cohort/batch identifier |
| `yearGroup` | string | `gcse` or `alevel` |
| `subject` | string | Subject name |
| `workshopDate` | string | `YYYY-MM-DD` format |
| `sessionTime` | string | Time range |
| `availability` | string | `available`, `full`, or `inactive` |
| `price` | number | Price in GBP |
| `priceLabel` | string | Price tier description |
| `zoomLink` | string | Online session link |
| `productId` | string | **NEW** - GHL product ID for checkout |

### Booking (GHL Custom Object)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Generated booking ID (BK-xxx) |
| `parent_contact_id` | string | Parent contact ID |
| `student_contact_id` | string | Student contact ID |
| `workshop_offering_id` | string | Offering record ID |
| `payment_status` | string | `pending`, `paid`, `failed` |
| `price` | number | Price at time of booking |

### Contact Custom Fields

| Field ID | Name | Values |
|----------|------|--------|
| `Y78OZFHJ5tVCNyVble9a` | contactType | `parent` or `student` |
| `EAfs2UwBSmgNDU89Yhlj` | parentContactId | Contact ID (students only) |
| `6VQA8CZUWQOGjq3yspkl` | yearGroup | `gcse` or `alevel` (students only) |

---

## Environment Variables

```env
# Existing
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_ACCESS_TOKEN=pit-xxx
GHL_LOCATION_ID=xxx
WORKSHOP_OFFERINGS_SCHEMA=xxx
BOOKINGS_SCHEMA=xxx
PORT=3000

# New
CHECKOUT_BASE_URL=https://book.tutorelli.co.uk/checkout
```

---

## Frontend Simplification

### Before (Current)
```
form.html
├─ fetchOfferings()           → GET /api/offerings
├─ createContact() x2         → POST /api/contacts (parent)
│                             → POST /api/contacts (student)
├─ createBooking()            → POST /api/bookings
├─ Build checkout URL         (hardcoded base URLs)
└─ Redirect to checkout
```

### After (Simplified)
```
form.html
├─ fetchOfferings()           → GET /api/offerings
├─ submitBooking()            → POST /api/bookings (all data)
└─ Redirect to checkoutUrl    (from API response)
```

**Lines of code reduction:** ~600 → ~300 (50% reduction)

---

## GHL Checkout Page Setup

### Option A: URL Parameter Product Selection (Preferred)

If GHL supports `?product=PRODUCT_ID` to auto-select product:

1. Create single checkout page at `/checkout`
2. Add order form element
3. Configure to read product from URL
4. Pre-fill fields from query params

### Option B: Custom JavaScript (Fallback)

If GHL doesn't support native product selection:

1. Create single checkout page at `/checkout`
2. Add order form with all products
3. Add custom code block with JS:

```javascript
// Read query params
const params = new URLSearchParams(window.location.search);
const productId = params.get('product_id');

// Hide all products except selected one
// Or programmatically select the correct product
```

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-01 | Use `productId` in offering | Most maintainable, explicit linking |
| 2026-02-01 | Keep existing contact data | Avoid overwriting verified information |
| 2026-02-01 | Create booking before payment | Enables abandoned cart follow-up |
| 2026-02-01 | Backend handles custom fields | Frontend stays minimal/dumb |
| 2026-02-01 | Single checkout page | Replaces 2 year-group specific pages |

---

## Open Questions

- [ ] How does GHL checkout handle product selection via URL?
- [ ] What is the exact GHL product ID format?
- [ ] Should we store `offering` details in booking for historical reference?
- [ ] Webhook for payment confirmation to update booking status?

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/types.ts` | Modify | Add productId, new booking input type |
| `src/validation.ts` | Modify | New comprehensive booking schema |
| `src/ghl.ts` | Modify | Add fetchOfferingById, findBooking, update filtering |
| `src/handlers.ts` | Modify | Rewrite booking handler, remove contacts endpoint |
| `src/index.ts` | Modify | Remove POST /api/contacts route |
| `src/config.ts` | Modify | Add CHECKOUT_BASE_URL |
| `.env.example` | Modify | Add CHECKOUT_BASE_URL |
| `.env` | Modify | Add CHECKOUT_BASE_URL |
| `form.html` | Modify | Simplify to minimal logic |
