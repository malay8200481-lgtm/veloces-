require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const path = require("path");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const pool = mysql.createPool({
  host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, connectionLimit: 10
});
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

async function sendOtpEmail(email, otp) {
  await mailer.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || "Veloces"}" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: "Your Veloces verification code",
    text: `Your Veloces verification code is ${otp}. It expires in 5 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif">
        <h2>Veloces</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing:6px">${otp}</h1>
        <p>This code expires in 5 minutes.</p>
        <p>If you did not request this code, you can ignore this email.</p>
      </div>
    `
  });
}

function tokenFor(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET, { expiresIn: "8h" });
}
function auth(req,res,next) {
  try {
    const raw = req.cookies.veloces_token || (req.headers.authorization||"").replace("Bearer ","");
    req.user = jwt.verify(raw, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({error:"Authentication required"}); }
}
function admin(req,res,next) {
  if (req.user.role !== "ADMIN") return res.status(403).json({error:"Admin access required"});
  next();
}

app.get("/api/health", async (_req,res) => {
  try { await pool.query("SELECT 1"); res.json({ok:true, database:true}); }
  catch(e){ res.status(503).json({ok:false, database:false}); }
});

app.post("/api/auth/register", async (req,res) => {
  const {name,email,password,role="STUDENT"} = req.body;
  if (!name || !email || !password) return res.status(400).json({error:"Name, email and password are required"});
  const safeRole = role === "ADMIN" ? "ADMIN" : "STUDENT";
  if (safeRole === "ADMIN") return res.status(403).json({error:"Admin accounts can only be created by an existing admin"});
  try {
    const [exists] = await pool.execute("SELECT id FROM users WHERE email=?", [email.toLowerCase()]);
    if (exists.length) return res.status(409).json({error:"Email is already registered"});
    const hash = await bcrypt.hash(password,12);
    const [r] = await pool.execute("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'STUDENT')",
      [name,email.toLowerCase(),hash]);
    res.json({id:r.insertId,message:"Student account created"});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post("/api/auth/login", async (req,res) => {
  const {email,password,role} = req.body;
  const [rows] = await pool.execute("SELECT * FROM users WHERE email=?", [String(email||"").toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password||"",user.password_hash)) || user.role !== role)
    return res.status(401).json({error:"Invalid email, password, or account type"});
  res.cookie("veloces_token", tokenFor(user), {httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000});
  res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role}});
});
app.post("/api/auth/logout",(req,res)=>{res.clearCookie("veloces_token");res.json({ok:true});});
app.get("/api/auth/me",auth,async(req,res)=>{
  const [r]=await pool.execute("SELECT id,name,email,role,created_at FROM users WHERE id=?",[req.user.id]);
  res.json(r[0]);
});

app.get("/api/admins",auth,admin,async(_req,res)=>{
  const [r]=await pool.query("SELECT id,name,email,created_at FROM users WHERE role='ADMIN' ORDER BY created_at");
  res.json(r);
});
app.post("/api/admins",auth,admin,async(req,res)=>{
  const {name,email,password}=req.body;
  if(!name||!email||!password) return res.status(400).json({error:"All fields are required"});
  try{
    const [e]=await pool.execute("SELECT id FROM users WHERE email=?",[email.toLowerCase()]);
    if(e.length)return res.status(409).json({error:"Email already exists"});
    const hash=await bcrypt.hash(password,12);
    const [r]=await pool.execute("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'ADMIN')",[name,email.toLowerCase(),hash]);
    res.json({id:r.insertId});
  }catch(e){res.status(500).json({error:e.message});}
});
app.delete("/api/admins/:id",auth,admin,async(req,res)=>{
  if(Number(req.params.id)===req.user.id)return res.status(400).json({error:"You cannot delete your own admin account"});
  await pool.execute("DELETE FROM users WHERE id=? AND role='ADMIN'",[req.params.id]);
  res.json({ok:true});
});

app.get("/api/students",auth,admin,async(_req,res)=>{
  const [r]=await pool.query("SELECT id,name,email,created_at FROM users WHERE role='STUDENT' ORDER BY created_at DESC");
  res.json(r);
});

