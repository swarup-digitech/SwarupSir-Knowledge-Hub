# V39 – Download fee details
Students Fees page: new green button "⬇ Download Fee Details (Excel)". No SQL change.
Excel has two sheets: Fee Summary (per student: fee, discount, net, paid, balance, status, last payment date, totals row) and Payments (date, student, amount, mode, reference, remarks, received by).
Respects the Search / Status filter currently selected on the page. Includes V38.1 (PDF blank-page fix) and V38 changes. Cache-bust teacher-app.js?v=56.

## V39.1
Export is now a student list with details: Name, Roll No, Username, Class/Batch, Course, Fee Plan, Total Fee, Discount, Net, Fees Paid, Fees Due, Status, Last payment. Sheet "Students & Fees" + "Payments". Cache-bust v=57.
