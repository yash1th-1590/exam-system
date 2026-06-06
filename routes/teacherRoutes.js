const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');

const USERS    = './data/users.json';
const TESTS    = './data/tests.json';
const RESULTS  = './data/results.json';
const SECTIONS = './data/sections.json';
const read     = f => JSON.parse(fs.readFileSync(f));
const write    = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

function isTeacher(req, res, next) {
  if (req.session.user && req.session.user.role === 'teacher') return next();
  res.redirect('/login');
}

router.get('/dashboard', isTeacher, (req, res) => {
  const tests     = read(TESTS).filter(t => t.createdBy === req.session.user.id);
  const results   = read(RESULTS);
  const sections  = read(SECTIONS).filter(s => s.teacherId === req.session.user.id);
  const allStudents = read(USERS).filter(u => u.role === 'student');
  const teacherStudentIds = [];
  sections.forEach(section => {
    teacherStudentIds.push(...section.students);
  });
  const students = allStudents.filter(s => teacherStudentIds.includes(s.id));
  const pendingCount = results.filter(r =>
    tests.map(t => t.id).includes(r.testId) && r.status === 'pending_evaluation'
  ).length;
  
  res.render('teacher/dashboard', { 
    user: req.session.user, 
    tests, 
    results, 
    students, 
    sections,
    pendingCount 
  });
});

router.get('/my-tests', isTeacher, (req, res) => {
  const tests = read(TESTS).filter(t => t.createdBy === req.session.user.id);
  res.render('teacher/myTests', { user: req.session.user, tests });
});

router.post('/delete-test/:testId', isTeacher, (req, res) => {
  const tests = read(TESTS);
  const testIndex = tests.findIndex(t => t.id === req.params.testId && t.createdBy === req.session.user.id);
  if (testIndex !== -1) {
    tests.splice(testIndex, 1);
    write(TESTS, tests);
  }
  res.redirect('/teacher/my-tests');
});

router.post('/duplicate-test/:testId', isTeacher, (req, res) => {
  const tests = read(TESTS);
  const originalTest = tests.find(t => t.id === req.params.testId && t.createdBy === req.session.user.id);
  if (originalTest) {
    const newTest = {
      ...JSON.parse(JSON.stringify(originalTest)),
      id: uuidv4(),
      title: `${originalTest.title} (Copy)`,
      assignedTo: [],
      createdAt: new Date().toLocaleString()
    };
    tests.push(newTest);
    write(TESTS, tests);
  }
  res.redirect('/teacher/my-tests');
});

router.get('/create-section', isTeacher, (req, res) => {
  res.render('teacher/createSection', { user: req.session.user, error: null });
});

router.post('/create-section', isTeacher, (req, res) => {
  const { sectionName, department, description } = req.body;
  if (!sectionName || !sectionName.trim()) {
    return res.render('teacher/createSection', { 
      user: req.session.user, 
      error: 'Section name is required.' 
    });
  }
  const sections = read(SECTIONS);
  const existing = sections.find(s => s.name === sectionName && s.teacherId === req.session.user.id);
  if (existing) {
    return res.render('teacher/createSection', { 
      user: req.session.user, 
      error: 'You already have a section with this name.' 
    });
  }
  const newSection = {
    id: uuidv4(),
    name: sectionName.trim(),
    department: department || 'General',
    description: description || '',
    teacherId: req.session.user.id,
    teacherName: req.session.user.name,
    students: [],
    createdAt: new Date().toLocaleString()
  };
  sections.push(newSection);
  write(SECTIONS, sections);
  const users = read(USERS);
  const userIndex = users.findIndex(u => u.id === req.session.user.id);
  if (userIndex !== -1) {
    if (!users[userIndex].sections) users[userIndex].sections = [];
    users[userIndex].sections.push(newSection.id);
    users[userIndex].department = department || 'General';
    write(USERS, users);
    req.session.user = users[userIndex];
  }
  res.redirect('/teacher/dashboard');
});

