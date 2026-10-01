# MVP 01 Venue and Event Registration

<table id="bkmrk-product-release-stat"><thead><tr><th>Product</th><th>Release</th><th>Status</th><th>Version</th></tr></thead><tbody><tr><td>Ticket D-Saster</td><td>MVP</td><td>Draft</td><td>1.0</td></tr></tbody></table>

---

## 1. Feature description

This feature allows the platform's partners to register the venues and events that the platform will offer to fans. It involves two actors:

- **Venue Owner** registers a venue by providing its name, a description and its location.
- **Organizer** registers an event on a previously registered venue by providing the event name, the artist, the date and the venue.

In the MVP a venue is a basic record: it has no seat map, sections or capacity. An event has no ticket categories, prices or on-sale schedule. Both actors must be signed in as per [MVP 03 ](https://gateway.tail9a6ddb.ts.net/bookstack/books/prds/page/mvp-03-partner-access "MVP 03 Partner Access").

## 2. Goal

Establish the catalogue of venues and events on which every other feature depends, with every record attributable to the partner who created it.

## 3. Requirement breakdown

<table id="bkmrk-id-requirement-accep" style="width: 100%;"><thead><tr><th style="width: 8.45784%;">ID</th><th style="width: 32.3009%;">Requirement</th><th style="width: 59.2313%;">Acceptance criteria</th></tr></thead><tbody><tr><td style="width: 8.45784%;">VE-01</td><td style="width: 32.3009%;">A venue owner can register a venue with a name, a description and a location.</td><td style="width: 59.2313%;">1. Name, description and location are mandatory. A registration missing any of them is rejected, indicating which field is missing.  
2. Location is entered as free text (for example, city and address).  
3. On success, the venue is stored and a confirmation is shown to the venue owner.</td></tr><tr><td style="width: 8.45784%;">VE-02</td><td style="width: 32.3009%;">Each venue is attributed to the venue owner who registered it.</td><td style="width: 59.2313%;">1. The stored venue records the identity of the venue owner who registered it.  
2. That identity is obtained from the signed-in session, never from a value entered in or submitted with the form.</td></tr><tr><td style="width: 8.45784%;">VE-03</td><td style="width: 32.3009%;">Registered venues are available for selection when registering an event.</td><td style="width: 59.2313%;">1. When registering an event, the organizer is presented with the list of all registered venues.  
2. A venue registered by any venue owner appears in that list the next time an organizer opens the event registration form.</td></tr><tr><td style="width: 8.45784%;">VE-04</td><td style="width: 32.3009%;">An organizer can register an event with a name, an artist, a date and a venue.</td><td style="width: 59.2313%;">1. Event name, artist, date and venue are mandatory. A registration missing any of them is rejected, indicating which field is missing.  
2. The date must be a valid calendar date.  
3. The venue is chosen from the list defined in VE-03.  
4. On success, the event is stored and a confirmation is shown to the organizer.</td></tr><tr><td style="width: 8.45784%;">VE-05</td><td style="width: 32.3009%;">An event can only be registered on an existing venue.</td><td style="width: 59.2313%;">1. A registration that references a venue that does not exist is rejected.  
2. The rejection applies to any request that reaches the system, including requests that do not originate from the application screens.</td></tr><tr><td style="width: 8.45784%;">VE-06</td><td style="width: 32.3009%;">Each event is attributed to the organizer who registered it.</td><td style="width: 59.2313%;">1. The stored event records the identity of the organizer who registered it.  
2. That identity is obtained from the signed-in session, never from a value entered in or submitted with the form.</td></tr><tr><td style="width: 8.45784%;">VE-07</td><td style="width: 32.3009%;">Registration actions are restricted by role.</td><td style="width: 59.2313%;">1. A signed-in organizer attempting to register a venue is rejected.  
2. A signed-in venue owner attempting to register an event is rejected.  
3. The restriction is enforced by the system, not only by hiding options on the application screens.</td></tr><tr><td style="width: 8.45784%;">VE-08</td><td style="width: 32.3009%;">Registration requires a signed-in partner.</td><td style="width: 59.2313%;">1. A request to register a venue or an event without a valid session is rejected.  
2. The registration forms are not available to visitors who are not signed in.</td></tr></tbody></table>

## 4. Out of scope

The following are explicitly excluded from the MVP:

- Seat maps, sections, rows, seats and venue capacity.
- Ticket categories and prices.
- Scheduling of the on-sale date and time.
- Editing or deleting venues and events.
- Images or other media for venues and events.
- Event performance analytics for organizers.

## 5. Constraints

- Partners are identified by the JSON Web Token (JWT) issued under. The application screens send the token with every registration request.
- Every component that receives a registration request verifies the token and derives the partner's identity and role from it. Checks performed only in the application screens do not satisfy VE-02, VE-06 or VE-07.