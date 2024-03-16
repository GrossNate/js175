const express = require("express");
const morgan = require("morgan");

const app = express();

function spaceTrimmer(field) {
  return (req, res, next) => {
    req.body[field] = req.body[field].trim();
    next();
  };
}

function maxLength(field, label, max) {
  return (req, res, next) => {
    if (req.body[field].length > max) {
      res.locals.errorMessages.push(
        `${label} longer than maximum ${max} characters.`
      );
    }
    next();
  };
}

function alphaOnly(field, label) {
  return (req, res, next) => {
    if (req.body[field].match(/[^a-zA-Z]/)) {
      res.locals.errorMessages.push(
        `${label} can only contain alphabet characters.`
      );
    }
    next();
  };
}

function notBlank(field, label) {
  return (req, res, next) => {
    if (req.body[field].length === 0) {
      res.locals.errorMessages.push(`${label} is required.`);
    }
    next();
  };
}

const contactData = [
  {
    firstName: "Mike",
    lastName: "Jones",
    phoneNumber: "281-330-8004",
  },
  {
    firstName: "Jenny",
    lastName: "Keys",
    phoneNumber: "768-867-5309",
  },
  {
    firstName: "Max",
    lastName: "Entiger",
    phoneNumber: "214-748-3647",
  },
  {
    firstName: "Alicia",
    lastName: "Keys",
    phoneNumber: "515-489-4608",
  },
];

const sortContacts = (contacts) =>
  contacts.slice().sort((contactA, contactB) => {
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

app.set("views", "./views");
app.set("view engine", "pug");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(morgan("common"));

app.get("/", (_, res) => {
  res.redirect("/contacts");
});

app.get("/contacts/new", (_, res) => {
  res.render("new-contact", { userInput: { firstName: null, lastName: null, phoneNumber: null } });
});

app.post(
  "/contacts/new",
  (req, res, next) => {
    res.locals.errorMessages = [];
    next();
  },
  spaceTrimmer("firstName"),
  spaceTrimmer("lastName"),
  spaceTrimmer("phoneNumber"),
  alphaOnly("firstName", "First name"),
  alphaOnly("lastName", "Last name"),
  maxLength("firstName", "First name", 25),
  maxLength("lastName", "Last name", 25),
  notBlank("firstName", "First name"),
  notBlank("lastName", "Last name"),
  notBlank("phoneNumber", "Phone number"),
  (req, res, next) => {
    if (!req.body.phoneNumber.match(/\d{3}-\d{3}-\d{4}/)) {
      res.locals.errorMessages.push(
        "Phone number must be in the format ###-###-####"
      );
    }
    next();
  },
  (req, res, next) => {
    if (
      contactData.some(
        (contact) =>
          contact.firstName === req.body.firstName &&
          contact.lastName === req.body.lastName
      )
    ) {
      res.locals.errorMessages.push(
        "Same first name and last name already exist in contacts."
      );
    }
    next();
  },
  (req, res, next) => {
    if (res.locals.errorMessages.length > 0) {
      res.render("new-contact", {
        errorMessages: res.locals.errorMessages,
        userInput: req.body,
      });
    } else {
      next();
    }
  },
  (req, res) => {
    contactData.push({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phoneNumber: req.body.phoneNumber,
    });

    res.redirect("/contacts");
  }
);

app.get("/contacts", (_, res) => {
  res.render("contacts", {
    contacts: sortContacts(contactData),
  });
});

app.listen(3000, "localhost", () => {
  console.log("Listening to port 3000");
});