router.get('/section/:sectionId', isTeacher, (req, res) => {
  const sections = read(SECTIONS);
  const section = sections.find(s => s.id === req.params.sectionId);
  if (!section || section.teacherId !== req.session.user.id) {
    return res.redirect('/teacher/dashboard');
  }
  const students = read(USERS).filter(u => u.role === 'student' && section.students.includes(u.id));
  const allStudents = read(USERS).filter(u => u.role === 'student' && !section.students.includes(u.id));
  const tests = read(TESTS).filter(t => t.createdBy === req.session.user.id);
  res.render('teacher/sectionDetails', { user: req.session.user, section, students, allStudents, tests });
});

router.post('/section/:sectionId/add-student', isTeacher, (req, res) => {
  const { studentId } = req.body;
  const sections = read(SECTIONS);
  const sectionIndex = sections.findIndex(s => s.id === req.params.sectionId);
  if (sectionIndex === -1 || sections[sectionIndex].teacherId !== req.session.user.id) {
    return res.redirect('/teacher/dashboard');
  }
  if (!sections[sectionIndex].students.includes(studentId)) {
    sections[sectionIndex].students.push(studentId);
    write(SECTIONS, sections);
    const users = read(USERS);
    const studentIndex = users.findIndex(u => u.id === studentId);
    if (studentIndex !== -1) {
      users[studentIndex].section = sections[sectionIndex].id;
      users[studentIndex].department = sections[sectionIndex].department;
      write(USERS, users);
    }
  }
  res.redirect(`/teacher/section/${req.params.sectionId}`);
});

router.post('/section/:sectionId/remove-student/:studentId', isTeacher, (req, res) => {
  const sections = read(SECTIONS);
  const sectionIndex = sections.findIndex(s => s.id === req.params.sectionId);
  if (sectionIndex !== -1 && sections[sectionIndex].teacherId === req.session.user.id) {
    sections[sectionIndex].students = sections[sectionIndex].students.filter(id => id !== req.params.studentId);
    write(SECTIONS, sections);
    const users = read(USERS);
    const studentIndex = users.findIndex(u => u.id === req.params.studentId);
    if (studentIndex !== -1) {
      users[studentIndex].section = null;
      users[studentIndex].department = null;
      write(USERS, users);
    }
  }
  res.redirect(`/teacher/section/${req.params.sectionId}`);
});

router.post('/section/:sectionId/delete', isTeacher, (req, res) => {
  const sections = read(SECTIONS);
  const sectionIndex = sections.findIndex(s => s.id === req.params.sectionId);
  if (sectionIndex !== -1 && sections[sectionIndex].teacherId === req.session.user.id) {
    const users = read(USERS);
    sections[sectionIndex].students.forEach(studentId => {
      const studentIndex = users.findIndex(u => u.id === studentId);
      if (studentIndex !== -1) {
        users[studentIndex].section = null;
        users[studentIndex].department = null;
      }
    });
    write(USERS, users);
    sections.splice(sectionIndex, 1);
    write(SECTIONS, sections);
    const userIndex = users.findIndex(u => u.id === req.session.user.id);
    if (userIndex !== -1) {
      users[userIndex].sections = users[userIndex].sections.filter(id => id !== req.params.sectionId);
      write(USERS, users);
      req.session.user = users[userIndex];
    }
  }
  res.redirect('/teacher/dashboard');
});

router.post('/section/:sectionId/assign-test', isTeacher, (req, res) => {
  const { testId } = req.body;
  const sections = read(SECTIONS);
  const tests = read(TESTS);
  const section = sections.find(s => s.id === req.params.sectionId);
  const test = tests.find(t => t.id === testId);
  if (section && test && test.createdBy === req.session.user.id) {
    const currentAssigned = test.assignedTo || [];
    const newStudents = section.students.filter(sid => !currentAssigned.includes(sid));
    test.assignedTo = [...currentAssigned, ...newStudents];
    write(TESTS, tests);
  }
  res.redirect(`/teacher/section/${req.params.sectionId}`);
});

router.get('/add-student', isTeacher, (req, res) => {
  const sections = read(SECTIONS).filter(s => s.teacherId === req.session.user.id);
  res.render('teacher/addStudent', { user: req.session.user, sections, error: null });
});

