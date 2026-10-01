# MVP 02 Event Search and Purchase

<table id="bkmrk-product-release-stat"><thead><tr><th>Product</th><th>Release</th><th>Status</th><th>Version</th></tr></thead><tbody><tr><td>Ticket D-Saster</td><td>MVP</td><td>Draft</td><td>1.0</td></tr></tbody></table>

---

## 1. Feature description

This feature allows any visitor to find an event and obtain a ticket for it, without creating an account. It involves one actor:

- **Fan** (unauthenticated visitor) searches for an event by its name, selects it from the results, reviews its details, and completes a purchase by submitting a single form with their full name and email address. The ticket is displayed on screen immediately.

In the MVP, a purchase issues exactly one ticket and involves no seat selection, ticket categories, prices or payment. The events offered are those registered under.

## 2. Goal

Deliver the minimum end-to-end fan journey (search, select, complete) and prove that an event registered by a partner can be found and sold.

The feature is complete when a visitor who is not signed in can find an event registered under PRD-01 by typing part of its name, and leave with a ticket that carries a unique code.

## 3. Requirement breakdown

<table id="bkmrk-id-requirement-accep" style="width: 100%;"><thead><tr><th style="width: 8.57639%;">ID</th><th style="width: 32.5358%;">Requirement</th><th style="width: 58.8679%;">Acceptance criteria</th></tr></thead><tbody><tr><td style="width: 8.57639%;">SP-01</td><td style="width: 32.5358%;">A visitor can search for events by event name.</td><td style="width: 58.8679%;">1. The search returns every event whose name contains the entered text.  
2. Matching is case-insensitive.  
3. Only the event name is searched. Artist, venue and date are not considered.  
4. Searching does not require signing in.</td></tr><tr><td style="width: 8.57639%;">SP-02</td><td style="width: 32.5358%;">Search results present the key information of each matching event.</td><td style="width: 58.8679%;">1. Each result shows the event name, artist, date and venue name.  
2. When no event matches, the visitor is informed that no events were found. This is presented as a normal outcome, not as an error.</td></tr><tr><td style="width: 8.57639%;">SP-03</td><td style="width: 32.5358%;">Newly registered events become searchable.</td><td style="width: 58.8679%;">1. An event registered under PRD-01 (VE-04) appears in search results no later than one minute after its registration is confirmed.</td></tr><tr><td style="width: 8.57639%;">SP-04</td><td style="width: 32.5358%;">A visitor can select an event and view its details.</td><td style="width: 58.8679%;">1. Selecting a result opens the event's details: event name, artist, date, venue name and venue location.  
2. The details view offers the option to buy a ticket.</td></tr><tr><td style="width: 8.57639%;">SP-05</td><td style="width: 32.5358%;">A visitor can start a purchase by filling in a single form.</td><td style="width: 58.8679%;">1. Choosing to buy opens a form requesting the buyer's full name and email address.  
2. Both fields are mandatory. A submission missing either is rejected, indicating which field is missing.  
3. The email address must have a valid format.  
4. The purchase does not require signing in or creating an account.</td></tr><tr><td style="width: 8.57639%;">SP-06</td><td style="width: 32.5358%;">Submitting the purchase form issues one ticket.</td><td style="width: 58.8679%;">1. Each successful submission issues exactly one ticket, which is recorded by the system.  
2. Pressing the submit button repeatedly while a purchase is being processed does not issue additional tickets.  
3. The ticket is displayed on screen immediately after the purchase completes.</td></tr><tr><td style="width: 8.57639%;">SP-07</td><td style="width: 32.5358%;">The ticket contains the information needed to identify the event and its holder.</td><td style="width: 58.8679%;">1. The ticket shows the event name, artist, date, venue name, the holder's full name and a ticket code.</td></tr><tr><td style="width: 8.57639%;">SP-08</td><td style="width: 32.5358%;">Every ticket code is unique.</td><td style="width: 58.8679%;">1. No two tickets share the same code, across all events.  
2. Two purchases for the same event by the same person produce two tickets with different codes.</td></tr></tbody></table>

## 4. Out of scope

The following are explicitly excluded from the MVP:

- Searching by artist, venue, city or date, and any search filters.
- Seat selection, seat maps and ticket categories.
- Prices and payment.
- Purchasing more than one ticket per transaction.
- Capacity limits. Every completed purchase issues a ticket.
- Queues, seat holds and checkout countdowns.
- Sending the ticket by email, and QR codes.
- Fan accounts, and retrieving a ticket after leaving the confirmation screen.

## 5. Constraints

- No part of this feature requires the visitor to sign in.
- No external systems are used: no payment provider and no email provider. The email address is collected and stored only.