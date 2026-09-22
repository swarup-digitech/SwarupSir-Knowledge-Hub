# OMR Test Result — Google Drive Setup

This implementation adds **OMR Test Result** to the student dashboard.

## Google Drive structure

Create one root folder:

```text
OMR_TEST_RESULTS
├── JNVST-VI
│   ├── X01_report.pdf
│   ├── X02_report.pdf
│   └── ...
├── JNVST-IX
│   ├── IX01_report.pdf
│   └── ...
└── Other JNVST main groups
    └── ...
```

The folder names must match the project's **JNVST main-group names**.

The current fixed groups are normalized as:

- `JNVST-VI` (the project may display an older label such as `JNVST-VI (Class-IV)`)
- `JNVST-IX`

For teacher-created JNVST custom main groups, the project main-group name is used directly.

## File naming

For a student whose Roll No is `X01`, upload:

```text
X01_report.pdf
```

For Roll No `IX05`:

```text
IX05_report.pdf
```

The file must be directly inside the corresponding group folder.

## Security model

Students do not receive a public Google Drive link.

The browser calls the Supabase Edge Function:

```text
get-omr-result
```

The function:

1. Verifies the logged-in Supabase student.
2. Reads the student's Roll No.
3. Determines the student's JNVST main group from `class_students` / `classes`.
4. Searches the corresponding folder under `OMR_TEST_RESULTS`.
5. Finds `<roll_no>_report.pdf`.
6. Downloads the PDF server-side from Google Drive.
7. Returns the PDF to the authenticated student.

A student cannot supply another Roll No in the request.

## Google Cloud / Service Account setup

1. Open Google Cloud Console.
2. Create or select a Google Cloud project.
3. Enable **Google Drive API**.
4. Create a **Service Account**.
5. Create/download a JSON key for the service account.
6. In Google Drive, share the `OMR_TEST_RESULTS` root folder with the service-account email as **Viewer**.
7. Copy the root folder ID from the Google Drive URL.

Example:

```text
https://drive.google.com/drive/folders/1AbCdEfGh...
                                      ^^^^^^^^^^^
                                      root folder ID
```

Do not upload the service-account JSON key into GitHub or this project.

## Supabase secrets

Set these secrets for the Edge Function:

```text
GOOGLE_SERVICE_ACCOUNT_JSON = complete contents of the service-account JSON file
OMR_ROOT_FOLDER_ID = Google Drive ID of OMR_TEST_RESULTS
```

The function also uses the standard Supabase environment values:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Those are provided by Supabase Edge Functions.

### CLI example

```bash
supabase secrets set OMR_ROOT_FOLDER_ID="YOUR_ROOT_FOLDER_ID"
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"
supabase functions deploy get-omr-result
```

On Windows PowerShell, it is safer to set the JSON through the Supabase Dashboard if shell quoting becomes difficult.

## Student dashboard

The new card appears immediately below **Mock Tests**:

```text
Mock Tests
OMR Test Result
Assignments
```

Clicking **View OMR Result** loads the student's PDF.

The page provides:

- Embedded PDF viewer
- Open PDF button
- Download PDF button

## No-result behavior

If the teacher has not uploaded the file, the student sees:

> OMR Result Not Available  
> Your OMR result has not been uploaded yet. Please check again later.

No Google Drive error or internal file information is exposed.

## Important

Keep the Google Drive folders private. Do not make the entire OMR result folder public or use "Anyone with the link" sharing.

The application should be the access point for students.