router.post('/add-student', isTeacher, (req, res) => {
  const { name, username, password, enrollmentNo, sectionId } = req.body;
  const users = read(USERS);
  if (users.find(u => u.username === username)) {
    const sections = read(SECTIONS).filter(s => s.teacherId === req.session.user.id);
    return res.render('teacher/addStudent', { user: req.session.user, sections, error: 'Username already exists.' });
  }
  const sections = read(SECTIONS);
  const section = sections.find(s => s.id === sectionId);
  const newUser = { 
    id: uuidv4(), 
    name, 
    username, 
    password, 
    role: 'student',
    enrollmentNo: enrollmentNo || '',
    section: sectionId || null,
    department: section ? section.department : null,
    createdAt: new Date().toLocaleString()
  };
  users.push(newUser);
  write(USERS, users);
  if (sectionId && section) {
    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    if (sectionIndex !== -1 && section.teacherId === req.session.user.id) {
      sections[sectionIndex].students.push(newUser.id);
      write(SECTIONS, sections);
    }
  }
  res.redirect('/teacher/dashboard');
});

router.get('/create-test', isTeacher, (req, res) => {
  const existingTests = read(TESTS).filter(t => t.createdBy === req.session.user.id);
  res.render('teacher/createTest', { user: req.session.user, error: null, existingTests });
});

router.get('/import-test/:testId', isTeacher, (req, res) => {
  const tests = read(TESTS);
  const testToImport = tests.find(t => t.id === req.params.testId && t.createdBy === req.session.user.id);
  if (!testToImport) {
    return res.redirect('/teacher/create-test');
  }
  res.render('teacher/importTest', { user: req.session.user, test: testToImport, error: null });
});

router.post('/create-test', isTeacher, (req, res) => {
  const { title, duration, correctionMode, importFrom } = req.body;
  if (!title || !title.trim()) {
    const existingTests = read(TESTS).filter(t => t.createdBy === req.session.user.id);
    return res.render('teacher/createTest', { user: req.session.user, error: 'Test title is required.', existingTests });
  }
  let questions = [];
  let totalMarks = 0;
  if (importFrom && importFrom !== '') {
    const existingTests = read(TESTS);
    const sourceTest = existingTests.find(t => t.id === importFrom && t.createdBy === req.session.user.id);
    if (sourceTest) {
      questions = JSON.parse(JSON.stringify(sourceTest.questions));
      totalMarks = sourceTest.totalMarks;
      let i = 1;
      while (req.body[`question_${i}`]) {
        const type = req.body[`type_${i}`] || 'single';
        const marks = parseFloat(req.body[`marks_${i}`]) || 1;
        if (i <= questions.length) {
          const oldMarks = questions[i-1].marks;
          totalMarks = totalMarks - oldMarks + marks;
          questions[i-1].marks = marks;
          questions[i-1].question = req.body[`question_${i}`].trim();
          questions[i-1].type = type;
          if (type === 'single' || type === 'multiple') {
            questions[i-1].options = [1, 2, 3, 4].map(j => (req.body[`option_${i}_${j}`] || '').trim()).filter(Boolean);
            if (type === 'single') {
              let correctIndex = null;
              for (let j = 1; j <= 4; j++) {
                if (req.body[`correct_${i}_${j}`]) {
                  correctIndex = j;
                  break;
                }
              }
              questions[i-1].answer = correctIndex ? req.body[`option_${i}_${correctIndex}`] || '' : '';
            } else {
              const correctAnswers = [];
              for (let j = 1; j <= 4; j++) {
                if (req.body[`correct_${i}_${j}`]) {
                  const opt = req.body[`option_${i}_${j}`] || '';
                  if (opt) correctAnswers.push(opt);
                }
              }
              questions[i-1].answer = correctAnswers;
            }
          } else if (type === 'fillblank') {
            questions[i-1].answer = (req.body[`answer_${i}`] || '').trim();
          } else {
            questions[i-1].answer = (req.body[`answer_${i}`] || '').trim();
          }
        }
        i++;
      }
    }
  } else {
    let i = 1;
    while (req.body[`question_${i}`]) {
      const type  = req.body[`type_${i}`] || 'single';
      const marks = parseFloat(req.body[`marks_${i}`]) || 1;
      totalMarks += marks;
      let answer;
      let options = [];
      if (type === 'single' || type === 'multiple') {
        options = [1, 2, 3, 4].map(j => (req.body[`option_${i}_${j}`] || '').trim()).filter(Boolean);
        if (type === 'single') {
          let correctIndex = null;
          for (let j = 1; j <= 4; j++) {
            if (req.body[`correct_${i}_${j}`]) {
              correctIndex = j;
              break;
            }
          }
          answer = correctIndex ? req.body[`option_${i}_${correctIndex}`] || '' : '';
        } else {
          const correctAnswers = [];
          for (let j = 1; j <= 4; j++) {
            if (req.body[`correct_${i}_${j}`]) {
              const opt = req.body[`option_${i}_${j}`] || '';
              if (opt) correctAnswers.push(opt);
            }
          }
          answer = correctAnswers;
        }
      } else if (type === 'fillblank') {
        answer = (req.body[`answer_${i}`] || '').trim();
      } else {
        answer = (req.body[`answer_${i}`] || '').trim();
      }
      questions.push({
        id: i,
        type,
        question: req.body[`question_${i}`].trim(),
        options,
        answer,
        marks
      });
      i++;
    }
  }
  if (questions.length === 0) {
    const existingTests = read(TESTS).filter(t => t.createdBy === req.session.user.id);
    return res.render('teacher/createTest', { user: req.session.user, error: 'Add at least one question before saving.', existingTests });
  }
  const tests = read(TESTS);
  tests.push({
    id: uuidv4(),
    title: title.trim(),
    duration: parseInt(duration) || 30,
    correctionMode: correctionMode || 'auto',
    totalMarks,
    createdBy: req.session.user.id,
    createdByName: req.session.user.name,
    questions,
    assignedTo: [],
    createdAt: new Date().toLocaleString()
  });
  write(TESTS, tests);
  res.redirect('/teacher/my-tests');
});

