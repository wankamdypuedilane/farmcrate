# FarmCrate: product requirements (MVP)

FarmCrate lets small farm co-operatives sell weekly vegetable boxes by
subscription. Customers choose a box and a pickup point, pay every week by card,
and skip the weeks they are away. The co-op knows on Wednesday evening exactly
how many boxes to pack for Friday, per pickup point.

Pilot customer: the Monts d'Arrée Farm Co-op (fictional), five farms in
Brittany, about 120 households, three pickup points, delivery on Fridays.

## 1. Problem

Today the co-op runs its box scheme with a spreadsheet, bank transfers and text
messages.

- Counting boxes takes Léna (coordinator) two hours every Thursday, and the count
  is still wrong about once a month: a family on holiday forgot to say so, or
  said so by text to a farmer who forgot to pass it on.
- Unpaid boxes: transfers arrive late or not at all; chasing them is awkward
  between neighbours.
- Customers cannot see what they have paid, or change their pickup point,
  without calling someone.

## 2. Audience

| Who | Needs | Constraints |
|---|---|---|
| Customers (households) | subscribe in two minutes, skip a week from their phone, trust the payment | not technical; many on mobile; French and English speakers |
| Co-op staff (2-5 people) | one reliable number per pickup point and box, early enough to harvest | busy outdoors; the list is printed and taken to the packing shed |
| FarmCrate operators | set up a new co-op, keep the service running | a two-person company: no manual work per customer |

## 3. Goals and measures of success

1. The packing count shown at the cut-off is the number of boxes actually
   collected (target: no correction in the first eight weeks).
2. No payment to chase: weekly card payments; a failed payment is visible to the
   customer and the co-op.
3. Weekly admin for skips: zero (today two hours).
4. A customer subscribes in under three minutes, on a phone (usability test with
   five customers of the pilot co-op).

## 4. Scope

### In the MVP
- Public catalogue of a co-op: box plans, prices, pickup points, contents of the
  next deliveries.
- Sign-up and sign-in by e-mail (chapter 9 of the book).
- Weekly subscription paid by card through Stripe Checkout; payment details and
  cancellation through the Stripe customer portal.
- "My boxes": upcoming deliveries, skip a delivery until its cut-off, see past skips.
- Skipped boxes are credited: the price is deducted from the next payment.
- Packing list for the co-op's staff, per pickup point and box, for the next delivery.
- Several co-ops on one installation (each co-op sees only its own data).

### Not in the MVP (and why)
- **Home delivery**: the pilot co-op has no van; pickup points cover 95 % of its customers.
- **À-la-carte extras** (eggs, cheese): needs stock management; planned for v1.2.
- **Pausing for several weeks in one go**: skipping week by week covers it; v1.1.
- **Real-time updates** of the packing list: changes close at the cut-off, the
  list is final then, and staff print it once. Nothing to push live.
- **File uploads** (photos of the boxes): the contents list is text; photos are
  nice to have, v1.2 (private bucket pattern of chapter 14).
- **Self-service co-op onboarding**: operators set up the first co-ops by hand;
  automated once there are more than ten.
- **Staff screens to edit plans and contents**: the database already allows it
  (RLS policies for staff); in the pilot, operators enter them. v1.1.

## 5. Functional requirements

- **FR1** Visitors can read a public co-op's active plans, active pickup points
  and announced box contents, without an account.
- **FR2** A signed-in customer subscribes to one plan with one pickup point per
  co-op. The price charged is the plan's price in the database.
- **FR3** The subscription is active only once Stripe confirms the first payment.
- **FR4** Deliveries happen on the co-op's delivery weekday, in the co-op's time zone.
- **FR5** A customer can skip a delivery of an active subscription until the
  cut-off: `cutoff_time`, `cutoff_days` before the delivery day, local time
  (Monts d'Arrée: Wednesday 18:00 for Friday). At most eight weeks ahead.
- **FR6** A skip is final. Its credit equals the plan's weekly price and is
  deducted from the customer's next payment.
- **FR7** The packing list counts, per pickup point and plan, the active
  subscriptions minus the skips of that delivery. Only the co-op's staff can read it.
- **FR8** A failed payment marks the subscription "Payment failed"; its boxes are
  not packed until it is paid again.
- **FR9** Customers change their card or cancel in the Stripe customer portal.
- **FR10** Each co-op's private data (subscriptions, skips, staff) is visible
  only to its customers (their own rows) and its staff.

## 6. Non-functional requirements

- **Security**: authorization in the database (RLS) for every table; payment
  state changed only by server code; Stripe in test mode until launch; OWASP Top
  10 review before launch (chapter 19).
- **Correct time**: all instants stored as `timestamptz`; cut-offs computed in
  the co-op's time zone, daylight saving time included, identically in SQL and
  TypeScript.
- **Accessibility**: WCAG 2.2 AA, checked with axe in light and dark mode.
- **Performance**: catalogue pages served from cache (public data); "My boxes"
  under one second on a 4G phone.
- **Privacy (GDPR)**: name, e-mail and pickup point only; card data stays at Stripe.
- **Cost**: free tiers during the pilot, then Supabase Pro and Vercel Pro.

## 7. User stories and acceptance criteria

**US1, discover.** As a visitor, I want to see the boxes, their prices and what
is in them this week, so that I can decide to subscribe.
- Given the public co-op `monts-darree`, when I open `/monts-darree`, then I see
  each active plan with its weekly price, each active pickup point, and the
  contents of the next announced deliveries.
- Given a co-op that is not public, when I open its page, then I get "not found".

**US2, subscribe.** As a customer, I want to subscribe with my card, so that my
box is paid every week without thinking about it.
- Given I am signed in, when I choose a plan and a pickup point and pay in
  Stripe Checkout, then "My boxes" shows the subscription as Active.
- Given I abandon the payment, when I come back and choose again, then I am not
  subscribed twice and no subscription is active.
- Given I already have an active subscription with this co-op, when I try to
  subscribe again, then I am told so and sent to "My boxes".

**US3, skip.** As a customer, I want to skip a week I am away, so that I do not
pay for a box nobody collects.
- Given an active subscription and a delivery whose cut-off has not passed, when
  I press "Skip this week", then the delivery shows "Skipped", and the box
  price is credited for my next payment.
- Given the cut-off has passed, then the button is gone, and a request sent
  anyway is refused by the server.
- Given a delivery I skipped, then I cannot undo the skip (the packing list and
  the credit rely on it).

**US4, pay and cancel.** As a customer, I want to change my card or cancel
myself, so that I never need to ask anyone.
- When I press "Payment details and cancellation", then I reach the Stripe
  customer portal for my account, and come back to "My boxes" afterwards.

**US5, pack.** As co-op staff, I want the number of boxes per pickup point and
box, so that we harvest and pack the right quantities.
- Given I am staff of the co-op, when I open `/monts-darree/packing`, then I see
  the next delivery's counts, marked "Provisional" before the cut-off and
  "Final" after it.
- Given I am not on this co-op's team, then I see no figures.
- Given a subscription whose payment failed, then its box is not counted.

## 8. Open questions (answered in docs/DECISIONS.md)

- Credit the customer's balance, or pause the Stripe subscription for a week?
- What happens when Stripe's events arrive out of order?
- What if Stripe is unreachable when a customer skips?
