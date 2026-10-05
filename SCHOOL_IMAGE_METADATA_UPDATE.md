# School Question Bank — Image Metadata Update

School Course only. JNVST is not changed.

Added fields to `school_question_bank_questions`:
- `image_required` boolean (default false)
- `image_description` text

Bulk Excel/Word/PDF metadata imports recognize `Image Required` and `Image Description`.

The Question Bank list displays 🖼 REQUIRED and the description. The Edit Question form lets the teacher set both fields. Uploading an image automatically switches Image Required to YES.

Run `SCHOOL_IMAGE_METADATA_MIGRATION.sql` once in Supabase SQL Editor before using the new fields.
