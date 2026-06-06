# Online Examination System

A comprehensive web-based examination system built with Node.js and Express.js supporting multiple question types, flexible evaluation modes, and role-based access control for teachers and students.

## Features

### Teacher Module
- Create tests with custom duration and total marks
- Add questions dynamically with support for five question types
- Assign tests to specific students
- Choose between automatic and manual correction modes
- Evaluate student submissions with per-question marking
- Provide feedback comments on student performances
- View test results and track pending evaluations

### Student Module
- View assigned tests on personalized dashboard
- Attempt tests with timed sessions
- Experience question-type specific input interfaces
- Receive instant results for automatically corrected tests
- View evaluated results with teacher feedback

### Question Types Supported
- **Single Correct**: Multiple choice with one correct answer (Radio buttons)
- **Multiple Correct**: Multiple choice with several correct answers (Checkboxes)
- **Fill in the Blank**: Single word or phrase to complete a sentence (Text input)
- **One Line Answer**: Short answer requiring brief response (Text input)
- **Paragraph Answer**: Detailed descriptive answer (Textarea)

### Modern UI Features
- Role-based dashboards for teachers and students
- Timer display during test attempts
- Responsive design for desktop and mobile
- Clean result display with pass/fail indicators
- Comment section for teacher feedback

## Tech Stack

### Backend
| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Web Framework | Express.js |
| Template Engine | EJS |
| Session Management | express-session |
| Data Persistence | JSON file system |
| Unique IDs | UUID |

### Frontend
| Component | Technology |
|-----------|------------|
| Structure | HTML5 |
| Styling | CSS3 |
| Interactivity | JavaScript ES6 |
| Icons | Font Awesome |

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/exam-system.git
cd exam-system
