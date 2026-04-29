const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

const FRONTIER_AIRPORTS = [
  "ATL","AUS","BNA","BOS","BWI","CLE","CLT","CMH","CVG","DAL",
  "DCA","DEN","DFW","DTW","EWR","FLL","HOU","IAD","IAH","IND",
  "JAX","LAS","LAX","MCO","MDW","MEM","MIA","MKE","MSP","MSY",
  "OAK","OKC","OMA","ORD","PDX","PHL","PHX","PIT","RDU","RSW",
  "SAN","SAT","SEA","SFO","SLC","SMF","STL","TPA","CUN","MBJ",
  "PUJ","NAS","GUA","SJO","SDQ","SJU"
];

function getDateString(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function scrapeGoWildFlights(origin, date) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  const results = [];

  try {
    const page = await browser.newPage();

    // Set realistic browser headers
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    );

    // Load the Frontier search page to establish a real session
    console.log("Loading Frontier to establish session...");
    await page.goto(
      `https://booking.flyfrontier.com/Flight/Search?o1=${origin}&d1=LAS&dd1=${date}&ADT=1&mon=true&adt=1`,
      { waitUntil: "networkidle2", timeout: 30000 }
    );
    console.log("Session established.");

    // Now loop through all destinations
    const destinations = FRONTIER_AIRPORTS.filter(a => a !== origin);

    for (const dest of destinations) {
      try {
        console.log(`Checking ${origin} -> ${dest}...`);

        const payload = {
          areUnaccompaniedMinors: false,
          availabilityFares: [
            {availabilitySearchAllowed: true, fareCode: "R",  lowestFaresAllowed: true},
            {availabilitySearchAllowed: true, fareCode: "WB", lowestFaresAllowed: true},
            {availabilitySearchAllowed: true, fareCode: "TC", lowestFaresAllowed: true},
            {availabilitySearchAllowed: true, fareCode: "BZ", lowestFaresAllowed: true},
            {availabilitySearchAllowed: true, fareCode: "MC", lowestFaresAllowed: true},
            {availabilitySearchAllowed: true, fareCode: "GW", lowestFaresAllowed: true}
          ],
          availabilityProductClasses: [
            {availabilitySearchAllowed: true, lowestFaresAllowed: true, productClassCode: "O"},
            {availabilitySearchAllowed: true, lowestFaresAllowed: true, productClassCode: "TC"}
          ],
          calendarLink: `o1=${origin}&d1=${dest}&c=true&mon=true&adt=1`,
          calendarSections: null,
          childAges: [],
          departAmount: 0,
          departMilesTaxAmount: 0,
          departureDateOne: date + " 00:00:00",
          departureDateTwo: "0001-01-01 00:00:00",
          destinationOne: dest,
          destinationTwo: null,
          fareTypeBy: "DD",
          hasActiveDDSubscription: true,
          hasLoyaltyFares: false,
          inboundDate: "2026-11-19 00:00:00",
          includeLoyalty: false,
          infantInLapCount: 0,
          isChangeFlight: false,
          isCodeShareFlight: false,
          isFriendsFlyFreeValid: false,
          isGoWildOutOfRange: false,
          isKidsFlyFreeValid: false,
          isMilesForBundleBooking: false,
          isRoundTrip: false,
          isRoundTripFaresEnabled: true,
          isSessionNull: false,
          journeys: [{
            arrivalStation: dest,
            departureDateOne: date + " 00:00:00",
            departureStation: origin
          }],
          originOne: origin,
          searchType: "Normal"
        };

        // Use page.evaluate to make the POST request from inside the browser
        // This uses the real session cookies automatically
        const data = await page.evaluate(async (url, payload) => {
          const body = new URLSearchParams();
          body.append("jsonString", JSON.stringify(payload));

          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "application/json, text/plain, */*",
              "X-Requested-With": "XMLHttpRequest"
            },
            body: body.toString()
