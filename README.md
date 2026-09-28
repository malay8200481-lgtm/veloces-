# Veloces — Online Test & Coding Assessment Platform

A new full-stack Veloces project using:
- Node.js + Express API
- MySQL
- JWT in an HTTP-only cookie
- Responsive HTML/CSS/JS frontend
- Admin + Student roles
- Multiple admin accounts
- Exams, MCQ questions, coding-question editor area
- Results
- Attendance
- Timetable
- Announcements
- Feedback
- Exam violation logging

## Run locally

1. Install Node.js 18+ and MySQL 8+.
2. Create the database:
   `mysql -u root -p < schema.sql`
3. Copy `.env.example` to `.env` and fill in your MySQL credentials and JWT secret.
4. Install packages:
   `npm install`
5. Seed the first admin:
   `node seed.js`
6. Start:
   `npm start`
7. Open:
   `http://localhost:3000`

Initial seed admin:
- email: admin@veloces.local
- password: ChangeMe123!
Change the account password implementation before production use; the current admin-management flow intentionally does not expose password editing.

## Important production notes

- The feedback endpoint stores feedback; connect it to an authenticated SMTP/transactional-email provider to actually send mail from the registered account to the HOD. Do not spoof a student's From address through arbitrary SMTP headers.
- The coding editor UI is included, but arbitrary code execution is not enabled in this starter. A production compiler should run code inside isolated containers/sandboxes with strict CPU, memory, process, filesystem, network and time limits.
- Camera/microphone permissions and fullscreen/visibility events are browser-controlled. The platform logs violations, but no browser can guarantee that a student physically cannot leave a device.
- For real deployment, use HTTPS, rotate JWT secrets, add CSRF protection where appropriate, rate limiting, audit logging, backups, secure file storage, and a proper email provider.
