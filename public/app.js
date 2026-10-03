const $=s=>document.querySelector(s); const api=async(u,o={})=>{const r=await fetch(u,{...o,headers:{"Content-Type":"application/json",...(o.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d};
let me=null;
async function boot(){try{me=await api("/api/auth/me");showApp();load("dashboard")}catch{showLogin()}}
function showLogin(){$("#login").classList.remove("hidden");$("#app").classList.add("hidden");$("#logout").classList.add("hidden")}
function showApp(){$("#login").classList.add("hidden");$("#app").classList.remove("hidden");$("#logout").classList.remove("hidden");document.querySelectorAll(".adminOnly").forEach(x=>x.style.display=me.role==="ADMIN"?"":"none")}
$("#loginForm").onsubmit=async(e)=>{
  e.preventDefault();

  try{
    const result=await api("/api/auth/login",{
      method:"POST",
      body:JSON.stringify({
        email:$("#email").value,
        password:$("#password").value,
        role:$("#role").value
      })
    });

    me=result.user;
    showApp();
    load("dashboard");

  }catch(x){
    $("#loginMsg").textContent=x.message;
  }
};
  e.preventDefault();

  try{
    const d=await api("/api/auth/register",{
      method:"POST",
      body:JSON.stringify({
        name:$("#suName").value,
        email:$("#suEmail").value,
        password:$("#suPassword").value
      })
    });

    if(d.requiresOtp){
      $("#otpEmail").value=d.email;
      $("#signupOtp").classList.remove("hidden");
      $("#signupForm").classList.add("hidden");
      $("#otpCode").focus();
    }

  }catch(x){
    alert(x.message);
  }
};
$("#signupOtp").onsubmit=async e=>{
  e.preventDefault();

  try{
    const d=await api("/api/auth/verify-register",{
      method:"POST",
      body:JSON.stringify({
        email:$("#otpEmail").value,
        otp:$("#otpCode").value.trim()
      })
    });

    me=d.user;
    $("#signupOtp").reset();
    $("#signupOtp").classList.add("hidden");
    $("#signupForm").classList.remove("hidden");
    showApp();
    load("dashboard");

  }catch(x){
    $("#otpMsg").textContent=x.message;
  }
};
$("#logout").onclick=async()=>{await api("/api/auth/logout",{method:"POST"});showLogin()};
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>load(b.dataset.page));
async function load(page){document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.page===page)); const p=$("#page"); p.innerHTML='<div class="card panel">Loading…</div>'; try{
if(page==="dashboard")return dashboard(p); if(page==="exams")return exams(p); if(page==="results")return results(p); if(page==="attendance")return attendance(p); if(page==="timetable")return timetable(p); if(page==="announcements")return announcements(p); if(page==="feedback")return feedback(p); if(page==="admins")return admins(p);
}catch(e){p.innerHTML=`<div class="card panel">${e.message}</div>`}}
async function dashboard(p){const [ex,res,an]=await Promise.all([api("/api/exams"),api("/api/results"),api("/api/announcements")]);p.innerHTML=`<div class="grid"><div class="stat"><span>Available/created exams</span><br><b>${ex.length}</b></div><div class="stat"><span>${me.role==="ADMIN"?"Submissions":"My submissions"}</span><br><b>${res.length}</b></div><div class="stat"><span>Announcements</span><br><b>${an.length}</b></div></div><div class="card panel" style="margin-top:15px"><h2>Welcome, ${me.name}</h2><p class="muted">Veloces control center for online tests, coding assessments and campus management.</p></div>`}
async function exams(p){
  const ex=await api("/api/exams");

  let h=`
    <div class="card panel">
      <div class="row">
        <h2>Exams</h2>
        ${me.role==="ADMIN"
          ? `<button onclick="newExam()">+ Create Exam</button>`
          : ""}
      </div>

      <div class="list">
  `;

  if(!ex.length){
    h+=`<div class="item muted">No exams created yet.</div>`;
  }

  for(const x of ex){
    h+=`
      <div class="item row">
        <div>
          <b>${esc(x.title)}</b>
          <div class="muted">
            ${esc(x.difficulty||"MEDIUM")}
            · ${x.duration_minutes} min
            ${x.coding_enabled?"· Coding":""}
          </div>
        </div>

        <div class="row">
         ${me.role==="ADMIN"
  ? `<span class="badge">
      ${x.published?"PUBLISHED":"DRAFT"}
    </span>

    <button onclick="openExamBuilder(${x.id})">
      ${x.published?"View":"Edit"}
    </button>

    ${
  !x.published
  ? `<button class="danger" onclick="deleteDraftExam(${x.id})">
      Delete
    </button>`
  : ""
}
            : `<button onclick="startExam(${x.id})">Start</button>`
          }
        </div>
      </div>
    `;
  }

  h+=`
      </div>
    </div>
  `;

  p.innerHTML=h;
}


function esc(v){
  return String(v??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}


window.newExam=async()=>{
  if(me.role!=="ADMIN")return;

  const choice=prompt(
`Create Exam

Type 1 for Manual Exam
Type 2 for AI Generated Exam`,
    "1"
  );

  if(choice==="2"){
    alert("AI Exam Generator will be added in the next step.");
    return;
  }

  if(choice!=="1")return;

  const title=prompt("Exam title");
  if(!title)return;

  const description=prompt("Exam description","");

  const difficulty=(
    prompt(
      "Difficulty: EASY / MEDIUM / HARD",
      "MEDIUM"
    )||"MEDIUM"
  ).toUpperCase();

  const duration=Number(
    prompt("Duration in minutes","60")
  );

  if(!duration || duration<1){
    alert("Please enter a valid duration.");
    return;
  }

  const result=await api("/api/exams",{
    method:"POST",
    body:JSON.stringify({
      title,
      description,
      difficulty,
      duration_minutes:duration,
      coding_enabled:false,
      published:false
    })
  });

  await openExamBuilder(result.id);
};


window.openExamBuilder=async(id)=>{
  const p=$("#page");

  const ex=await api("/api/exams");
  const exam=ex.find(x=>Number(x.id)===Number(id));

  if(!exam){
    alert("Exam not found.");
    return;
  }

  const questions=await api(`/api/exams/${id}/questions`);

  let h=`
    <div class="card panel">

      <div class="row">
        <div>
          <h2>${esc(exam.title)}</h2>
          <div class="muted">
            ${esc(exam.difficulty)}
            · ${exam.duration_minutes} minutes
          </div>
        </div>

   <div class="row">
  <button onclick="document.getElementById('qbText').focus()">
    + Add Question
  </button>

  <button onclick="generateAIQuestions(${id})">
    ✨ AI Generate
  </button>

  ${!exam.published
  ? '<button onclick="publishExam(' + id + ')">🚀 Publish Exam</button>'
  : '<span class="badge">PUBLISHED</span>'
}
</div>
      </div>

      <hr>

      <h3>Questions</h3>

      <div class="list">
  `;

  if(!questions.length){
    h+=`
      <div class="item muted">
        No questions yet. Add your first question below.
      </div>
    `;
  }

  questions.forEach((q,i)=>{
    h+=`
      <div class="item">
        <b>Q${i+1}. ${esc(q.question_text)}</b>

        <div class="muted">
          ${esc(q.type)}
          · ${esc(q.difficulty||"MEDIUM")}
          · ${q.points} point(s)
        </div>

        ${
          q.options_json
          ? `<div class="muted">
              Options: ${q.options_json.map(esc).join(" | ")}
             </div>`
          : ""
        }
      </div>
    `;
  });

  h+=`
      </div>

      <hr>

      <h3>Add Question</h3>

      <label>Question</label>
      <textarea id="qbText" rows="4"
        placeholder="Enter your question"></textarea>

      <label>Type</label>
      <select id="qbType" onchange="toggleQuestionType()">
        <option value="MCQ">MCQ</option>
        <option value="CODING">Coding</option>
      </select>

      <label>Difficulty</label>
      <select id="qbDifficulty">
        <option value="EASY">Easy</option>
        <option value="MEDIUM" selected>Medium</option>
        <option value="HARD">Hard</option>
      </select>

      <label>Points</label>
      <input id="qbPoints" type="number" value="1" min="1">

      <div id="mcqFields">

        <label>Option A</label>
        <input id="optA" placeholder="Option A">

        <label>Option B</label>
        <input id="optB" placeholder="Option B">

        <label>Option C</label>
        <input id="optC" placeholder="Option C">

        <label>Option D</label>
        <input id="optD" placeholder="Option D">

        <label>Correct Answer</label>
        <select id="correctAnswer">
          <option value="">Select correct option</option>
          <option value="A">Option A</option>
          <option value="B">Option B</option>
          <option value="C">Option C</option>
          <option value="D">Option D</option>
        </select>

      </div>

      <div id="codingFields" class="hidden">

        <label>Test Case Input</label>
        <textarea id="testInput" rows="3"
          placeholder="Example input"></textarea>

        <label>Expected Output</label>
        <textarea id="testOutput" rows="3"
          placeholder="Example output"></textarea>

      </div>

      <br>

      <button onclick="addBuilderQuestion(${id})">
  + Add Question
</button>

<br><br>

<button onclick="load('exams')">
  ← Back to Exams
</button>
<br><br>
  `;

  p.innerHTML=h;
};


window.toggleQuestionType=()=>{
  const type=$("#qbType").value;

  $("#mcqFields").classList.toggle(
    "hidden",
    type!=="MCQ"
  );

  $("#codingFields").classList.toggle(
    "hidden",
    type!=="CODING"
  );
};


window.addBuilderQuestion=async(examId)=>{
  const question_text=$("#qbText").value.trim();
  const type=$("#qbType").value;
  const difficulty=$("#qbDifficulty").value;
  const points=Number($("#qbPoints").value||1);

  if(!question_text){
    alert("Please enter the question.");
    return;
  }

  if(type==="MCQ"){

    const options=[
      $("#optA").value.trim(),
      $("#optB").value.trim(),
      $("#optC").value.trim(),
      $("#optD").value.trim()
    ];

    if(options.some(x=>!x)){
      alert("Please fill all four options.");
      return;
    }

    const correct=$("#correctAnswer").value;

    if(!correct){
      alert("Please select the correct answer.");
      return;
    }

    const correct_answer=
      options[
        {A:0,B:1,C:2,D:3}[correct]
      ];

    await api(`/api/exams/${examId}/questions`,{
      method:"POST",
      body:JSON.stringify({
        question_text,
        type,
        difficulty,
        options,
        correct_answer,
        points,
        sort_order:Date.now()
      })
    });

  }else{

    const input=$("#testInput").value;
    const output=$("#testOutput").value;

    await api(`/api/exams/${examId}/questions`,{
      method:"POST",
      body:JSON.stringify({
        question_text,
        type,
        difficulty,
        points,
        sort_order:Date.now(),
        test_cases:[
          {
            input_text:input,
            expected_output:output
          }
        ]
      })
    });
  }

  await openExamBuilder(examId);
};

window.generateAIQuestions=async(examId)=>{
  const topic=prompt(
    "What topic should the AI exam questions cover?"
  );

  if(!topic || !topic.trim())return;

  const count=Number(
    prompt("How many questions should AI generate?","10")
  );

  if(!count || count<1 || count>50){
    alert("Please enter a number between 1 and 50.");
    return;
  }

  const difficulty=(
    prompt(
      "Difficulty: EASY / MEDIUM / HARD",
      "MEDIUM"
    )||"MEDIUM"
  ).toUpperCase();

  if(!["EASY","MEDIUM","HARD"].includes(difficulty)){
    alert("Invalid difficulty.");
    return;
  }

  try{
    alert("AI is generating your questions. Please wait...");

    await api(`/api/exams/${examId}/ai-generate`,{
      method:"POST",
      body:JSON.stringify({
        topic:topic.trim(),
        count,
        difficulty
      })
    });

    alert("AI questions generated successfully.");

    await openExamBuilder(examId);

  }catch(err){
    alert(err.message);
  }
};
window.publishExam=async(examId)=>{
  if(!confirm("Are you sure you want to publish this exam? Students will be able to see it.")){
    return;
  }

  try{
    await api(`/api/exams/${examId}/publish`,{
      method:"POST"
    });

    alert("Exam published successfully!");

    await openExamBuilder(examId);

  }catch(err){
    alert(err.message);
  }
};
window.deleteDraftExam=async(examId)=>{
  if(!confirm("Delete this draft exam and all its questions? This cannot be undone.")){
    return;
  }

  try{
    await api(`/api/exams/${examId}`,{
      method:"DELETE"
    });

    alert("Draft exam deleted successfully.");

    await load("exams");

  }catch(err){
    alert(err.message);
  }
};
window.startExam=async id=>{const s=await api(`/api/exams/${id}/start`,{method:"POST"});alert("Exam started. Submission ID: "+s.submission_id);openExam(id,s.submission_id)};
async function openExam(id,sid){
  const qs=await api(`/api/exams/${id}/questions`);

  const m=document.createElement("div");
  m.className="modal";

  let html=`
    <div>
      <div class="row">
        <h2>Exam</h2>
        <button onclick="this.closest('.modal').remove()">Close</button>
      </div>

      <p class="muted">
        Monitoring events are recorded while this session is active.
      </p>
  `;

  qs.forEach((q,i)=>{
    html+=`
      <div class="question">
        <b>Q${i+1}. ${q.question_text}</b>
    `;

    if(q.type==="MCQ"){
      (q.options_json||[]).forEach(o=>{
        html+=`
          <label class="option">
            <input
              type="radio"
              name="q${q.id}"
              value="${String(o).replaceAll('"','&quot;')}"
            >
            ${o}
          </label>
        `;
      });
    }else{
      html+=`
        <textarea
          class="code"
          id="code${q.id}"
          placeholder="// Write your solution here"
        ></textarea>
      `;
    }

    html+=`
        <button onclick="saveAnswer(${sid},${q.id},'${q.type}')">
          Save answer
        </button>
      </div>
    `;
  });

  html+=`
      <button class="danger" onclick="submitExam(${sid})">
        Submit Exam
      </button>
    </div>
  `;

  m.innerHTML=html;

  document.body.appendChild(m);

  document.documentElement.requestFullscreen?.().catch(()=>{});

  document.addEventListener(
    "visibilitychange",
    ()=>{
      if(document.hidden){
        api(`/api/submissions/${sid}/violation`,{
          method:"POST",
          body:JSON.stringify({
            type:"TAB_HIDDEN",
            severity:"HIGH",
            details:"Page became hidden"
          })
        }).catch(()=>{});
      }
    },
    {once:false}
  );
}
window.saveAnswer=async(sid,qid,type)=>{let a=type==="MCQ"?document.querySelector(`input[name="q${qid}"]:checked`)?.value:document.querySelector(`#code${qid}`).value;if(a===undefined)return alert("Select/write an answer");await api(`/api/submissions/${sid}/answer`,{method:"POST",body:JSON.stringify({question_id:qid,answer_text:a})});alert("Saved")};
window.submitExam=async sid=>{const r=await api(`/api/submissions/${sid}/submit`,{method:"POST"});alert("Submitted. Score: "+r.score);document.querySelector(".modal")?.remove();document.exitFullscreen?.().catch(()=>{});load("results")};
async function results(p){const r=await api("/api/results");p.innerHTML=`<div class="card panel"><h2>Results</h2><table class="table"><tr><th>Exam</th>${me.role==="ADMIN"?"<th>Student</th>":""}<th>Score</th><th>Status</th><th>Submitted</th></tr>${r.map(x=>`<tr><td>${x.title}</td>${me.role==="ADMIN"?`<td>${x.name}<br><span class="muted">${x.email}</span></td>`:""}<td>${x.score}</td><td>${x.status}</td><td>${x.submitted_at||"—"}</td></tr>`).join("")}</table></div>`}
async function attendance(p){const r=await api("/api/attendance");p.innerHTML=`<div class="card panel"><h2>Attendance</h2>${me.role==="ADMIN"?`<div class="notice">Use the API endpoint <code>POST /api/attendance</code> to mark each student present/absent. The schema enforces one record per student/date.</div>`:""}<table class="table"><tr><th>Date</th>${me.role==="ADMIN"?"<th>Student</th>":""}<th>Status</th></tr>${r.map(x=>`<tr><td>${x.attendance_date?.slice(0,10)||""}</td>${me.role==="ADMIN"?`<td>${x.name}</td>`:""}<td>${x.status}</td></tr>`).join("")}</table></div>`}
async function timetable(p){const r=await api("/api/timetable");p.innerHTML=`<div class="card panel"><div class="row"><h2>Timetable</h2>${me.role==="ADMIN"?'<button onclick="newLecture()">+ Add lecture</button>':""}</div><div class="list">${r.map(x=>`<div class="item"><b>${x.lecture_name}</b> <span class="badge">${x.cancelled?"CANCELLED":x.lecture_date?.slice(0,10)}</span><div>${x.start_time}–${x.end_time} · ${x.lecturer_name}</div>${me.role==="ADMIN"?`<button class="danger" onclick="deleteLecture(${x.id})">Delete</button>`:""}</div>`).join("")}</div></div>`}
window.newLecture=async()=>{const d=prompt("Date YYYY-MM-DD");const s=prompt("Start time HH:MM");const e=prompt("End time HH:MM");const n=prompt("Lecture name");const l=prompt("Lecturer name");if(!d||!s||!e||!n||!l)return;await api("/api/timetable",{method:"POST",body:JSON.stringify({lecture_date:d,start_time:s,end_time:e,lecture_name:n,lecturer_name:l})});load("timetable")};
window.deleteLecture=async id=>{await api("/api/timetable/"+id,{method:"DELETE"});load("timetable")};
async function announcements(p){const r=await api("/api/announcements");p.innerHTML=`<div class="card panel"><div class="row"><h2>Announcements</h2>${me.role==="ADMIN"?'<button onclick="newAnnouncement()">+ Add</button>':""}</div>${r.map(x=>`<div class="notice"><b>${x.title}</b><p>${x.body}</p>${x.attachment_url?`<a href="${x.attachment_url}" target="_blank">Attachment</a>`:""}<small class="muted">${x.created_at}</small>${me.role==="ADMIN"?`<br><button class="danger" onclick="deleteAnnouncement(${x.id})">Delete</button>`:""}</div>`).join("")}</div>`}
window.newAnnouncement=async()=>{const title=prompt("Title");const body=prompt("Message");const attachment_url=prompt("PDF/PNG URL (optional)");if(!title||!body)return;await api("/api/announcements",{method:"POST",body:JSON.stringify({title,body,attachment_url})});load("announcements")};
window.deleteAnnouncement=async id=>{await api("/api/announcements/"+id,{method:"DELETE"});load("announcements")};
async function feedback(p){p.innerHTML=`<div class="card panel"><h2>Feedback to HOD</h2><textarea id="fb" rows="8" placeholder="Write your feedback"></textarea><br><button onclick="sendFeedback()">Send feedback</button>${me.role==="ADMIN"?'<hr><h3>Received feedback</h3><div id="fblist"></div>':""}</div>`;if(me.role==="ADMIN"){const r=await api("/api/feedback");$("#fblist").innerHTML=r.map(x=>`<div class="item"><b>${x.name}</b> (${x.email})<p>${x.message}</p></div>`).join("")}}
window.sendFeedback=async()=>{await api("/api/feedback",{method:"POST",body:JSON.stringify({message:$("#fb").value})});$("#fb").value="";alert("Feedback recorded for HOD delivery")};
async function admins(p){const r=await api("/api/admins");p.innerHTML=`<div class="card panel"><div class="row"><h2>Admin Management</h2><button onclick="newAdmin()">+ Add admin</button></div><div class="list">${r.map(x=>`<div class="item row"><div><b>${x.name}</b><div class="muted">${x.email}</div></div><button class="danger" onclick="deleteAdmin(${x.id})">Delete</button></div>`).join("")}</div></div>`}
window.newAdmin=async()=>{const name=prompt("Admin name");const email=prompt("Admin email");const password=prompt("Temporary password");if(!name||!email||!password)return;await api("/api/admins",{method:"POST",body:JSON.stringify({name,email,password})});load("admins")};
window.deleteAdmin=async id=>{if(confirm("Delete this admin?")){await api("/api/admins/"+id,{method:"DELETE"});load("admins")}};
boot();
