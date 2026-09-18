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

    const { data: teacher, error: teacherErr } = await admin.from("profiles")
      .select("id, role").eq("id", caller.user.id).single();
    if (teacherErr || teacher?.role !== "teacher")
      return json({error:"Only teachers can use this function."},403);

    // ------------------------------------------------------------
    // Teacher: list student credentials for students in own classes
    // ------------------------------------------------------------
    if (body.action === "listCredentials") {
      // Load the teacher's JNVST class tree first. This lets the dashboard
      // display Main Group -> Sub-group and gives the teacher safe target IDs
      // for moving students.
      const { data: classes, error: classErr } = await admin
        .from("classes")
        .select("id,name,course,description,jnvst_group_type,jnvst_parent_id,teacher_id")
        .eq("teacher_id", caller.user.id);
      if (classErr) return json({error:classErr.message},400);

      const classRows = classes ?? [];
      const classMap = new Map<string, any>(classRows.map((c:any)=>[c.id,c]));
      const isSub = (c:any) =>
        String(c?.jnvst_group_type||"").toUpperCase()==="SUB" ||
        /^JNVST_SUBGROUP_PARENT(?::|_ID:)/i.test(String(c?.description||""));

      const isJnvst = (c:any) =>
        String(c?.course||"").toUpperCase()!=="SCHOOL" &&
        (String(c?.course||"").toUpperCase().startsWith("JNVST") || isSub(c) ||
         String(c?.jnvst_group_type||"").toUpperCase()==="MAIN");

      const mainFor = (c:any) => {
        if (!c) return null;
        if (c.jnvst_parent_id && classMap.get(c.jnvst_parent_id))
          return classMap.get(c.jnvst_parent_id);
        const desc = String(c.description||"");
        const m = desc.match(/^JNVST_SUBGROUP_PARENT:(JNVST-VI|JNVST-IX)/i);
        if (m) {
          const key = m[1].toUpperCase();
          return classRows.find((x:any) =>
            String(x.jnvst_group_type||"").toUpperCase()==="MAIN" &&
            (
              key==="JNVST-VI"
                ? String(x.course||"").toUpperCase()==="JNVST-6"
                : String(x.course||"").toUpperCase()==="JNVST-9"
            )
          ) || null;
        }
        return c;
      };

      const membershipsByStudent = new Map<string, any[]>();
      const jnvstClassIds = classRows.filter(isJnvst).map((c:any)=>c.id);
      if (jnvstClassIds.length) {
        const { data: memberships, error: me } = await admin
          .from("class_students")
          .select("student_id,class_id")
          .in("class_id",jnvstClassIds);
        if (me) return json({error:me.message},400);

        for (const row of memberships ?? []) {
          const c = classMap.get(row.class_id);
          if (!c) continue;
          const parent = mainFor(c);
          const item = {
            class_id:c.id,
            class_name:c.name || "",
            main_group_id:parent?.id || "",
            main_group_name:parent?.name || c.name || "",
            is_subgroup:isSub(c)
          };
          if (!membershipsByStudent.has(row.student_id)) membershipsByStudent.set(row.student_id,[]);
          membershipsByStudent.get(row.student_id)!.push(item);
        }
      }

      const ids = [...membershipsByStudent.keys()];
      if (!ids.length) return json({success:true,students:[]});

      const { data: profiles, error: pe } = await admin
        .from("profiles").select("id, full_name, username, roll_no").in("id", ids).order("full_name");
      if (pe) return json({error:pe.message},400);

      const { data: creds, error: ce } = await admin
        .from("student_credentials").select("student_id, email, password_plaintext, updated_at").in("student_id", ids);
      if (ce) return json({error:ce.message},400);

      const cm = new Map((creds??[]).map((c:any)=>[c.student_id,c]));
      return json({
        success:true,
        students:(profiles??[]).map((p:any)=>({
          id:p.id, full_name:p.full_name, username:p.username, roll_no:p.roll_no || "",
          email:cm.get(p.id)?.email || p.username || "",
          password:cm.get(p.id)?.password_plaintext || "",
          updated_at:cm.get(p.id)?.updated_at || null,
          memberships:membershipsByStudent.get(p.id) || [],
          available_subgroups:[...(new Set(
            (membershipsByStudent.get(p.id) || []).flatMap((m:any) =>
              classRows
                .filter((c:any) => isSub(c) && c.jnvst_parent_id === m.main_group_id)
                .map((c:any) => JSON.stringify({
                  class_id:c.id,
                  class_name:c.name || "",
                  main_group_id:m.main_group_id,
                  main_group_name:m.main_group_name || "",
                  is_subgroup:true
                }))
            )
          ))].map((x:string)=>JSON.parse(x))
        }))
      });
    }

    // ------------------------------------------------------------
    // Teacher: move a JNVST student between sub-groups belonging to
    // the same main group.
    // ------------------------------------------------------------
    if (body.action === "setStudentJnvstSubgroup") {
      const studentId = String(body.student_id ?? "").trim();
      const sourceClassId = String(body.source_class_id ?? "").trim();
      const targetClassId = String(body.target_class_id ?? "").trim();
      if (!studentId || !targetClassId)
        return json({error:"Student and target sub-group are required."},400);

      const { data: groups, error: ge } = await admin
        .from("classes")
        .select("id,name,course,description,jnvst_group_type,jnvst_parent_id,teacher_id")
        .eq("teacher_id", caller.user.id)
        .in("id", [...new Set([sourceClassId,targetClassId].filter(Boolean))]);
      if (ge) return json({error:ge.message},400);

      const byId = new Map<string,any>((groups??[]).map((g:any)=>[g.id,g]));
      const source = sourceClassId ? byId.get(sourceClassId) : null;
      const target = byId.get(targetClassId);
      if (!target) return json({error:"Target sub-group is not available to this teacher."},403);

      const isSub = (g:any) =>
        String(g?.jnvst_group_type||"").toUpperCase()==="SUB" ||
        /^JNVST_SUBGROUP_PARENT(?::|_ID:)/i.test(String(g?.description||""));
      if (!isSub(target) || (source && !isSub(source)))
        return json({error:"Students can only be moved between JNVST sub-groups."},400);

      const sourceParent = source?.jnvst_parent_id || "";
      const targetParent = target?.jnvst_parent_id || "";
      if (!sourceParent || !targetParent || sourceParent !== targetParent)
        return json({error:"The source and target sub-groups must belong to the same main group."},400);

      // Confirm the student is actually in the source subgroup. If the UI
      // omitted the source, locate the student's JNVST subgroup automatically.
      let actualSourceId = sourceClassId;
      if (!actualSourceId) {
        const { data: currentMemberships, error: cme } = await admin
          .from("class_students")
          .select("class_id, classes!inner(id,teacher_id,jnvst_group_type,jnvst_parent_id,description)")
          .eq("student_id",studentId)
          .eq("classes.teacher_id",caller.user.id);
        if (cme) return json({error:cme.message},400);
        const found=(currentMemberships??[]).find((x:any)=>isSub(x.classes) && x.classes.jnvst_parent_id===targetParent);
        actualSourceId=found?.class_id||"";
      }

      if (actualSourceId && actualSourceId !== targetClassId) {
        const { data: currentSource, error: sme } = await admin
          .from("class_students").select("student_id,class_id")
          .eq("student_id",studentId).eq("class_id",actualSourceId).maybeSingle();
        if (sme) return json({error:sme.message},400);
        if (!currentSource) return json({error:"The student is not currently in the selected source sub-group."},400);
      }

      // Make sure the student is not being added to a teacher-owned class
      // from outside the teacher's JNVST tree.
      const { data: existingTarget, error: ete } = await admin
        .from("class_students").select("student_id,class_id")
        .eq("student_id",studentId).eq("class_id",targetClassId).maybeSingle();
      if (ete) return json({error:ete.message},400);

      if (!existingTarget) {
        const { error: ie } = await admin.from("class_students").insert({
          student_id:studentId,class_id:targetClassId
        });
        if (ie) return json({error:ie.message},400);
      }

      if (actualSourceId && actualSourceId !== targetClassId) {
        const { error: de } = await admin.from("class_students")
          .delete().eq("student_id",studentId).eq("class_id",actualSourceId);
        if (de) return json({error:de.message},400);
      }

      return json({success:true,student_id:studentId,target_class_id:targetClassId});
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
