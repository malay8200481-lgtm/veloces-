CREATE DATABASE IF NOT EXISTS veloces CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE veloces;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','STUDENT') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  attachment_url VARCHAR(500),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE timetable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lecture_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  lecture_name VARCHAR(200) NOT NULL,
  lecturer_name VARCHAR(150) NOT NULL,
  cancelled BOOLEAN DEFAULT FALSE,
  created_by INT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  status ENUM('PRESENT','ABSENT') NOT NULL,
  marked_by INT NOT NULL,
  UNIQUE KEY uq_attendance (student_id, attendance_date),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (marked_by) REFERENCES users(id)
);

CREATE TABLE exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  difficulty ENUM('EASY','MEDIUM','HARD') NOT NULL,
  duration_minutes INT NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  coding_enabled BOOLEAN DEFAULT FALSE,
  published BOOLEAN DEFAULT FALSE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  question_text TEXT NOT NULL,
  type ENUM('MCQ','CODING') NOT NULL,
  difficulty ENUM('EASY','MEDIUM','HARD') NOT NULL,
  options_json JSON NULL,
  correct_answer VARCHAR(500) NULL,
  points INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE test_cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  input_text TEXT,
  expected_output TEXT,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  score DECIMAL(10,2) DEFAULT 0,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME NULL,
  status ENUM('IN_PROGRESS','SUBMITTED','DISQUALIFIED') DEFAULT 'IN_PROGRESS',
  UNIQUE KEY uq_exam_student (exam_id, student_id),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (student_id) REFERENCES users(id)
);

CREATE TABLE answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  question_id INT NOT NULL,
  answer_text LONGTEXT,
  is_correct BOOLEAN NULL,
  points_awarded DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE violations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  type VARCHAR(80) NOT NULL,
  details VARCHAR(500),
  severity ENUM('LOW','MEDIUM','HIGH') DEFAULT 'LOW',
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE TABLE feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Initial admin is created by the setup endpoint/seed script, not by storing a plaintext password here.