router.get('/assign/:testId', isTeacher, (req, res) => {
  const test = read(TESTS).find(t => t.id === req.params.testId);
  const sections = read(SECTIONS).filter(s => s.teacherId === req.session.user.id);
  if (!test) return res.redirect('/teacher/dashboard');
  const allStudents = read(USERS).filter(u => u.role === 'student');
  const teacherStudentIds = [];
  sections.forEach(section => {
    teacherStudentIds.push(...section.students);
  });
  const assignedStudentIds = test.assignedTo || [];
  const availableStudents = allStudents.filter(u => teacherStudentIds.includes(u.id) && !assignedStudentIds.includes(u.id));
  const sectionsWithUnassigned = sections.map(section => ({
    ...section,
    unassignedCount: section.students.filter(sid => !assignedStudentIds.includes(sid)).length
  }));
  const noStudentsLeft = availableStudents.length === 0;
  res.render('teacher/assignTest', { 
    user: req.session.user, 
    test, 
    students: availableStudents,
    sections: sectionsWithUnassigned,
    assignedCount: assignedStudentIds.length,
    totalStudents: teacherStudentIds.length,
    noStudentsLeft
  });
});

router.post('/assign/:testId', isTeacher, (req, res) => {
  const tests = read(TESTS);
  const idx = tests.findIndex(t => t.id === req.params.testId);
  if (idx === -1) return res.redirect('/teacher/dashboard');
  let assignedStudents = [].concat(req.body.studentIds || []);
  if (req.body.assignBySection && req.body.sectionId) {
    const sections = read(SECTIONS);
    const section = sections.find(s => s.id === req.body.sectionId);
    if (section) {
      const currentAssigned = tests[idx].assignedTo || [];
      const newStudents = section.students.filter(sid => !currentAssigned.includes(sid));
      assignedStudents = [...assignedStudents, ...newStudents];
    }
  }
  const currentAssigned = tests[idx].assignedTo || [];
  tests[idx].assignedTo = [...new Set([...currentAssigned, ...assignedStudents])];
  write(TESTS, tests);
  res.redirect('/teacher/assign/' + req.params.testId);
});

