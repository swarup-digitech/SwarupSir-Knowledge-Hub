import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await req.json();

    // ------------------------------------------------------------
    // Student login: Roll No + Password only.
    // Roll No is stored in profiles.roll_no; the real Supabase email
    // remains hidden from the student.
    // ------------------------------------------------------------
    if (body.action === "studentLogin") {
      const rollNo = String(body.roll_no ?? "").trim();
      const password = String(body.password ?? "");
      if (!rollNo || !password) return json({error:"Roll No and Password are required."},400);

      const { data: student, error: se } = await admin
        .from("profiles")
        .select("id, full_name, roll_no")
        .eq("roll_no", rollNo)
        .eq("role", "student")
        .maybeSingle();
      if (se) return json({error:se.message},400);
      if (!student) return json({error:"Invalid Roll No or Password."},401);

      const { data: cred, error: ce } = await admin
        .from("student_credentials")
        .select("email")
        .eq("student_id", student.id)
        .maybeSingle();
      if (ce || !cred?.email) return json({error:"Student login is not configured for this Roll No."},401);

      const publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(supabaseUrl, publicKey, {
        auth: { autoRefreshToken:false, persistSession:false }
      });
      const { data: login, error: le } = await authClient.auth.signInWithPassword({
        email: cred.email,
        password
      });
      if (le || !login.session) return json({error:"Invalid Roll No or Password."},401);

      return json({
        success:true,
        access_token:login.session.access_token,
        refresh_token:login.session.refresh_token,
        student_id:student.id,
        full_name:student.full_name,
        roll_no:student.roll_no
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({error:"Missing authorization."},401);
    const token = authHeader.replace("Bearer ", "");
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller.user) return json({error:"Not authenticated."},401);

    // Teacher authorization: normally the teacher profile identifies the
    // caller.  Some older projects have a valid Auth teacher account but a
    // missing/out-of-sync profiles row.  In that case, safely fall back to
    // class ownership: only an account that owns at least one class can use
    // this teacher function.  This prevents the Student Accounts page from
    // failing with the misleading "Profile not found" error.
    const { data: teacher } = await admin.from("profiles")
      .select("id, role").eq("id", caller.user.id).maybeSingle();
    let teacherAuthorized = teacher?.role === "teacher";
    if (!teacherAuthorized) {
      const { data: ownedClasses, error: ownerErr } = await admin
        .from("classes").select("id").eq("teacher_id", caller.user.id).limit(1);
      if (ownerErr) return json({error:ownerErr.message},400);
      teacherAuthorized = (ownedClasses ?? []).length > 0;
    }
    if (!teacherAuthorized)
      return json({error:"Only teachers can use this function."},403);

    // ------------------------------------------------------------
    // Teacher: list SCHOOL-course students in the teacher's own classes.
    // The School Teacher Dashboard calls this action. Keep it separate from
    // listCredentials, which is intentionally JNVST-only.
    // ------------------------------------------------------------
    if (body.action === "listSchoolStudents") {
      const { data: memberships, error: me } = await admin
        .from("class_students")
        .select(`student_id, class_id, classes!inner(
          id, name, course, teacher_id
        )`)
        .eq("classes.teacher_id", caller.user.id)
        .eq("classes.course", "SCHOOL");
      if (me) return json({error:me.message},400);

      const rows = memberships ?? [];
      const ids = [...new Set(rows.map((r:any)=>String(r.student_id)).filter(Boolean))];
      if (!ids.length) return json({success:true,students:[]});

      const { data: profiles, error: pe } = await admin
        .from("profiles")
        .select("id, full_name, username, roll_no, course, school_group_id")
        .eq("role", "student")
        .eq("course", "SCHOOL")
        .in("id", ids)
        .order("full_name");
      if (pe) return json({error:pe.message},400);

      const { data: creds, error: ce } = await admin
        .from("student_credentials")
        .select("student_id, email, password_plaintext, updated_at")
        .in("student_id", ids);
      if (ce) return json({error:ce.message},400);
      const cm = new Map((creds ?? []).map((c:any)=>[String(c.student_id), c]));

      const classMap = new Map<string,any>();
      for (const r of rows as any[]) {
        if (r.classes?.id && !classMap.has(String(r.classes.id))) {
          classMap.set(String(r.classes.id), r.classes);
        }
      }
      const membershipMap = new Map<string,any>();
      for (const r of rows as any[]) {
        const sid=String(r.student_id);
        if (!membershipMap.has(sid)) membershipMap.set(sid, r);
      }

      const students = (profiles ?? []).map((p:any)=>{
        const r=membershipMap.get(String(p.id));
        const c=r?.classes || classMap.get(String(r?.class_id||"")) || {};
        const cred=cm.get(String(p.id));
        return {
          id:p.id,
          full_name:p.full_name,
          username:p.username,
          roll_no:p.roll_no || "",
          course:p.course || "SCHOOL",
          class_id:r?.class_id || "",
          className:c.name || "",
          school_group_id:p.school_group_id || null,
          email:cred?.email || p.username || "",
          password:cred?.password_plaintext || "",
          updated_at:cred?.updated_at || null
        };
      });

      return json({success:true,students});
    }

    // ------------------------------------------------------------
    // Teacher: list student credentials for students in own classes.
    // Return the complete JNVST membership/group payload expected by the
    // Student Accounts page, including course and subgroup information.
    // ------------------------------------------------------------
    if (body.action === "listCredentials") {
      const { data: memberships, error: me } = await admin
        .from("class_students")
        .select(`student_id, class_id, classes!inner(
          id, name, course, teacher_id, jnvst_group_type, jnvst_parent_id, description
        )`)
        .eq("classes.teacher_id", caller.user.id);
      if (me) return json({error:me.message},400);

      const ids = [...new Set((memberships ?? []).map((r:any)=>String(r.student_id)))];
      if (!ids.length) return json({success:true,students:[],groups:[]});

      const { data: profiles, error: pe } = await admin
        .from("profiles")
        .select("id, full_name, username, roll_no, course")
        .in("id", ids)
        .order("full_name");
      if (pe) return json({error:pe.message},400);

      const { data: creds, error: ce } = await admin
        .from("student_credentials")
        .select("student_id, email, password_plaintext, updated_at")
        .in("student_id", ids);
      if (ce) return json({error:ce.message},400);
      const cm = new Map((creds??[]).map(c=>[String(c.student_id),c]));

      const classRows = (memberships ?? []).map((r:any)=>({
        student_id:String(r.student_id),
        class_id:String(r.class_id),
        class:r.classes
      }));
      const classById = new Map<string,any>();
      classRows.forEach(r=>{ if(r.class?.id) classById.set(String(r.class.id),r.class); });

      const isSub = (c:any) => String(c?.jnvst_group_type||"").toLowerCase().includes("sub") || !!c?.jnvst_parent_id;
      const groupName = (c:any) => String(c?.name||"");

      const groups = [...classById.values()]
        .filter((c:any)=>String(c?.course||"").toUpperCase().startsWith("JNVST"))
        .map((c:any)=>{
          const sub=isSub(c);
          const parent= c.jnvst_parent_id ? classById.get(String(c.jnvst_parent_id)) : null;
          return {
            id:c.id,
            name:groupName(c),
            course:c.course||"",
            is_subgroup:sub,
            main_group_id:sub ? (c.jnvst_parent_id || "") : c.id,
            main_group_name:sub ? (parent?.name || "JNVST") : groupName(c),
            description:c.description||""
          };
        });

      const students=(profiles??[]).map((p:any)=>{
        const ms=classRows.filter(r=>r.student_id===String(p.id));
        const membershipsOut=ms.map(r=>{
          const c=r.class||{};
          const sub=isSub(c);
          const parent=c.jnvst_parent_id ? classById.get(String(c.jnvst_parent_id)) : null;
          return {
            class_id:r.class_id,
            class_name:c.name||"",
            main_group_id:sub ? (c.jnvst_parent_id||"") : c.id,
            main_group_name:sub ? (parent?.name||"JNVST") : (c.name||""),
            is_subgroup:sub,
            course:c.course||""
          };
        });
        const jnvstMs=membershipsOut.filter((m:any)=>String(m.course||"").toUpperCase().startsWith("JNVST"));
        const availableSubgroups=groups.filter((g:any)=>g.is_subgroup && jnvstMs.some((m:any)=>String(m.main_group_id)===String(g.main_group_id)))
          .map((g:any)=>({class_id:g.id,class_name:g.name,main_group_id:g.main_group_id,main_group_name:g.main_group_name}));
        const cred=cm.get(String(p.id));
        return {
          id:p.id, full_name:p.full_name, username:p.username, roll_no:p.roll_no||"", course:p.course||"",
          email:cred?.email||p.username||"", password:cred?.password_plaintext||"",
          updated_at:cred?.updated_at||null, classes:membershipsOut.map((m:any)=>m.class_name),
          memberships:jnvstMs, available_subgroups:availableSubgroups
        };
      });

      return json({success:true,students,groups});
    }

    // ------------------------------------------------------------
    // Teacher: change a student's JNVST sub-group
    //
    // The Student Accounts page sends this action when the teacher selects
    // "Change Group".  Keep the authorization here (server-side) so a
    // teacher cannot move a student into another teacher's group or into a
    // different JNVST main group.
    // ------------------------------------------------------------
    if (body.action === "setStudentJnvstSubgroup") {
      const studentId = String(body.student_id ?? "").trim();
      const targetClassId = String(body.target_class_id ?? "").trim();
      if (!studentId || !targetClassId)
        return json({error:"Student and target JNVST sub-group are required."},400);

      // Target must be a JNVST SUB group owned by the logged-in teacher.
      const { data: target, error: targetErr } = await admin
        .from("classes")
        .select("id, name, course, teacher_id, jnvst_group_type, jnvst_parent_id")
        .eq("id", targetClassId)
        .maybeSingle();

      if (targetErr) return json({error:targetErr.message},400);
      if (!target)
        return json({error:"Target JNVST group was not found."},404);
      if (String(target.teacher_id) !== String(caller.user.id))
        return json({error:"You can only move students into your own JNVST groups."},403);

      const targetIsSub =
        String(target.jnvst_group_type ?? "").toUpperCase() === "SUB" ||
        !!target.jnvst_parent_id;
      if (!targetIsSub || !target.jnvst_parent_id)
        return json({error:"The selected target must be a JNVST sub-group."},400);

      if (!String(target.course ?? "").toUpperCase().startsWith("JNVST"))
        return json({error:"The selected group is not a JNVST group."},400);

      // Load all JNVST memberships for this student, but only through classes
      // owned by the current teacher.
      const { data: memberships, error: membershipErr } = await admin
        .from("class_students")
        .select(`student_id, class_id, classes!inner(
          id, name, course, teacher_id, jnvst_group_type, jnvst_parent_id
        )`)
        .eq("student_id", studentId)
        .eq("classes.teacher_id", caller.user.id);

      if (membershipErr) return json({error:membershipErr.message},400);
      if (!memberships?.length)
        return json({error:"This student is not in one of your classes."},403);

      const jnvstMemberships = memberships.filter((m:any) =>
        String(m.classes?.course ?? "").toUpperCase().startsWith("JNVST")
      );

      if (!jnvstMemberships.length)
        return json({error:"This student has no JNVST group membership."},400);

      const isSub = (c:any) =>
        String(c?.jnvst_group_type ?? "").toUpperCase() === "SUB" ||
        !!c?.jnvst_parent_id;

      // Determine the student's current JNVST main-group IDs.
      const currentMainIds = new Set<string>();
      for (const m of jnvstMemberships as any[]) {
        const c = m.classes;
        if (!c) continue;
        if (isSub(c) && c.jnvst_parent_id)
          currentMainIds.add(String(c.jnvst_parent_id));
        else if (!isSub(c))
          currentMainIds.add(String(c.id));
      }

      const targetMainId = String(target.jnvst_parent_id);
      if (!currentMainIds.has(targetMainId)) {
        return json({
          error:"The target sub-group does not belong to the student's current JNVST main group."
        },400);
      }

      // If already in the target, do nothing.
      const alreadyInTarget = jnvstMemberships.some((m:any) =>
        String(m.class_id) === targetClassId
      );
      if (alreadyInTarget) {
        return json({
          success:true,
          student_id:studentId,
          target_class_id:targetClassId,
          target_class_name:target.name,
          message:"Student is already in the selected JNVST sub-group."
        });
      }

      // Insert the new membership first. This prevents a failed insert from
      // leaving the student without a group.
      const { error: insertErr } = await admin
        .from("class_students")
        .insert({class_id:targetClassId, student_id:studentId});

      if (insertErr) return json({error:insertErr.message},400);

      // Remove only old JNVST SUB memberships belonging to this same main
      // group. Main-group membership, if present, is deliberately preserved.
      const oldSubIds = jnvstMemberships
        .filter((m:any) => {
          const c = m.classes;
          return isSub(c) && String(c.jnvst_parent_id) === targetMainId;
        })
        .map((m:any) => String(m.class_id))
        .filter(id => id !== targetClassId);

      if (oldSubIds.length) {
        const { error: deleteErr } = await admin
          .from("class_students")
          .delete()
          .eq("student_id", studentId)
          .in("class_id", oldSubIds);

        if (deleteErr) {
          // The new membership is already valid, so report the partial state
          // explicitly instead of pretending the operation fully succeeded.
          return json({
            success:false,
            partial:true,
            error:"The new group was added, but the previous sub-group could not be removed: " + deleteErr.message,
            student_id:studentId,
            target_class_id:targetClassId
          },500);
        }
      }

      return json({
        success:true,
        student_id:studentId,
        target_class_id:targetClassId,
        target_class_name:target.name
      });
    }

    // ------------------------------------------------------------
    // Teacher: set/change a student's Roll No
    // ------------------------------------------------------------
    if (body.action === "setStudentRollNo") {
      const studentId = String(body.student_id ?? "").trim();
      const rollNo = String(body.roll_no ?? "").trim();
      if (!studentId || !rollNo) return json({error:"Student and Roll No are required."},400);
      const { data: membership, error: me } = await admin
        .from("class_students")
        .select("student_id, classes!inner(teacher_id)")
        .eq("student_id", studentId)
        .eq("classes.teacher_id", caller.user.id)
        .limit(1);
      if (me || !membership?.length) return json({error:"This student is not in one of your classes."},403);
      const { data: duplicate } = await admin.from("profiles").select("id").eq("roll_no", rollNo).neq("id", studentId).maybeSingle();
      if (duplicate) return json({error:"This Roll No is already in use."},409);
      const { error: upErr } = await admin.from("profiles").update({roll_no:rollNo}).eq("id",studentId);
      if (upErr) return json({error:upErr.message},400);
      return json({success:true,roll_no:rollNo});
    }

    // ------------------------------------------------------------
    // Teacher: change a student's Auth password and credential record
    // ------------------------------------------------------------
    if (body.action === "setStudentPassword") {
      const studentId = String(body.student_id ?? "").trim();
      const password = String(body.password ?? "");
      if (!studentId || !password) return json({error:"Student and password are required."},400);
      if (password.length < 6) return json({error:"Password must contain at least 6 characters."},400);

      const { data: membership, error: me } = await admin
        .from("class_students")
        .select("student_id, classes!inner(teacher_id)")
        .eq("student_id", studentId)
        .eq("classes.teacher_id", caller.user.id)
        .limit(1);
      if (me || !membership?.length) return json({error:"This student is not in one of your classes."},403);

      const { data: authUser, error: ue } = await admin.auth.admin.getUserById(studentId);
      if (ue || !authUser?.user) return json({error:ue?.message || "Student Auth account not found."},404);

      const { error: updateErr } = await admin.auth.admin.updateUserById(studentId,{password});
      if (updateErr) return json({error:updateErr.message},400);

      const email = authUser.user.email || "";
      const { error: upErr } = await admin.from("student_credentials").upsert({
        student_id:studentId, email, password_plaintext:password, updated_at:new Date().toISOString()
      },{onConflict:"student_id"});
      if (upErr) return json({error:upErr.message},400);
      return json({success:true});
    }

    // ------------------------------------------------------------
    // JNVST fee management
    // Fee operations are authorized by JNVST class ownership, not by the
    // presence of a teacher profile row. This prevents the old
    // "Profile not found" failure when recording a payment.
    // ------------------------------------------------------------
    const isJnvstCourse = (course:any) =>
      ["JNVST-6", "JNVST-9"].includes(String(course ?? "").trim().toUpperCase());

    async function getJnvstStudentForTeacher(studentId:string) {
      if (!studentId) return { student:null, classRow:null, error:"Student ID is required." };
      const { data: memberships, error: me } = await admin
        .from("class_students")
        .select(`student_id, class_id, classes!inner(id, name, course, teacher_id, jnvst_group_type, jnvst_parent_id)`)
        .eq("student_id", studentId)
        .eq("classes.teacher_id", caller.user.id)
        .in("classes.course", ["JNVST-6", "JNVST-9"]);
      if (me) return { student:null, classRow:null, error:me.message };
      const row = (memberships ?? [])[0] as any;
      if (!row) return { student:null, classRow:null, error:"This student is not a JNVST student assigned to you." };

      const { data: student, error: se } = await admin
        .from("profiles")
        .select("id, full_name, roll_no, role, course")
        .eq("id", studentId)
        .maybeSingle();
      if (se) return { student:null, classRow:null, error:se.message };
      if (!student || String(student.role || "").toLowerCase() !== "student")
        return { student:null, classRow:null, error:"Student account not found." };

      return { student, classRow:row, error:null };
    }

    if (["feeSaveAccount", "feeAddPayment", "feeBulkImport"].includes(String(body.action || ""))) {
      if (body.action === "feeSaveAccount") {
        const studentId = String(body.student_id ?? "").trim();
        const check = await getJnvstStudentForTeacher(studentId);
        if (check.error) return json({error:check.error},403);

        const total = Number(body.total_course_fee ?? 0);
        const discount = Number(body.discount_amount ?? 0);
        if (!Number.isFinite(total) || total < 0 || !Number.isFinite(discount) || discount < 0 || discount > total)
          return json({error:"Invalid course fee or discount."},400);

        const { data: existing, error: ee } = await admin
          .from("student_fee_accounts")
          .select("id, teacher_id")
          .eq("student_id", studentId)
          .maybeSingle();
        if (ee) return json({error:ee.message},400);
        if (existing && String(existing.teacher_id) !== String(caller.user.id))
          return json({error:"This student's fee account belongs to another teacher."},403);

        const payload = {
          student_id:studentId,
          teacher_id:caller.user.id,
          group_id:check.classRow?.class_id || null,
          total_course_fee:total,
          discount_amount:discount,
          course_name:String(body.course_name ?? "").trim() || null,
          message:String(body.message ?? "").trim() || null,
          message_enabled:Boolean(body.message_enabled)
        };
        const { data: account, error: ae } = await admin
          .from("student_fee_accounts")
          .upsert(payload,{onConflict:"student_id"})
          .select("*")
          .single();
        if (ae) return json({error:ae.message},400);
        return json({success:true,account});
      }

      if (body.action === "feeAddPayment") {
        const studentId = String(body.student_id ?? "").trim();
        const check = await getJnvstStudentForTeacher(studentId);
        if (check.error) return json({error:check.error},403);

        const amount = Number(body.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) return json({error:"Amount must be greater than 0."},400);
        const paymentDate = String(body.payment_date ?? "").trim() || new Date().toISOString().slice(0,10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return json({error:"Invalid payment date."},400);

        let { data: account, error: ae } = await admin
          .from("student_fee_accounts")
          .select("*")
          .eq("student_id",studentId)
          .eq("teacher_id",caller.user.id)
          .maybeSingle();
        if (ae) return json({error:ae.message},400);
        if (!account) {
          const { data: created, error: ce } = await admin
            .from("student_fee_accounts")
            .insert({
              student_id:studentId,
              teacher_id:caller.user.id,
              group_id:check.classRow?.class_id || null,
              total_course_fee:0,
              discount_amount:0,
              course_name:`${check.classRow?.classes?.name || "JNVST"}`
            })
            .select("*").single();
          if (ce) return json({error:ce.message},400);
          account = created;
        }

        const paymentMode = String(body.payment_mode ?? "").trim() || null;
        const referenceNo = String(body.reference_no ?? "").trim() || null;
        const remarks = String(body.remarks ?? "").trim() || null;

        if (!Boolean(body.allow_duplicate)) {
          let q = admin.from("student_fee_payments")
            .select("id")
            .eq("fee_account_id",account.id)
            .eq("student_id",studentId)
            .eq("payment_date",paymentDate)
            .eq("amount",amount);
          if (referenceNo) q = q.eq("reference_no",referenceNo);
          const { data: dup, error: de } = await q.limit(1);
          if (de) return json({error:de.message},400);
          if ((dup ?? []).length) return json({error:"A payment with the same date and amount already exists for this student."},409);
        }

        const { data: payment, error: pe } = await admin
          .from("student_fee_payments")
          .insert({
            fee_account_id:account.id,
            student_id:studentId,
            amount,
            payment_date:paymentDate,
            payment_mode:paymentMode,
            reference_no:referenceNo,
            remarks,
            created_by:caller.user.id
          })
          .select("*").single();
        if (pe) return json({error:pe.message},400);
        return json({success:true,payment});
      }

      // Bulk fee import uses the same JNVST ownership checks as the manual
      // fee actions. Validation-only requests never write to the database.
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const mode = String(body.mode || "payments").toLowerCase();
      if (!rows.length) return json({error:"No fee rows supplied."},400);
      if (!["payments","setup"].includes(mode)) return json({error:"Invalid fee import mode."},400);

      const results:any[] = [];
      for (const row of rows) {
        const studentId = String(row.student_id || "").trim();
        let check:any = null;
        if (!studentId && row.roll_no) {
          const { data:p } = await admin.from("profiles").select("id").eq("roll_no",String(row.roll_no).trim()).eq("role","student").maybeSingle();
          if (p?.id) { check = await getJnvstStudentForTeacher(String(p.id)); }
        } else if (studentId) {
          check = await getJnvstStudentForTeacher(studentId);
        }
        if (!check || check.error) {
          results.push({row:row.__row||row.row||0,roll_no:String(row.roll_no||""),status:"error",error:check?.error||"JNVST student not found."});
          continue;
        }
        if (mode === "payments") {
          const amount = Number(row.amount_paid ?? row.amount ?? 0);
          const paymentDate = String(row.payment_date || new Date().toISOString().slice(0,10));
          if (!Number.isFinite(amount) || amount <= 0) { results.push({row:row.__row||0,roll_no:String(row.roll_no||""),status:"error",error:"Invalid amount."}); continue; }
          let { data:account, error:ae } = await admin.from("student_fee_accounts").select("*").eq("student_id",check.student.id).eq("teacher_id",caller.user.id).maybeSingle();
          if (ae) { results.push({row:row.__row||0,roll_no:String(row.roll_no||""),status:"error",error:ae.message}); continue; }
          if (!account) {
            const { data:created,error:ce } = await admin.from("student_fee_accounts").insert({student_id:check.student.id,teacher_id:caller.user.id,group_id:check.classRow?.class_id||null,total_course_fee:0,discount_amount:0,course_name:"JNVST"}).select("*").single();
            if (ce) { results.push({row:row.__row||0,roll_no:String(row.roll_no||""),status:"error",error:ce.message}); continue; }
            account=created;
          }
          const { data:dup } = await admin.from("student_fee_payments").select("id").eq("fee_account_id",account.id).eq("student_id",check.student.id).eq("payment_date",paymentDate).eq("amount",amount).limit(1);
          if ((dup||[]).length) { results.push({row:row.__row||0,roll_no:String(row.roll_no||""),status:"duplicate",error:"Duplicate payment."}); continue; }
          if (body.validate_only) { results.push({row:row.__row||0,roll_no:String(row.roll_no||""),status:"valid"}); continue; }
          const {error:pe}=await admin.from("student_fee_payments").insert({fee_account_id:account.id,student_id:check.student.id,amount,payment_date:paymentDate,payment_mode:String(row.payment_mode||"").trim()||null,reference_no:String(row.reference_no||"").trim()||null,remarks:String(row.remarks||"").trim()||null,import_batch_id:String(body.batch_id||"").trim()||null,source_row_number:Number(row.__row||0)||null,created_by:caller.user.id});
          results.push(pe?{row:row.__row||0,roll_no:String(row.roll_no||""),status:"error",error:pe.message}:{row:row.__row||0,roll_no:String(row.roll_no||""),status:"valid"});
        } else {
          const total=Number(row.total_course_fee||0), discount=Number(row.discount_amount||0);
          if (!Number.isFinite(total)||total<0||!Number.isFinite(discount)||discount<0||discount>total) { results.push({row:row.__row||0,roll_no:String(row.roll_no||""),status:"error",error:"Invalid fee or discount."}); continue; }
          if (body.validate_only) { results.push({row:row.__row||0,roll_no:String(row.roll_no||""),status:"valid"}); continue; }
          const {error:ae}=await admin.from("student_fee_accounts").upsert({student_id:check.student.id,teacher_id:caller.user.id,group_id:check.classRow?.class_id||null,total_course_fee:total,discount_amount:discount,course_name:String(row.course_name||"").trim()||null,message:String(row.message||"").trim()||null,message_enabled:Boolean(row.message_enabled)},{onConflict:"student_id"});
          results.push(ae?{row:row.__row||0,roll_no:String(row.roll_no||""),status:"error",error:ae.message}:{row:row.__row||0,roll_no:String(row.roll_no||""),status:"valid"});
        }
      }
      const imported=results.filter(r=>r.status==="valid").length;
      return json({success:true,results,imported,batch_id:String(body.batch_id||"")});
    }

    // ------------------------------------------------------------
    // Existing bulk/single student creation flow
    // ------------------------------------------------------------
    const items = Array.isArray(body.students) ? body.students : [body];
    if (!items.length) return json({error:"No students supplied."},400);

    const results = [];
    for (const item of items) {
      const name = String(item.name ?? "").trim();
      const rollNo = String(item.roll_no ?? item.rollNo ?? "").trim();
      const email = String(item.email ?? "").trim().toLowerCase();
      const password = String(item.password ?? "");
      const classId = String(item.class_id ?? "").trim();

      if (!name || !rollNo || !email || !password || !classId) {
        results.push({success:false,name,email,roll_no:rollNo,error:"Name, roll no, email, password and class are required."});
        continue;
      }
      if (password.length < 6) {
        results.push({success:false,name,email,error:"Password must contain at least 6 characters."});
        continue;
      }

      const { data: cls, error: classErr } = await admin.from("classes")
        .select("id, teacher_id").eq("id", classId).single();
      if (classErr || !cls || cls.teacher_id !== caller.user.id) {
        results.push({success:false,name,email,error:"Invalid class for this teacher."});
        continue;
      }

      const { data: duplicateRoll } = await admin.from("profiles").select("id").eq("roll_no", rollNo).maybeSingle();
      if (duplicateRoll) {
        results.push({success:false,name,email,roll_no:rollNo,error:"This Roll No is already in use."});
        continue;
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm:true,
        user_metadata:{full_name:name, role:"student"}
      });
      if (createErr || !created.user) {
        results.push({success:false,name,email,error:createErr?.message ?? "Could not create user."});
        continue;
      }

      const studentId = created.user.id;
      const { error: profileErr } = await admin.from("profiles").insert({
        id:studentId, full_name:name, username:email, roll_no:rollNo, role:"student"
      });
      if (profileErr) {
        await admin.auth.admin.deleteUser(studentId);
        results.push({success:false,name,email,error:profileErr.message});
        continue;
      }

      const { error: memberErr } = await admin.from("class_students").insert({
        class_id:classId, student_id:studentId
      });
      if (memberErr) {
        await admin.from("profiles").delete().eq("id",studentId);
        await admin.auth.admin.deleteUser(studentId);
        results.push({success:false,name,email,error:memberErr.message});
        continue;
      }

      const { error: credErr } = await admin.from("student_credentials").upsert({
        student_id:studentId, email, password_plaintext:password, updated_at:new Date().toISOString()
      },{onConflict:"student_id"});
      if (credErr) {
        await admin.from("class_students").delete().eq("class_id",classId).eq("student_id",studentId);
        await admin.from("profiles").delete().eq("id",studentId);
        await admin.auth.admin.deleteUser(studentId);
        results.push({success:false,name,email,error:credErr.message});
        continue;
      }

      results.push({success:true,name,email,roll_no:rollNo,class_id:classId});
    }

    return json({success:true, results});
  } catch (e) {
    return json({error:e instanceof Error ? e.message : String(e)},500);
  }
});

function json(data: unknown, status=200) {
  return new Response(JSON.stringify(data), {
    status, headers:{...corsHeaders,"Content-Type":"application/json"}
  });
}
