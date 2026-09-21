# JNVST Student Accounts V6

Fixes Student Accounts so it returns the complete teacher-owned JNVST group tree and student memberships, including legacy groups. It infers JNVST course from class membership when profile.course is empty. No SQL migration is required. Redeploy the create-students Edge Function.
