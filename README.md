# Urwah Tahir — Clinical Management Portfolio Website

A responsive, animated academic portfolio built with **HTML5, Bootstrap 5, custom CSS and vanilla JavaScript**. It includes the actual uploaded clinical photographs and **fully local PDF creation**, with no server, signup, API key or internet access required.

## Getting started

1. Unzip `Urwah_Clinical_Portfolio.zip`.
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox or Safari).
3. Use the **Weekly journal**, **Photo archive** and **PDF downloads** sections. Every week has its own PDF download and **Export portfolio** creates the combined report.

You may also serve the website on localhost or deploy it directly to any static hosting provider (Netlify, GitHub Pages, Cloudflare Pages, IIS, Apache, nginx, etc.).

## Working features

- 8 selectable clinical weeks with search, Previous / Next navigation and focus areas.
- 24 attached photographs grouped by week, responsive photo gallery, filter and modal viewer.
- Full-size image viewing, keyboard Left / Right navigation and individual image download.
- PDF per week: professional A4 clinical learning notes **with all of that week's photographic evidence embedded**. Week 5 generates additional photo pages automatically.
- Complete portfolio PDF: cover page, introduction, goal, eight weeks of notes, photo pages and conclusion.
- PDF generation runs locally in JavaScript and does not depend on a CDN or online service.
- Bootstrap navigation/modal, mobile menu, scrolling section navigation, toast feedback and reduced-motion accessibility.

## Portfolio data and photos

- Edit `js/content.js` for student details, clinic details, portfolio text, week learning notes, focus areas and image-to-week mapping.
- The editable JPEG files are in `assets/photos/`.
- `js/photo-data.js` contains **embedded copies** of the JPEGs so PDF creation works when `index.html` is opened directly from a computer as `file://` (which normally prevents JavaScript from fetching other local files).
- If you change a JPEG, run `python tools/rebuild_photos.py` once to update the embedded copies; otherwise the website will keep displaying the original photo embedded in `js/photo-data.js`.

## Important photo and privacy notes

The uploaded archive contains image files **01–07 and 09–25**, but **08.jpg is absent**. Based on the actual visual content, `05.jpg` (an OPG scan) has been grouped under **Week 3 / Radiography** with `06.jpg` and `07.jpg`. This is explicitly noted in the website and PDF; no nonexistent image has been invented.

Image **04.jpg** includes an identifiable patient-history sheet. The patient name, contact information and OPD record number have been blurred **in the portfolio copy** to reduce accidental disclosure. The original ZIP supplied by the user was not modified. Before publishing this website publicly, obtain consent for patient-facing photographs, verify institutional permission to share clinical images, and remove any remaining sensitive information.

## Folder layout

```
index.html                   Main page
css/style.css                Responsive design and animations
js/content.js                All editable portfolio text and mappings
js/photo-data.js             Embedded photos for direct-open/offline use
js/app.js                    Tabs, search, filters, gallery, modal, navigation
js/pdf-export.js             Browser-native A4 PDF exporter
vendor/bootstrap.min.css     Bootstrap 5.1.1 (MIT license)
vendor/bootstrap.bundle.min.js Bootstrap 5.1.1 with modal
assets/photos/               Editable JPEG photographs
samples/                     Example generated PDFs
tools/rebuild_photos.py      Rebuild embedded photo data after edits
```

> Bootstrap's original copyright and MIT licensing comments are included in vendor files.
