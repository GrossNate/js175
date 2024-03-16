const express = require('express');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');
const session = require('express-session');
const store = require('connect-loki');
const flash = require('express-flash');

const app = express();
const LokiStore = store(session);

const contactData = [
  {
    firstName: 'Mike',
    lastName: 'Jones',
    phoneNumber: '281-330-8004',
  },
  {
    firstName: 'Jenny',
    lastName: 'Keys',
    phoneNumber: '768-867-5309',
  },
  {
    firstName: 'Max',
    lastName: 'Entiger',
    phoneNumber: '214-748-3647',
  },
  {
    firstName: 'Alicia',
    lastName: 'Keys',
    phoneNumber: '515-489-4608',
  },
];

const sortContacts = (contacts) => contacts.slice().sort((contactA, contactB) => {
  if (contactA.lastName < contactB.lastName) {
    return -1;
  }
  if (contactA.lastName > contactB.lastName) {
    return 1;
  }
  if (contactA.firstName < contactB.firstName) {
    return -1;
  }
  if (contactA.firstName > contactB.firstName) {
    return 1;
  }
  return 0;
});

const validateName = (name, whichName) => body(name)
  .trim()
  .isLength({ min: 1 })
  .withMessage(`${whichName} is required.`)
  .bail()
  .isLength({ max: 25 })
  .withMessage(`${whichName} is too long. Maximum length is 25 characters.`)
  .isAlpha()
  .withMessage(
    `${whichName} contains invalid characters. The name must be alphabetic.`,
  );

const clone = (object) => JSON.parse(JSON.stringify(object));

app.set('views', './views');
app.set('view engine', 'pug');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('common'));

app.use(
  session({
    cookie: {
      httpOnly: true,
      maxAge: 31 * 24 * 60 * 60 * 1000,
      path: '/',
      secure: false,
    },
    name: 'launch-school-contacts-manager-session-id',
    resave: false,
    saveUninitialized: true,
    secret: 'this is not very secure',
    store: new LokiStore({}),
  }),
);
app.use(flash());

app.use((req, res, next) => {
  if (!('contactData' in req.session)) {
    req.session.contactData = clone(contactData);
  }
  next();
});

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

app.get('/', (_, res) => {
  res.redirect('/contacts');
});

app.get('/contacts/new', (_, res) => {
  res.render('new-contact', {
    userInput: { firstName: null, lastName: null, phoneNumber: null },
  });
});

app.post(
  '/contacts/new',
  [
    validateName('firstName', 'First name'),
    validateName('lastName', 'Last name'),
    body('phoneNumber')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Phone number is required.')
      .bail()
      .matches(/^\d{3}-\d{3}-\d{4}$/)
      .withMessage('Invalid phone number format. Use ###-###-####.'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(error => req.flash("error", error.msg));
      res.render('new-contact', {
        flash: req.flash(),
        userInput: req.body,
      });
    } else {
      next();
    }
  },
  (req, res) => {
    req.session.contactData.push({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phoneNumber: req.body.phoneNumber,
    });
    req.flash('success', 'New contact added to list!');
    res.redirect('/contacts');
  },
);

app.get('/contacts', (req, res) => {
  res.render('contacts', {
    contacts: sortContacts(req.session.contactData),
  });
});

app.listen(3000, 'localhost', () => {
  console.log('Listening to port 3000');
});
