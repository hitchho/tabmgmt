# Privacy Policy for Manage Tabs by Domain (MV3)

**Published by: Rotko Networks OÜ**

**Last Updated: September 27, 2026**

## Introduction

This Privacy Policy describes how the "Manage Tabs by Domain (MV3)" Chrome extension (referred to as "the Extension," "we," "our," or "us") handles user data. We are committed to transparency and protecting your privacy.

## Data Collection and Usage

**The Extension does not collect, transmit, or share any user data.** It keeps no persistent record of the tabs you manage; the only information it holds is the session-scoped undo record described below, which never leaves your device.

Specifically:

- We do not collect any personal information
- We do not track your browsing activity
- We do not use cookies or other tracking technologies
- We do not transmit any data to external servers
- We do not use analytics services
- We do not persist any information about the tabs you manage beyond the current browser session (see "Undo data" below)

## Undo data

To support the "Undo last close" feature, the Extension keeps a short-lived,
in-memory record of the tabs it just closed (their URL, position, and pinned
state) using `chrome.storage.session`.

- This record never leaves your device and is never transmitted anywhere.
- It is scoped to the current browser session and is cleared when the browser
  is closed.
- It is overwritten by the next close operation.
- It can be cleared at any time by using the undo action, which deletes the
  record from session storage.

## Required Permissions

The Extension requires the following permissions to function:

- `tabs`: This permission is necessary to access and manage your browser tabs. This permission allows the Extension to read the URL of your tabs, close tabs, and reorder tabs based on domain. The Extension processes this information entirely within your browser and does not transmit any of this information elsewhere.
- `storage`: This permission is used solely to hold the session-scoped undo record described above. No data is stored beyond the current browser session and none of it is transmitted off your device.

## Third-Party Services

The Extension does not utilize any third-party services or APIs that would collect or process your data.

## Open Source

The Extension is open-source software. The complete source code is available for inspection at our GitHub repository, allowing you to verify our privacy practices:

https://github.com/hitchho/tabmgmt

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify users of any material changes by updating the "Last Updated" date at the top of this Privacy Policy.

## Contact Us

If you have any questions or concerns about this Privacy Policy or our privacy practices, please contact us at:

Email: hq@rotko.net
Company: Rotko Networks OÜ
Registration: 16740319 (Estonia)

## Consent

By installing and using the Extension, you consent to this Privacy Policy.

## Legal Compliance

This Privacy Policy complies with relevant data protection laws and regulations. As we do not collect any user data, many data protection regulations (such as GDPR, CCPA, etc.) have limited applicability to our extension.
