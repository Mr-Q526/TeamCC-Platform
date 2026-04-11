---
schemaVersion: '2026-04-11'
skillId: frontend/ecommerce-storefront-design
name: ecommerce-storefront-design
displayName: Ecommerce Storefront Design
description: 'Use when the task is to design an ecommerce storefront, 电商首页, product listing page, product detail page, shopping flow, or brand shop. Focus on product discovery, merchandising hierarchy, trust, pricing clarity, and conversion flow.'
version: '0.1.0'
sourceHash: 'sha256:0f4250b23cdc4cc29fde8ec767f7b7d87c2fb9eb8c147f64b1be404da093895d'
domain: frontend
departmentTags: [frontend-platform]
sceneTags: [design]
---

# Ecommerce Storefront Design

Use this skill for consumer storefronts, DTC brand sites, category pages, product detail pages, and shopping flows.

Goal: make products easy to discover, compare, trust, and buy. Prioritize imagery, price clarity, shipping confidence, and friction-free selection.

## Surface priorities

- Product image first
- Product name second
- Price and promotion third
- Variant or availability fourth
- Trust and shipping signals close to the CTA

## Page patterns

### Storefront homepage

1. Hero with one campaign or collection focus
2. Featured categories or collections
3. Merchandising blocks with real product imagery
4. Social proof, shipping promise, or returns confidence
5. Secondary category exploration

### Product listing page

1. Clear category title and item count
2. Sticky filters and sorting
3. Product grid tuned for image quality and scan speed
4. Quick compare or quick add only if it reduces friction

### Product detail page

1. Large image gallery
2. Price, promo, rating, and stock context
3. Variant selector and quantity controls
4. Primary CTA with shipping or delivery expectation nearby
5. Specs, care, FAQ, and returns below the fold

## Core rules

- Use real product photography with consistent crop logic.
- Keep price, discount, and original price unmistakable.
- Do not hide shipping, return, or stock signals until checkout.
- Filter language must match how shoppers think, not internal taxonomy.
- Keep promotional badges limited and meaningful.
- Sticky add-to-cart is useful on long product pages.

## Conversion rules

- The page should have one dominant buying action.
- Variant selection errors must be specific and local.
- Cart and checkout entry points should stay visible without being noisy.
- Support comparison when product choice is complex; do not overwhelm simple products with enterprise controls.

## Reject these failures

- Product cards overloaded with too many badges
- Hidden prices behind hover
- Generic lifestyle imagery with weak product visibility
- Popups that interrupt the first interaction
- Checkout-style urgency language on every surface

## Final checks

- Can a shopper understand what is being sold in one glance?
- Are price, stock, shipping, and CTA visible at the moment of decision?
- Does the layout help comparison without making the page feel crowded?
