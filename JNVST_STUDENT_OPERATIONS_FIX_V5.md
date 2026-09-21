# JNVST Student Operations Fix V5

Fixes the JNVST Teacher Dashboard student operations:
- Add Student is available from the JNVST dashboard and is JNVST-scoped.
- Bulk Students (Excel) is available from the JNVST dashboard and validates JNVST class/group names.
- Student Accounts loads JNVST students from all teacher-owned non-School class memberships, then filters by profile course so School students are excluded.
- Main Group/Sub-group filtering is repaired for legacy memberships.
- Change Group supports legacy JNVST sub-groups without jnvst_group_type when course is JNVST-6/JNVST-9.
- Existing confirmation/safety messages are retained.

No SQL migration is required. Redeploy the frontend and the create-students Edge Function.
