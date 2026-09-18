# JNVST Duplicate Fixed-Group Fix

The previous version could leave multiple database rows matching the fixed `JNVST-VI (Class-IV)` / `JNVST-IX (Class IX)` labels. The dashboard then displayed every matching row as a main group, and legacy subgroup markers could make the same subgroup appear under multiple main groups.

This version fixes both issues:

- On JNVST teacher-dashboard load, one canonical fixed main group is retained for each fixed group.
- Duplicate fixed main groups are merged into the canonical row before deletion.
- Students directly attached to a duplicate main group are moved to the canonical group.
- Assignments directly attached to a duplicate main group are moved to the canonical group.
- Explicitly parented sub-groups are moved to the canonical main group; same-named duplicates are merged.
- `jnvstSubgroupsForMain()` now prefers the explicit `jnvst_parent_id` relationship and uses the old description marker only as a legacy fallback. This stops one subgroup from appearing under every duplicate main group.
- No manual deletion of the duplicate rows is required if the logged-in teacher has permission to manage their own classes.

After deploying this version, open the JNVST Teacher Dashboard once. The cleanup runs automatically and is idempotent.