app.get("/api/announcements",auth,async(_req,res)=>{
  const [r]=await pool.query("SELECT a.*,u.name AS created_by_name FROM announcements a JOIN users u ON u.id=a.created_by ORDER BY a.created_at DESC");
  res.json(r);
});
app.post("/api/announcements",auth,admin,async(req,res)=>{
  const {title,body,attachment_url}=req.body;
  const [r]=await pool.execute("INSERT INTO announcements(title,body,attachment_url,created_by) VALUES(?,?,?,?)",
    [title,body,attachment_url||null,req.user.id]);
  res.json({id:r.insertId});
});
app.delete("/api/announcements/:id",auth,admin,async(req,res)=>{
  await pool.execute("DELETE FROM announcements WHERE id=?",[req.params.id]); res.json({ok:true});
});

app.get("/api/timetable",auth,async(_req,res)=>{
  const [r]=await pool.query("SELECT * FROM timetable ORDER BY lecture_date,start_time");
  res.json(r);
});
app.post("/api/timetable",auth,admin,async(req,res)=>{
  const {lecture_date,start_time,end_time,lecture_name,lecturer_name,cancelled=false}=req.body;
  const [r]=await pool.execute("INSERT INTO timetable(lecture_date,start_time,end_time,lecture_name,lecturer_name,cancelled,created_by) VALUES(?,?,?,?,?,?,?)",
    [lecture_date,start_time,end_time,lecture_name,lecturer_name,!!cancelled,req.user.id]);
  res.json({id:r.insertId});
});
app.delete("/api/timetable/:id",auth,admin,async(req,res)=>{
  await pool.execute("DELETE FROM timetable WHERE id=?",[req.params.id]);res.json({ok:true});
});

app.get("/api/attendance",auth,async(req,res)=>{
  if(req.user.role==="ADMIN"){
    const [r]=await pool.query("SELECT a.*,u.name,u.email FROM attendance a JOIN users u ON u.id=a.student_id ORDER BY attendance_date DESC,u.name");
    return res.json(r);
  }
  const [r]=await pool.execute("SELECT * FROM attendance WHERE student_id=? ORDER BY attendance_date DESC",[req.user.id]);
  res.json(r);
});
app.post("/api/attendance",auth,admin,async(req,res)=>{
  const {student_id,attendance_date,status}=req.body;
  await pool.execute(
    "INSERT INTO attendance(student_id,attendance_date,status,marked_by) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),marked_by=VALUES(marked_by)",
    [student_id,attendance_date,status,req.user.id]
  );
  res.json({ok:true});
});

app.get("/api/exams",auth,async(req,res)=>{
  const sql=req.user.role==="ADMIN" ? "SELECT * FROM exams ORDER BY created_at DESC" : "SELECT id,title,description,difficulty,duration_minutes,starts_at,ends_at,coding_enabled FROM exams WHERE published=1 ORDER BY created_at DESC";
  const [r]=await pool.query(sql);res.json(r);
});
app.post("/api/exams",auth,admin,async(req,res)=>{
  const {title,description,difficulty,duration_minutes,starts_at,ends_at,coding_enabled=false,published=false}=req.body;
  const [r]=await pool.execute("INSERT INTO exams(title,description,difficulty,duration_minutes,starts_at,ends_at,coding_enabled,published,created_by) VALUES(?,?,?,?,?,?,?,?,?)",
    [title,description||"",difficulty,duration_minutes,starts_at||null,ends_at||null,!!coding_enabled,!!published,req.user.id]);
  res.json({id:r.insertId});
});
app.post("/api/exams/:id/questions",auth,admin,async(req,res)=>{
  const {question_text,type,difficulty,options,correct_answer,points=1,sort_order=0,test_cases=[]}=req.body;
  const [r]=await pool.execute("INSERT INTO questions(exam_id,question_text,type,difficulty,options_json,correct_answer,points,sort_order) VALUES(?,?,?,?,?,?,?,?)",
    [req.params.id,question_text,type,difficulty,options?JSON.stringify(options):null,correct_answer||null,points,sort_order]);
  for(const tc of test_cases) await pool.execute("INSERT INTO test_cases(question_id,input_text,expected_output) VALUES(?,?,?)",[r.insertId,tc.input_text||"",tc.expected_output||""]);
  res.json({id:r.insertId});
});
app.get("/api/exams/:id/questions",auth,async(req,res)=>{
  const [r]=await pool.execute("SELECT id,exam_id,question_text,type,difficulty,options_json,points,sort_order FROM questions WHERE exam_id=? ORDER BY sort_order,id",[req.params.id]);
  res.json(r.map(x=>({...x,options_json:x.options_json?JSON.parse(x.options_json):null})));
});

