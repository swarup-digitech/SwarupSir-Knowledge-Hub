# School Course Question Paper Generator — v4

Implemented all requested controls:

1. Optional Chapter Filter is multi-select. No selection means all chapters are eligible; selected main chapters include their subchapters.
2. Fixed Questions are persistent Question Bank properties (`is_fixed`). They can be set during Excel bulk upload, PDF metadata bulk upload, or later in the Question Bank/editor. Only fixed questions appear in the Generator's Fixed Questions section and they are included automatically.
3. Variation Groups are mutually exclusive: at most one question from a group can appear. Conflicting fixed questions are rejected before generation.
4. Chapter-wise minimum/maximum marks are supported in the Generator and through Excel bulk upload.
5. A dedicated `📊 Chapter Marks Range` menu/button is now available from the teacher dashboard and Question Bank, so the bulk-upload option is directly accessible instead of being hidden inside Generate Paper.
6. The dedicated Chapter Marks Range screen saves ranges in browser storage for the current teacher and reloads them in Generate Paper.
7. Excel template: `Chapter_Wise_Marks_Range_Bulk_Upload_Template.xlsx`.
8. Cognitive schema defaults to Knowledge 30%, Understanding 30%, Application 20%, HOTS 20%; generator reports unavoidable whole-mark rounding.
9. Fixed-question marks count toward total paper marks, chapter ranges, and cognitive distribution. Fixed-question conflicts with selected chapter filters or chapter maximums are rejected.
10. Question Bank has Fixed Only / Non-Fixed Only filters and Mark Fixed / Unfix actions.

Run `school_question_paper_generator_upgrade.sql` once in Supabase if not already applied.
