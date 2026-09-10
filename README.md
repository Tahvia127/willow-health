# Willow Community Health

Six clinics, eight services, and a finder that answers the only question a patient has: *which one do I go to, and is it open?*

**Status:** unpublished demo. Not on GitHub Pages, not linked from the studio site.
**Built by:** Framework Studio.

---

## What this one proves

The hardest information architecture problem in the set. A clinic network is a matrix — services on one axis, locations on the other — and most of them publish it as six separate pages that each list everything, so patients turn up at the wrong site.

**Distance sorting without a geocoding API.** Enter a ZIP and the list reorders by real distance, computed with the haversine formula against a table of Chicago ZIP centroids that ships with the page. No Google Maps bill, no API key, no request leaving the browser. `Use my location` uses the browser's own geolocation when a visitor prefers it.

**Opening status from the visitor's clock.** "Open now, until 7pm" is computed at page load from the actual time and each clinic's per-day hours. If a clinic is shut it says when it next opens, rolling forward to the next open day. Nothing about this is written into the content.

**Service filtering across the matrix.** Choose Dental and the list drops to the three clinics that offer it, the map drops to three pins, and the matching chip is highlighted on each card so it is obvious why that clinic survived the filter.

**The services section reads the other direction** — each service names the clinics that provide it, because patients arrive from both directions.

## How it works

```
data/locations.json ─┐
data/services.json  ─┤─> build.mjs ─> index.html
data/zips.json      ─┤
data/site.json      ─┘
```

`build.mjs` refuses to build if a clinic advertises a service that does not exist, or if an hours array is not exactly seven entries. Both are the kind of typo that would silently produce a clinic page listing a service nobody there provides.

Zero dependencies. The map is Leaflet with OpenStreetMap tiles.

## Repository layout

```
data/locations.json  Six clinics: coordinates, per-day hours, services, phone.
data/services.json   Eight services and what they mean.
data/zips.json       32 Chicago ZIP centroids for distance sorting.
build.mjs            Renders and validates. No dependencies.
index.html           Generated. Do not edit by hand.
```

## Running it

```bash
node build.mjs
python3 -m http.server 8000
```

## Design notes

- **Type:** Outfit for display, Inter for body.
- **Color:** paper `#F5F7F8`, deep blue `#254B63`, copper `#A05A22`. All pairings clear WCAG AA; the light copper was raised from 3.85:1 to 5.06:1 on the deep panel.
- **Open and closed are not colour alone** — the status text says which, so it survives a monochrome screen or colour blindness.
- **Hours are a real `<table>`** with a caption and row headers, and today's row is marked, so a screen reader reads it as a schedule rather than a list of times.

## Before this goes to a real client

1. Replace the clinic data. If the network has more than a handful of sites, add the ZIP centroids they need, or swap the lookup for a geocoding call.
2. Point Directions at whichever map service the organisation prefers.
3. Add holiday closures. The current model handles a weekly pattern and nothing else, which is the honest limit of this build.
4. Set `demo.show` to `false` in `data/site.json`.

## A note on the clinics

Willow Community Health is fictional. The neighbourhoods are real Chicago community areas and the coordinates are accurate, so the distance sorting behaves believably, but the clinics, hours, phone numbers and sliding-scale figures are invented. Every page carries a banner saying so, and the contact section directs medical emergencies to 911 rather than to the fictional phone line.