app.post("/api/exams/:id/start",auth,async(req,res)=>{
  if(req.user.role!=="STUDENT")return res.status(403).json({error:"Students only"});
  try{
    const [r]=await pool.execute("INSERT INTO submissions(exam_id,student_id) VALUES(?,?)",[req.params.id,req.user.id]);
    res.json({submission_id:r.insertId});
  }catch(e){
    const [r]=await pool.execute("SELECT id,status FROM submissions WHERE exam_id=? AND student_id=?",[req.params.id,req.user.id]);
    res.json({submission_id:r[0]?.id,status:r[0]?.status});
  }
});
app.post("/api/submissions/:id/answer",auth,async(req,res)=>{
  const {question_id,answer_text}=req.body;
  const [s]=await pool.execute("SELECT * FROM submissions WHERE id=?",[req.params.id]);
  if(!s[0]||s[0].student_id!==req.user.id||s[0].status!=="IN_PROGRESS")return res.status(403).json({error:"Invalid submission"});
  const [q]=await pool.execute("SELECT * FROM questions WHERE id=?",[question_id]);
  const question=q[0];
  let correct=null, points=0;
  if(question.type==="MCQ"){
    correct=String(answer_text||"")===String(question.correct_answer||"");
    points=correct?question.points:0;
  }
  await pool.execute("INSERT INTO answers(submission_id,question_id,answer_text,is_correct,points_awarded) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE answer_text=VALUES(answer_text),is_correct=VALUES(is_correct),points_awarded=VALUES(points_awarded)",
    [req.params.id,question_id,answer_text||"",correct,points]);
  res.json({ok:true,correct,points});
});
app.post("/api/submissions/:id/violation",auth,async(req,res)=>{
  const [s]=await pool.execute("SELECT student_id FROM submissions WHERE id=?",[req.params.id]);
  if(!s[0]||s[0].student_id!==req.user.id)return res.status(403).json({error:"Invalid submission"});
  const {type,details,severity="LOW"}=req.body;
  await pool.execute("INSERT INTO violations(submission_id,type,details,severity) VALUES(?,?,?,?)",[req.params.id,type,details||"",severity]);
  res.json({ok:true});
});
app.post("/api/submissions/:id/submit",auth,async(req,res)=>{
  const [s]=await pool.execute("SELECT * FROM submissions WHERE id=? AND student_id=?",[req.params.id,req.user.id]);
  if(!s[0])return res.status(404).json({error:"Submission not found"});
  const [sum]=await pool.execute("SELECT COALESCE(SUM(points_awarded),0) score FROM answers WHERE submission_id=?",[req.params.id]);
  await pool.execute("UPDATE submissions SET score=?,submitted_at=NOW(),status='SUBMITTED' WHERE id=?",[sum[0].score,req.params.id]);
  res.json({score:sum[0].score});
});
app.get("/api/results",auth,async(req,res)=>{
  const [r]=await pool.execute(
    `SELECT s.id,s.exam_id,e.title,s.student_id,u.name,u.email,s.score,s.status,s.started_at,s.submitted_at
     FROM submissions s JOIN exams e ON e.id=s.exam_id JOIN users u ON u.id=s.student_id
     ${req.user.role==="STUDENT"?"WHERE s.student_id=?":""} ORDER BY s.submitted_at DESC`,
    req.user.role==="STUDENT"?[req.user.id]:[]);
  res.json(r);
});

app.post("/api/feedback",auth,async(req,res)=>{
  const {message}=req.body;
  if(!message)return res.status(400).json({error:"Message required"});
  await pool.execute("INSERT INTO feedback(student_id,message) VALUES(?,?)",[req.user.id,message]);
  // Production email delivery should be wired to SMTP/transactional mail provider using HOD_EMAIL.
  res.json({ok:true,message:"Feedback recorded for HOD delivery"});
});
app.get("/api/feedback",auth,admin,async(_req,res)=>{
  const [r]=await pool.query("SELECT f.*,u.name,u.email FROM feedback f JOIN users u ON u.id=f.student_id ORDER BY f.created_at DESC");
  res.json(r);
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(process.env.PORT||3000,()=>console.log(`Veloces running on http://localhost:${process.env.PORT||3000}`));
