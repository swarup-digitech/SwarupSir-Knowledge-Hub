# School Assignment Group Fix

## Fixed
- School Course assignment creation now supports selecting the entire class, one subdivision, or multiple subdivisions under a class.
- Student recipients are filtered by the selected subdivisions using `profiles.school_group_id`.
- Assignment recipient records remain explicit in `assignment_students`.
- Assignment metadata records all selected subdivision names in `assignments.sub_group` for management/display.
- School Assignment Management no longer shows `School Course assignment groups are managed separately.` when Edit Class / Subdivision is clicked.
- Existing School assignments can change class and recipient subdivisions from the management screen.
- Changing the group refreshes `assignment_students` for that assignment to the selected class/subdivision recipients.
- JNVST assignment-group behavior remains unchanged.

## Deployment
No new database migration is required for this fix. Deploy the updated web files. Existing assignment recipient records are reused.
