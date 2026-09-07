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
      const { data: memberships, error: me } = await admin
        .from("class_students")
        .select("student_id, classes!inner(id, name, teacher_id)")
        .eq("classes.teacher_id", caller.user.id);
      if (me) return json({error:me.message},400);

      const map = new Map<string, {classes:string[], class_details:{id:string,name:string}[]}>();
      for (const row of memberships ?? []) {
        const sid = row.student_id as string;
        const cls = row.classes as any;
        if (!map.has(sid)) map.set(sid,{classes:[],class_details:[]});
        const entry = map.get(sid)!;
        if (cls?.name && !entry.classes.includes(cls.name)) entry.classes.push(cls.name);
        if (cls?.id && cls?.name && !entry.class_details.some(x=>x.id===cls.id)) {
          entry.class_details.push({id:cls.id,name:cls.name});
        }
      }
      const ids = [...map.keys()];
      if (!ids.length) return json({success:true,students:[]});

      const { data: profiles, error: pe } = await admin
        .from("profiles").select("id, full_name, username, roll_no").in("id", ids).order("full_name");
      if (pe) return json({error:pe.message},400);
      const { data: creds, error: ce } = await admin
        .from("student_credentials").select("student_id, email, password_plaintext, updated_at").in("student_id", ids);
      if (ce) return json({error:ce.message},400);
      const cm = new Map((creds??[]).map(c=>[c.student_id,c]));
      return json({success:true,students:(profiles??[]).map(p=>({
        id:p.id, full_name:p.full_name, username:p.username, roll_no:p.roll_no || "",
        email:cm.get(p.id)?.email || p.username || "",
        password:cm.get(p.id)?.password_plaintext || "",
        updated_at:cm.get(p.id)?.updated_at || null,
        classes:map.get(p.id)?.classes || [],
        class_details:map.get(p.id)?.class_details || []
      }))});
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
    // Teacher: change a student's class
    // ------------------------------------------------------------
    if (body.action === "setStudentClass") {
      const studentId = String(body.student_id ?? "").trim();
      const newClassId = String(body.class_id ?? "").trim();
      if (!studentId || !newClassId)
        return json({error:"Student and new class are required."},400);

      const { data: currentMemberships, error: currentErr } = await admin
        .from("class_students")
        .select("class_id, classes!inner(id, teacher_id)")
        .eq("student_id", studentId)
        .eq("classes.teacher_id", caller.user.id);

      if (currentErr) return json({error:currentErr.message},400);
      if (!currentMemberships?.length)
        return json({error:"This student is not in one of your classes."},403);

      const { data: destination, error: destinationErr } = await admin
        .from("classes")
        .select("id, name, teacher_id")
        .eq("id", newClassId)
        .single();

      if (destinationErr || !destination)
        return json({error:"Destination class was not found."},404);

      if (destination.teacher_id !== caller.user.id)
        return json({error:"You can only move a student to one of your own classes."},403);

      if (currentMemberships.some((m:any) => m.class_id === newClassId)) {
        return json({
          success:true,
          class_id:newClassId,
          class_name:destination.name,
          message:"Student is already in this class."
        });
      }

      const teacherClassIds = currentMemberships.map((m:any) => m.class_id);

      const { error: deleteErr } = await admin
        .from("class_students")
        .delete()
        .eq("student_id", studentId)
        .in("class_id", teacherClassIds);

      if (deleteErr) return json({error:deleteErr.message},400);

      const { error: insertErr } = await admin
        .from("class_students")
        .insert({class_id:newClassId, student_id:studentId});

      if (insertErr) {
        await admin.from("class_students").insert(
          teacherClassIds.map((class_id:string)=>({class_id,student_id:studentId}))
        );
        return json({error:insertErr.message},400);
      }

      return json({
        success:true,
        class_id:newClassId,
        class_name:destination.name
      });
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
