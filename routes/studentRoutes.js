const express = require('express');
const router  = express.Router();
const fs      = require('fs');

const TESTS    = './data/tests.json';
const RESULTS  = './data/results.json';
const SECTIONS = './data/sections.json';
const USERS    = './data/users.json';
const read     = f => JSON.parse(fs.readFileSync(f));
const write    = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

// ── Filter Servlet: guard all student routes ──
function isStudent(req, res, next) {
  if (req.session.user && req.session.user.role === 'student') return next();
  res.redirect('/login');
}

// ── SERVLET: Student Dashboard (Shows sections like Google Classroom) ──
router.get('/dashboard', isStudent, (req, res) => {
  const allTests  = read(TESTS);
  const myResults = read(RESULTS).filter(r => r.studentId === req.session.user.id);
  const attempted = myResults.map(r => r.testId);
  const sections = read(SECTIONS);
  
  // Find which section the student belongs to
  const studentSection = sections.find(s => s.students.includes(req.session.user.id));
  
  if (studentSection) {
    // Update student's section name in session
    req.session.user.sectionName = studentSection.name;
    req.session.user.sectionId = studentSection.id;
    
    // Get tests assigned to this section
    const sectionTests = allTests.filter(t => {
      // Test is assigned to this section's students
      return t.assignedTo && t.assignedTo.some(studentId => 
        studentSection.students.includes(studentId)
      );
    });
    
    // Organize tests by section
    const sectionsWithTests = [{
      ...studentSection,
      tests: sectionTests
    }];
    
    res.render('student/dashboard', { 
      user: req.session.user, 
      sections: sectionsWithTests,
      myTests: sectionTests,
      attempted,
      myResults
    });
  } else {
    // Student not in any section
    res.render('student/dashboard', { 
      user: req.session.user, 
      sections: [],
      myTests: [],
      attempted,
      myResults
    });
  }
});

// ── SERVLET: Load test page ──
router.get('/take/:testId', isStudent, (req, res) => {
  const test      = read(TESTS).find(t => t.id === req.params.testId);
  const attempted = read(RESULTS).find(r =>
    r.testId === req.params.testId && r.studentId === req.session.user.id
  );
  
  // Check if student is allowed to take this test
  const sections = read(SECTIONS);
  const studentSection = sections.find(s => s.students.includes(req.session.user.id));
  const isAssigned = test && test.assignedTo && test.assignedTo.includes(req.session.user.id);
  
  if (!test || !isAssigned)
    return res.redirect('/student/dashboard');
  if (attempted)
    return res.redirect(`/student/result/${req.params.testId}`);
    
  res.render('student/takeTest', { user: req.session.user, test });
});

// ── SERVLET: Submit exam & auto-grade ──
router.post('/submit/:testId', isStudent, (req, res) => {
  const test = read(TESTS).find(t => t.id === req.params.testId);
  if (!test) return res.redirect('/student/dashboard');

  // Prevent double submission
  const already = read(RESULTS).find(r =>
    r.testId === req.params.testId && r.studentId === req.session.user.id
  );
  if (already) return res.redirect(`/student/result/${req.params.testId}`);

  // Build answers array for all question types
  const answers = test.questions.map(q => {
    let given;
    if (q.type === 'multiple') {
      given = [].concat(req.body[`q${q.id}`] || []);
    } else if (q.type === 'single') {
      given = (req.body[`q${q.id}`] || '').trim();
    } else {
      given = (req.body[`q${q.id}`] || '').trim();
    }
    return { qId: q.id, given, awarded: null };
  });

  let score  = null;
  let status = 'pending_evaluation';

  // Auto-grade if mode is auto
  if (test.correctionMode === 'auto') {
    score = 0;
    answers.forEach(a => {
      const q = test.questions.find(q => q.id === a.qId);

      if (q.type === 'single') {
        if (a.given.toLowerCase() === (q.answer || '').toLowerCase()) {
          a.awarded = q.marks;
          score    += q.marks;
        } else {
          a.awarded = 0;
        }
      } else if (q.type === 'multiple') {
        const correct = [].concat(q.answer).map(x => x.toLowerCase()).sort();
        const given   = a.given.map(x => x.toLowerCase()).sort();
        const match   = correct.length === given.length &&
                        correct.every((v, i) => v === given[i]);
        a.awarded = match ? q.marks : 0;
        score    += a.awarded;
      } else if (q.type === 'fillblank') {
        if (a.given.toLowerCase() === (q.answer || '').toLowerCase()) {
          a.awarded = q.marks;
          score    += q.marks;
        } else {
          a.awarded = 0;
        }
      } else if (q.type === 'oneline' || q.type === 'paragraph') {
        a.awarded = 0;
      }
    });
    status = 'graded';
  }

  // Get student's section info
  const sections = read(SECTIONS);
  const studentSection = sections.find(s => s.students.includes(req.session.user.id));
  
  const results = read(RESULTS);
  results.push({
    testId:         test.id,
    testTitle:      test.title,
    studentId:      req.session.user.id,
    studentName:    req.session.user.name,
    studentEnrollment: req.session.user.enrollmentNo || '',
    studentSection: studentSection ? studentSection.name : 'Not Assigned',
    correctionMode: test.correctionMode,
    status,
    answers,
    score,
    totalMarks:     test.totalMarks,
    percent:        score !== null ? Math.round((score / test.totalMarks) * 100) : null,
    teacherComment: '',
    submittedAt:    new Date().toLocaleString(),
    evaluatedAt:    null
  });
  write(RESULTS, results);
  res.redirect(`/student/result/${test.id}`);
});

// ── SERVLET: View result for a specific test ──
router.get('/result/:testId', isStudent, (req, res) => {
  const result = read(RESULTS).find(r =>
    r.testId === req.params.testId && r.studentId === req.session.user.id
  );
  const test = read(TESTS).find(t => t.id === req.params.testId);
  if (!result) return res.redirect('/student/dashboard');
  res.render('student/result', { user: req.session.user, result, test });
});

// ── SERVLET: All my results ──
router.get('/my-results', isStudent, (req, res) => {
  const results = read(RESULTS).filter(r => r.studentId === req.session.user.id);
  res.render('student/myResults', { user: req.session.user, results });
});

module.exports = router;