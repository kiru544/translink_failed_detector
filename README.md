# Translink Failed Trip CSV Checker

A simple browser-based app for checking Translink travel-history CSV files and finding possible failed touch-on/touch-off trips.

The app reads a Translink CSV file locally in the browser, detects possible failed trips, and shows the closest transaction before and after each issue.

---

## Why I built this

Although $2.50 is still considered cheap for public transport, but it's frustrating when the fare machine makes mistakes. So I built this web app to check my travel history and identify if there are any issues.
  

---

## What it does

* Upload and read a Translink travel-history CSV file
* Detect possible failed trips
* Display the total number of records
* Display the number of possible failed/default fares
* Display the total detected charge
* Show the closest record before the failed trip
* Show the closest record after the failed trip
* Runs locally in the browser

---

## Detection logic

The app currently detects an issue when:

```js
transaction.fare === 2.5 || combinedText.includes("failed")
```

This means it checks for:

* A fare of `$2.50`
* A row containing the word `failed`

Normal `$0.00` transfer records are ignored.

---

## CSV format

The app is designed for Translink travel-history CSV files with this kind of structure:

```csv
Date,Time,From,Time,To,Fare,Credit,Balance
```


## How to use

1. Download your travel history CSV from the Translink website.
2. Open `index.html` in a browser.
3. Click **Choose file** and select your Translink CSV file or Drag and drop the CSV file.
4. Review any detected failed trips and nearby records.

---

## Privacy

This app runs fully in the browser.

The CSV file is not uploaded to a server, and the travel-history data stays on the user's device.

---

## Built with

* HTML
* CSS
* JavaScript

---
