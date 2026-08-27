# FreshSource

Live Demo: https://freshsource-three.vercel.app

FreshSource is a harvest coordination platform for smallholder farmers. Unlike a standard marketplace that simply lists produce for sale, it is built around a five stage operating model, Forecast, Pool, Verify, Transport, Deliver, designed to solve a structural bottleneck in the smallholder supply chain, not just to connect buyers and sellers.

## Local Setup

Copy `.env.example` to `.env` and add the Supabase URL and anon key before testing authentication, listings, chat, orders, or payments. The public landing page can run without those values, but data features remain disabled until Supabase is configured.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

## Production Data Architecture

FreshSource uses Supabase PostgreSQL as the shared source of truth. The React frontend reads and writes the `users`, `listings`, and `orders` tables through Supabase, while FastAPI uses SQLAlchemy against the same PostgreSQL database for WhatsApp ingestion and server-side workflows. Apply `backend/schema.sql` to a new Supabase project or `backend/migrations/001_shared_supabase.sql` to an existing project before deploying the API. Use the root `.env.staging.example` and `.env.production.example` files as environment templates; never commit real credentials.

## The Problem

Smallholder farmers lose between 20% and 50% of fruits and vegetables after harvest. In one supply chain study of a specific farming corridor, researchers found a baseline post harvest loss of 9.4% for farmers even in a typical season, spiking to as high as 90% during seasonal gluts.

The root cause isn't that farmers can't find buyers. It's that a single smallholder farmer's harvest requires roughly 16 separate wholesale buyer relationships per week to clear before the crop spoils, a volume no smallholder can realistically coordinate alone. A conventional listing marketplace, however well built, still asks each farmer to individually attract 16 buyers a week. FreshSource removes that requirement entirely.

## How FreshSource Solves It

Forecast. Farmers can list produce not yet harvested, declaring an expected harvest date. This allows demand to be matched to supply before the crop even exists, rather than only after it's at risk of spoiling.

Pool. Instead of requiring a buyer to purchase from one farmer at a time, buyers can post a bulk order request, for example 500kg of tomatoes by Thursday. FreshSource automatically pools the order across multiple nearby farmers' active and forecasted listings, splitting one buyer's demand across as many smallholders as needed to fulfill it, and generating a separate tracked order and payout per farmer. This is the core mechanism that answers the 16 buyer bottleneck. A farmer no longer needs 16 buyers, because one buyer's order can now clear several farmers' harvests at once.

Verify. Transporters can be designated as Certified Agents. When a Certified Agent picks up produce, their confirmation carries additional weight and is displayed to the buyer, a lightweight first step toward the physical quality verification layer a fully decentralized agent network would provide at scale.

Transport. Farmers can request a specific registered transporter or broadcast an open request. Every pickup and delivery requires a photo captured directly on the transporter's device before the order can advance, creating a visible chain of custody for produce in transit, not just a status label.

Deliver. Buyers track their order through a live status timeline, confirm delivery on arrival, and leave a review. Listings that sell out or expire past their pickup window are automatically hidden from the marketplace, and available quantity updates in real time as orders are placed.

## Additional Features

USSD Simulator. Farmers without smartphone access can list produce via a simulated USSD interface, accepting keypad input and reading each screen aloud for low literacy users. A production version would use local language audio.

Real time updates. Listings, order status, and transporter job boards update live via Supabase subscriptions, without manual refresh.

In app messaging between buyers and farmers.

Smart recommendations. Freshness and price competitiveness scoring surfaces the strongest current listings to buyers.

Mobile Money and card payments via Flutterwave, including support for USSD based mobile payment.

## Tech Stack

React, React Router, Framer Motion. Supabase for database, auth, storage, and real time. Flutterwave for payments. Leaflet for mapping. Tailwind CSS. Vercel for deployment.

## Testing Payments

Payments run through Flutterwave's test and sandbox mode. To complete a mobile money payment during testing, enter any valid format phone number, and when prompted for an OTP, enter 123456. This is Flutterwave's documented sandbox test value and works for any test mobile money transaction. No real money is charged.

## Demo Accounts

Register as a Farmer, Buyer, or Transporter through the signup flow. Each role has a dedicated dashboard and workflow. Switch roles at any time from the in app role switcher.
