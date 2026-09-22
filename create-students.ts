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

      const map = new Map<string, {classes:string[]}>();
      for (const row of memberships ?? []) {
        const sid = row.student_id as string;
        const cls = row.classes as any;
        if (!map.has(sid)) map.set(sid,{classes:[]});
        if (cls?.name && !map.get(sid)!.classes.includes(cls.name)) map.get(sid)!.classes.push(cls.name);
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
        classes:map.get(p.id)?.classes || []
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
    // Student fee / subscription management
    // ------------------------------------------------------------
    async function teacherOwnsStudent(studentId: string) {
      const { data, error } = await admin.from("class_students")
        .select("student_id, classes!inner(id, name, course, teacher_id)")
        .eq("student_id", studentId)
        .eq("classes.teacher_id", caller.user.id)
        .limit(1);
      if (error) throw new Error(error.message);
      return Boolean(data?.length);
    }

    if (body.action === "feeList") {
      const { data: memberships, error: me } = await admin.from("class_students")
        .select("student_id, class_id, classes!inner(id, name, course, teacher_id)")
        .eq("classes.teacher_id", caller.user.id);
      if (me) return json({error:me.message},400);
      const studentIds=[...new Set((memberships??[]).map((x:any)=>x.student_id).filter(Boolean))];
      if (!studentIds.length) return json({success:true,students:[],accounts:[],payments:[]});

      const [{data:students,error:pe},{data:accounts,error:ae}]=await Promise.all([
        admin.from("profiles").select("id,full_name,roll_no,course").in("id",studentIds).order("full_name"),
        admin.from("student_fee_accounts").select("*").eq("teacher_id",caller.user.id).in("student_id",studentIds)
      ]);
      if(pe) return json({error:pe.message},400);
      if(ae) return json({error:ae.message},400);
      const accountIds=(accounts??[]).map((a:any)=>a.id).filter(Boolean);
      let payments:any[]=[];
      if(accountIds.length){
        const {data:pay,error:payErr}=await admin.from("student_fee_payments").select("*").in("fee_account_id",accountIds).order("payment_date",{ascending:false});
        if(payErr) return json({error:payErr.message},400);
        payments=pay??[];
      }
      return json({success:true,students:students??[],accounts:accounts??[],payments});
    }

    if (body.action === "feeSaveAccount") {
      const studentId=String(body.student_id??"").trim();
      if(!studentId) return json({error:"Student is required."},400);
      if(!(await teacherOwnsStudent(studentId))) return json({error:"This student is not in one of your classes."},403);
      const total=Math.max(0,Number(body.total_course_fee??0));
      const discount=Math.max(0,Number(body.discount_amount??0));
      if(!Number.isFinite(total)||!Number.isFinite(discount)) return json({error:"Course fee and discount must be valid numbers."},400);
      if(discount>total) return json({error:"Discount cannot be greater than the course fee."},400);
      const groupId=String(body.group_id??"").trim()||null;
      if(groupId){
        const {data:c}=await admin.from("classes").select("id,teacher_id").eq("id",groupId).maybeSingle();
        if(!c||c.teacher_id!==caller.user.id) return json({error:"Invalid group."},400);
      }
      const payload={
        student_id:studentId, teacher_id:caller.user.id, group_id:groupId,
        course_name:String(body.course_name??"").trim()||null,
        total_course_fee:total, discount_amount:discount,
        message:String(body.message??"").trim()||null,
        message_enabled:Boolean(body.message_enabled)
      };
      const {data,error}=await admin.from("student_fee_accounts").upsert(payload,{onConflict:"student_id"}).select("*").single();
      if(error) return json({error:error.message},400);
      return json({success:true,account:data});
    }

    if (body.action === "feeAddPayment") {
      const studentId=String(body.student_id??"").trim();
      if(!studentId) return json({error:"Student is required."},400);
      if(!(await teacherOwnsStudent(studentId))) return json({error:"This student is not in one of your classes."},403);
      const amount=Number(body.amount??0);
      if(!Number.isFinite(amount)||amount<=0) return json({error:"Payment amount must be greater than 0."},400);
      let account:any;
      const {data:existing,error:ae}=await admin.from("student_fee_accounts").select("*").eq("student_id",studentId).maybeSingle();
      if(ae) return json({error:ae.message},400);
      if(existing) account=existing;
      else {
        const {data:created,error:ce}=await admin.from("student_fee_accounts").insert({student_id:studentId,teacher_id:caller.user.id,total_course_fee:0,discount_amount:0}).select("*").single();
        if(ce) return json({error:ce.message},400);
        account=created;
      }
      const paymentDate=String(body.payment_date||new Date().toISOString().slice(0,10));
      const paymentRef=String(body.reference_no??"").trim();
      const dupQuery=admin.from("student_fee_payments").select("id").eq("fee_account_id",account.id).eq("payment_date",paymentDate).eq("amount",amount);
      if(paymentRef) dupQuery.eq("reference_no",paymentRef); else dupQuery.is("reference_no",null);
      const {data:dup}=await dupQuery.limit(1);
      if(dup?.length && !body.allow_duplicate) return json({error:"A payment with the same date, amount and reference number already exists. Use the duplicate override only if this is intentional.",duplicate:true},409);
      const {data:payment,error}=await admin.from("student_fee_payments").insert({
        fee_account_id:account.id,student_id:studentId,amount,
        payment_date:paymentDate,
        payment_mode:String(body.payment_mode??"").trim()||null,
        reference_no:paymentRef||null,
        remarks:String(body.remarks??"").trim()||null,
        import_batch_id:String(body.import_batch_id??"").trim()||null,
        source_row_number:Number.isFinite(Number(body.source_row_number))?Number(body.source_row_number):null,
        created_by:caller.user.id
      }).select("*").single();
      if(error) return json({error:error.message},400);
      return json({success:true,payment});
    }

    if (body.action === "feeBulkImport") {
      const mode=String(body.mode||"").toLowerCase();
      const validateOnly=Boolean(body.validate_only);
      const rows=Array.isArray(body.rows)?body.rows:[];
      if(!["payments","setup"].includes(mode)) return json({error:"Invalid bulk fee import mode."},400);
      if(!rows.length) return json({error:"No Excel rows supplied."},400);
      if(rows.length>1000) return json({error:"Maximum 1000 rows per upload."},400);

      const {data:memberships,error:me}=await admin.from("class_students")
        .select("student_id, class_id, classes!inner(id,name,course,teacher_id)")
        .eq("classes.teacher_id",caller.user.id);
      if(me) return json({error:me.message},400);
      const ownIds=new Set((memberships??[]).map((x:any)=>x.student_id));
      const {data:profiles,error:pe}=await admin.from("profiles").select("id,full_name,roll_no").in("id",[...ownIds]);
      if(pe) return json({error:pe.message},400);
      const byRoll=new Map((profiles??[]).map((x:any)=>[String(x.roll_no||"").trim().toLowerCase(),x]));
      const {data:accounts,error:ae}=await admin.from("student_fee_accounts").select("*").eq("teacher_id",caller.user.id).in("student_id",[...ownIds]);
      if(ae) return json({error:ae.message},400);
      const accountByStudent=new Map((accounts??[]).map((x:any)=>[x.student_id,x]));
      const batch=`FEE-${new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,14)}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
      const results:any[]=[];
      const validPayments:any[]=[];

      for(let i=0;i<rows.length;i++){
        const r=rows[i]||{}; const rowNo=Number(r.__row||i+2);
        const roll=String(r.roll_no??r["Roll No"]??r.Roll??r.roll??"").trim();
        const st=byRoll.get(roll.toLowerCase());
        if(!roll){results.push({row:rowNo,status:"error",error:"Roll No is required."});continue;}
        if(!st){results.push({row:rowNo,roll_no:roll,status:"error",error:"Student not found in your classes."});continue;}
        if(mode==="setup"){
          const total=Number(r.total_course_fee??r["Total Course Fee"]??r["Course Fee"]??0);
          const discount=Number(r.discount_amount??r["Discount"]??r["Discount Amount"]??0);
          if(!Number.isFinite(total)||total<0){results.push({row:rowNo,roll_no:roll,status:"error",error:"Invalid Total Course Fee."});continue;}
          if(!Number.isFinite(discount)||discount<0||discount>total){results.push({row:rowNo,roll_no:roll,status:"error",error:"Invalid Discount."});continue;}
          const cls=(memberships??[]).find((m:any)=>m.student_id===st.id);
          const payload={student_id:st.id,teacher_id:caller.user.id,group_id:cls?.class_id||null,course_name:String(r.course_name??r["Course Name"]??"").trim()||null,total_course_fee:total,discount_amount:discount,message:String(r.message??r.Message??"").trim()||null,message_enabled:String(r.message_enabled??r["Show Message"]??"").toLowerCase()==="true"};
          if(validateOnly){
            results.push({row:rowNo,roll_no:roll,status:"valid",action:"fee account ready",preview:payload});
          }else{
            const {data:a,error}=await admin.from("student_fee_accounts").upsert(payload,{onConflict:"student_id"}).select("*").single();
            if(error) results.push({row:rowNo,roll_no:roll,status:"error",error:error.message});
            else {accountByStudent.set(st.id,a);results.push({row:rowNo,roll_no:roll,status:"valid",action:"fee account saved"});}
          }
        } else {
          const amount=Number(r.amount_paid??r["Amount Paid"]??r.amount??0);
          const dateRaw=r.payment_date??r["Payment Date"]??r.date??"";
          if(!Number.isFinite(amount)||amount<=0){results.push({row:rowNo,roll_no:roll,status:"error",error:"Amount Paid must be greater than 0."});continue;}
          let date="";
          if(typeof dateRaw==="number"){
            const d=new Date(Date.UTC(1899,11,30)+dateRaw*86400000);date=d.toISOString().slice(0,10);
          } else { date=String(dateRaw).trim().slice(0,10); }
          if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){results.push({row:rowNo,roll_no:roll,status:"error",error:"Payment Date must be YYYY-MM-DD or a valid Excel date."});continue;}
          let account=accountByStudent.get(st.id);
          if(!account && !validateOnly){
            const cls=(memberships??[]).find((m:any)=>m.student_id===st.id);
            const {data:a,error:ae2}=await admin.from("student_fee_accounts").insert({student_id:st.id,teacher_id:caller.user.id,group_id:cls?.class_id||null,total_course_fee:0,discount_amount:0}).select("*").single();
            if(ae2){results.push({row:rowNo,roll_no:roll,status:"error",error:ae2.message});continue;}
            account=a;accountByStudent.set(st.id,a);
          }
          if(!account && validateOnly) account={id:null,student_id:st.id};
          const reference=String(r.reference_no??r["Reference No"]??r["Reference Number"]??"").trim();
          let dup:any[]=[];
          if(account.id){
            const q=admin.from("student_fee_payments").select("id").eq("fee_account_id",account.id).eq("payment_date",date).eq("amount",amount);
            if(reference) q.eq("reference_no",reference); else q.is("reference_no",null);
            const {data:d}=await q.limit(1); dup=d||[];
          }
          if(dup.length){results.push({row:rowNo,roll_no:roll,status:"duplicate",error:"Possible duplicate payment."});continue;}
          validPayments.push({fee_account_id:account.id,student_id:st.id,amount,payment_date:date,payment_mode:String(r.payment_mode??r["Payment Mode"]??"").trim()||null,reference_no:reference||null,remarks:String(r.remarks??r.Remarks??"").trim()||null,import_batch_id:batch,source_row_number:rowNo,created_by:caller.user.id});
          results.push({row:rowNo,roll_no:roll,status:"valid",action:"payment queued"});
        }
      }
      if(mode==="payments" && validPayments.length && !validateOnly){
        for(const row of validPayments){
          if(!row.fee_account_id){
            const cls=(memberships??[]).find((m:any)=>m.student_id===row.student_id);
            const {data:a,error:ae3}=await admin.from("student_fee_accounts").insert({student_id:row.student_id,teacher_id:caller.user.id,group_id:cls?.class_id||null,total_course_fee:0,discount_amount:0}).select("*").single();
            if(ae3) return json({error:ae3.message,batch_id:batch,results},400);
            row.fee_account_id=a.id;
          }
        }
        const {error}=await admin.from("student_fee_payments").insert(validPayments);
        if(error) return json({error:error.message,batch_id:batch,results},400);
      }
      return json({success:true,validated:validateOnly,batch_id:batch,results,imported:validateOnly?0:(mode==="payments"?validPayments.length:results.filter(x=>x.status==="valid").length)});
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
