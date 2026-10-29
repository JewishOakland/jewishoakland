# Enquiry approval service (draft, not connected yet)

`Code.gs` is a Google Apps Script for a planned approval system. The website does not use it yet.

How it is meant to work, once set up in a Google Sheet:

- The enquiry form sends each enquiry to the script, which saves it in the sheet as Pending.
- The script emails info@jewishoakland.org a link to review the enquiry and approve or decline it.
- Approved dates are shown as Reserved on the website calendar.
- Any row with Status "Approved" and a Date blocks that date, so dates can also be blocked by editing the sheet.

Still to do: connect the website form and calendar to the script, add tests, and write the setup steps.
