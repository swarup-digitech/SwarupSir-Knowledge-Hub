# Student Fees / Subscription Module

## 1. Database

Run `student_fees_management.sql` once in the Supabase SQL Editor.

It creates:

- `student_fee_accounts` — one current course-fee account per student.
- `student_fee_payments` — individual payment transactions.
- RLS policies for students (own data) and teachers (own fee accounts).

## 2. Edge Function

Deploy the updated:

`supabase/functions/create-students/index.ts`

The same code is also kept in the root `create-students.ts` file for convenience.

The function now supports:

- `feeList`
- `feeSaveAccount`
- `feeAddPayment`
- `feeBulkImport`

## 3. Student Dashboard

Students now have:

`Home | Subscription | Logout`

The Subscription page shows:

- Total Course Fees
- Total Paid
- Discount (hidden when zero)
- Balance Amount
- Teacher message when enabled
- Payment history

Students have read-only access.

## 4. Teacher Dashboard

The JNVST teacher dashboard has a new **Students Fees** button.

It provides:

- Fee account management
- Discount management
- Manual payment entry
- Payment history
- Student message and show/hide control
- Fee summary
- Bulk Excel upload

## 5. Bulk Excel Upload

### Paid Payments

Columns:

`Roll No | Payment Date | Amount Paid | Payment Mode | Reference No | Remarks`

The upload first validates the rows and displays a preview. Nothing is saved until **Confirm Import** is clicked.

A batch ID is generated for every import, for example:

`FEE-20260922105100-AB12CD34`

Duplicate payments are skipped using student/payment date/amount/reference matching.

### Fee Setup

Columns:

`Roll No | Total Course Fee | Discount | Course Name | Message | Show Message`

Existing fee accounts are updated by Roll No.

## 6. Fee calculation

`Net Fee = Total Course Fee - Discount`

`Balance = MAX(0, Net Fee - Total Paid)`

`Total Paid` is always calculated from `student_fee_payments` rather than manually entered.

## 7. Important deployment order

1. Run `student_fees_management.sql`.
2. Deploy the updated `create-students` Edge Function.
3. Publish/deploy the updated `main.html`.
4. Log in as teacher and open **Students Fees**.
5. Download the Excel template.
6. Upload a small test file and verify the preview.
7. Confirm the import.
8. Log in as a student and verify **Subscription**.