// FIXED RESULTS ROUTE
router.get('/results/:testId', isTeacher, (req, res) => {
  const test = read(TESTS).find(t => t.id === req.params.testId);
  const results = read(RESULTS).filter(r => r.testId === req.params.testId);
  const allStudents = read(USERS).filter(u => u.role === 'student');
  const allSections = read(SECTIONS).filter(s => s.teacherId === req.session.user.id);
  
  const studentMap = new Map();
  allStudents.forEach(student => {
    studentMap.set(student.id, {
      enrollmentNo: student.enrollmentNo || 'N/A',
      name: student.name
    });
  });
  
  const resultsByStudent = new Map();
  results.forEach(result => {
    resultsByStudent.set(result.studentId, result);
  });
  
  const sectionData = [];
  
  if (allSections.length === 0) {
    sectionData.push({
      id: 'no_sections',
      name: 'No Sections Created',
      results: [],
      pending: [],
      submittedCount: 0,
      pendingCount: 0,
      totalCount: 0
    });
  } else {
    allSections.forEach(section => {
      const studentsInSection = allStudents.filter(s => section.students.includes(s.id));
      const sectionResults = studentsInSection
        .map(student => {
          const result = resultsByStudent.get(student.id);
          if (result) {
            return {
              ...result,
              studentEnrollment: student.enrollmentNo || 'N/A',
              studentSection: section.name
            };
          }
          return null;
        })
        .filter(r => r !== null);
      
      const submittedIds = sectionResults.map(r => r.studentId);
      const pendingStudents = studentsInSection.filter(s => !submittedIds.includes(s.id));
      
      sectionData.push({
        id: section.id,
        name: section.name,
        results: sectionResults,
        pending: pendingStudents,
        submittedCount: sectionResults.length,
        pendingCount: pendingStudents.length,
        totalCount: studentsInSection.length
      });
    });
  }
  
  if (!test) return res.redirect('/teacher/dashboard');
  
  // Log to console for debugging
  console.log('=== RESULTS ROUTE DEBUG ===');
  console.log('sectionData length:', sectionData.length);
  console.log('sectionData:', JSON.stringify(sectionData, null, 2));
  
  res.render('teacher/results', { 
    user: req.session.user, 
    test, 
    results: results,
    students: allStudents,
    sections: allSections,
    sectionData: sectionData
  });
});

router.get('/evaluate/:testId/:studentId', isTeacher, (req, res) => {
  const test = read(TESTS).find(t => t.id === req.params.testId);
  const result = read(RESULTS).find(r => r.testId === req.params.testId && r.studentId === req.params.studentId);
  if (!test || !result) return res.redirect('/teacher/dashboard');
  res.render('teacher/evaluate', { user: req.session.user, test, result });
});

router.post('/evaluate/:testId/:studentId', isTeacher, (req, res) => {
  const results = read(RESULTS);
  const tests = read(TESTS);
  const idx = results.findIndex(r => r.testId === req.params.testId && r.studentId === req.params.studentId);
  if (idx === -1) return res.redirect('/teacher/dashboard');
  const test = tests.find(t => t.id === req.params.testId);
  const result = results[idx];
  let totalAwarded = 0;
  result.answers = result.answers.map(a => {
    const awarded = parseFloat(req.body[`awarded_${a.qId}`]) || 0;
    const clamped = Math.min(awarded, test.questions.find(q => q.id === a.qId).marks);
    totalAwarded += clamped;
    return { ...a, awarded: clamped };
  });
  result.score = totalAwarded;
  result.percent = Math.round((totalAwarded / result.totalMarks) * 100);
  result.teacherComment = (req.body.comment || '').trim();
  result.status = 'evaluated';
  result.evaluatedAt = new Date().toLocaleString();
  write(RESULTS, results);
  res.redirect(`/teacher/results/${req.params.testId}`);
});

router.post('/comment/:testId/:studentId', isTeacher, (req, res) => {
  const results = read(RESULTS);
  const idx = results.findIndex(r => r.testId === req.params.testId && r.studentId === req.params.studentId);
  if (idx !== -1) {
    results[idx].teacherComment = (req.body.comment || '').trim();
    write(RESULTS, results);
  }
  res.redirect(`/teacher/results/${req.params.testId}`);
});

module.exports = router;