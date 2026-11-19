# Calvin Airlines Inc. – Flight Ticketing System

A responsive front-end prototype of an airline ticketing system built with plain HTML, CSS and JavaScript.
Core workflow: **select a flight → choose seats → calculate cost → generate ticket confirmation.**

## Members
- (Add your name and your groupmates' names here)
- Section: (Add your section here)

## Project structure
```
calvin-airlines/
├── index.html            Single-page interface (all views and dialogs)
├── css/style.css         All styles (responsive, print styles for the ticket)
├── js/script.js          All logic (data, validation, storage, rendering)
├── assets/logo.svg       Original logo (also used as favicon)
├── docs/
│   ├── USER_GUIDE.md     Step-by-step guide to the main workflow
│   ├── TESTING_REPORT.md Test cases, expected/actual results, fixes
│   └── screenshots/      Desktop, tablet and mobile screenshots
└── README.md
```

## Features
- **Home / dashboard** – system name, purpose, quick links and live stats (active bookings, upcoming trips, total ticket value, cancelled).
- **Flights** – 10 fictional daily flights; filter by date, origin, destination; sort by time, price or flight number; seats-left count per date.
- **Booking form** – validated form with interactive seat map (Business rows 1–3, Economy rows 4–12), per-passenger names, contact details, simulated payment, live cost summary.
- **Confirmation** – unique reference number (`CAL-YYYYMMDD-XXXX`), full details, passengers, totals, status, printable e-ticket.
- **My Bookings** – view, edit (contact, passenger names, status), cancel (releases seats) or delete, each with a confirmation dialog; search by reference, name, flight, city or seat; filter by status and date.
- **About / Help** – description and user instructions.
- Records are kept with **localStorage**; JSON **export/import** and **sample data** are included.

## Business rules
- Passenger quantity must be a whole number from 1 to 6, and the number of seats selected must match it.
- A seat already reserved for the same flight and date in saved records cannot be selected again (re-checked on submit). Cancelling a booking releases its seats.
- Past dates and flights that already departed today are rejected; bookings up to 180 days ahead.
- Total = seat fares (Business = 2× base fare) + 12% VAT + ₱150 booking fee per ticket.
- Cancelled bookings cannot be edited; Completed bookings cannot be cancelled.

## Setup
No build step or dependencies. Unzip and open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
Optionally host the folder on any static host (GitHub Pages, Netlify).

## Dependencies
None. No jQuery, Bootstrap, external fonts or CDN files. Fonts are system fonts.

## Simulated / demonstration features
Payments, seat availability, e-mail/SMS notifications and tickets are simulated. Availability and conflict checks only apply to bookings saved in the current browser and device. All people, emails and phone numbers are fictional.

## Limitations
- No backend: data exists only in this browser's localStorage (clearing site data deletes it; use Export JSON for a backup).
- Seats cannot be changed when editing a booking (cancel and rebook instead).
- Flight schedule is a fixed daily list; times are shown without time-zone conversion.

## Credits
All code, text, logo and artwork were created for this project. Airport names are used only as fictional sample data.
