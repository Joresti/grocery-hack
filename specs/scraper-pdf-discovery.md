Feature: Scraper PDF Discovery

The scraper must dynamically discover and download the PDF flyer from each store's
flyer page on every run. No per-store selectors or click paths are hardcoded. If a
store redesigns its page, the scraper adapts without code changes.


Scenario: Store has a visible PDF/download/print button
Given the scraper navigates to a store's flyer_url
When a button or link matching PDF, download, or print patterns is visible on the page
Then the scraper clicks it
And if it navigates to a new page with a second download link, follows that too
And downloads the resulting PDF

Scenario: Store has PDF download behind a context menu
Given the scraper navigates to a store's flyer_url
When no visible PDF/download/print button is found on the page
Then the scraper looks for context menu triggers (e.g. "More", "...", ellipsis icons)
And opens each one
And scans the revealed menu for PDF/download/print options
And clicks the matching option to download the PDF

Scenario: No PDF found anywhere — fallback to page capture
Given the scraper has exhausted all PDF discovery steps
When no PDF download could be found
Then the scraper falls back to full-page screenshot capture
And logs a warning: "No PDF found for {store_name}, falling back to page capture"
And proceeds with the existing scroll-and-capture strategy


Feature: PDF Discovery Search Patterns

The scraper scans for interactive elements matching these patterns. All matching
is case-insensitive.

Button/link text patterns:
  - "download" (with or without "pdf" or "flyer")
  - "view pdf"
  - "pdf flyer"
  - "print this flyer"
  - "print flyer"
  - "save as pdf"

Context menu trigger patterns:
  - Button text: "More", "..."
  - aria-label containing: "more options", "more actions", "menu"
  - Ellipsis icons (three dots)

Link href patterns:
  - URLs ending in .pdf
  - URLs containing "pdf" in the path

Network interception:
  - Monitor all network responses during button clicks
  - Capture any response with content-type "application/pdf" or URL ending in .pdf
  - This catches cases where clicking a button triggers a PDF download without
    a visible href


Feature: PDF Processing

Scenario: PDF downloaded successfully
Given a PDF file has been downloaded from a store's flyer page
Then each page of the PDF is converted to a PNG image
And each image is sent to Claude Haiku for deal extraction
And the same Zod validation, deduplication, and insertion logic applies


Feature: Adaptive Discovery

The discovery strategy is not hardcoded per store. Every week, the scraper runs
the same ordered discovery steps against every store:

  1. Dismiss cookie/consent banners
  2. Scan main page for PDF buttons/links
  3. Scan main page for context menus → open → scan for PDF options
  4. If PDF found: download and process
  5. If no PDF found: fall back to scroll-and-capture

This means if a store adds a PDF button where there wasn't one, or moves it
behind a new menu, or switches from one flyer viewer to another, the scraper
adjusts on the next run.


Feature: Known Store Patterns (reference only, not used in code)

These are the observed patterns as of 2026-03-28. They exist here for human
reference and debugging — the scraper does NOT branch on store name.

| Store       | Pattern                                                  |
|-------------|----------------------------------------------------------|
| No Frills   | "View PDF Flyer" button → new page → "Download PDF" link |
| FreshCo     | "Print This Flyer" button                                |
| Food Basics | Context menu → download PDF                              |
| Metro       | Context menu → download PDF                              |
| Fortinos    | (not yet verified)                                       |
| Walmart     | (not yet verified)                                       |
