const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const path       = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'examSecret2024',
  resave: false,
  saveUninitialized: false
}));

app.use('/',        require('./routes/authRoutes'));
app.use('/teacher', require('./routes/teacherRoutes'));
app.use('/student', require('./routes/studentRoutes'));

app.listen(3000, () => console.log('✅  Server running → http://localhost:3000'));