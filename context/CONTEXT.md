# Ticket D-Saster

is an event ticketing platform designed to manage the complete lifecycle of ticket sales and venue access. The system serves four main actors: fans, buyers, event organizers, and venue owners.

Fans can discover and search for events using filters such as artist, location, venue, or date. Buyers can view seat availability, select specific seats, review their category and price, and complete purchases using credit card payments. During checkout, seats are temporarily reserved with a persistent five-minute timer, allowing users to recover their purchase session after interruptions. The platform can also place users in a waiting queue during periods of high demand and generates a ticket with a QR code once payment is completed.

Venue owners can register venues and manage their seating maps, while organizers can publish events, select venues, configure seating categories, schedule ticket sale dates, and monitor sales metrics such as sold seats, remaining inventory, and collected revenue. Event staff can validate tickets by scanning their QR codes at the venue entrance.

Architecturally, the platform separates responsibilities into dedicated services and APIs for event search, venue management, event management, ticket booking, authentication, and payments, supported by persistent stores for events, venues, and tickets.
