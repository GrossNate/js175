const HTTP = require("http");
const { URL } = require("url");
const HANDLEBARS = require("handlebars");
const { LoanTerms, LoanCalculator } = require("./loan_classes");

const PORT = 3000;
const APR = 0.05;
const percentFormat = new Intl.NumberFormat(
  "en-US",
  { style: "percent", minimumFractionDigits: 2 },
);
const currencyFormat = new Intl.NumberFormat(
  "en-US",
  { style: "currency", currency: "USD" },
);
const currencyWholeFormat = new Intl.NumberFormat(
  "en-US",
  { style: "currency", currency: "USD", maximumFractionDigits: 0 },
);
const ERROR_MESSAGE_400 = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Error: Malformed Request</title>
  <style type="text/css">
    article {color: red; font-size: 2rem; }
  </style>
</head>
<body>
  <article>
    You need to send both an <code>amount</code> and a <code>duration</code> in
    order to calculate a monthly payment.
  </article>
</body>
</html>
`;
const unitFormat = new Intl.NumberFormat("en-US");
const RAW_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Loan Calculator</title>
    <style type="text/css">
      body {
        background: rgba(250, 250, 250);
        font-family: sans-serif;
        color: rgb(50, 50, 50);
      }

      article {
        width: 100%;
        max-width: 40rem;
        margin: 0 auto;
        padding: 1rem 2rem;
      }

      h1 {
        font-size: 2.5rem;
        text-align: center;
      }

      table {
        font-size: 1.5rem;
      }
      th {
        text-align: right;
      }
      td {
        text-align: center;
      }
      th,
      td {
        padding: 0.5rem;
      }
    </style>
  </head>
  <body>
    <article>
      <h1>Loan Calculator</h1>
      <table>
        <tbody>
          <tr>
            <th>Amount:</th>
            <td>
              <a href="{{amountDecrement.url}}">{{amountDecrement.label}}</a>
            </td>
            <td>{{amount}}</td>
            <td>
              <a href="{{amountIncrement.url}}">{{amountIncrement.label}}</a>
            </td>
          </tr>
          <tr>
            <th>Duration:</th>
            <td>
              <a href="{{durationDecrement.url}}">{{durationDecrement.label}}</a>
            </td>
            <td>{{duration}} years</td>
            <td>
              <a href="{{durationIncrement.url}}">{{durationIncrement.label}}</a>
            </td>
          </tr>
          <tr>
            <th>APR:</th>
            <td><a href="{{aprDecrement.url}}">{{aprDecrement.label}}</a></td>
            <td>{{apr}}</td>
            <td><a href="{{aprIncrement.url}}">{{aprIncrement.label}}</a></td>
          </tr>
          <tr>
            <th>Monthly payment:</th>
            <td colspan='3'>{{payment}}</td>
          </tr>
        </tbody>
      </table>
    </article>
  </body>
</html>
`;
// const LOAN_OFFER_TEMPLATE = HANDLEBARS.compile(RAW_TEMPLATE);

function render(template, data) {
  return HANDLEBARS.compile(template)(data);
}

function getParams(path, host) {
  const myUrl = new URL(path, `http://${host}`);
  return myUrl.searchParams;
}

function generateChangeLink(terms, paramToChange, delta) {
  const newTerms = { ...terms };
  newTerms[paramToChange] += delta;
  let formatter;
  if (paramToChange === "amount") {
    formatter = currencyWholeFormat;
  } else if (paramToChange === "periodYears") {
    formatter = unitFormat;
  } else {
    formatter = percentFormat;
  }
  return {
    url:
      `/?amount=${newTerms.amount}&duration=${newTerms.periodYears}&apr=${newTerms.apr}`,
    label: `${(delta > 0) ? "+" : "-"}${formatter.format(Math.abs(delta))}`,
  };
}

function generateLoanOfferData(terms) {
  const calculator = new LoanCalculator(terms);
  let data = {};
  data.amountDecrement = generateChangeLink(terms, "amount", -100);
  data.amount = currencyWholeFormat.format(terms.amount);
  data.amountIncrement = generateChangeLink(terms, "amount", 100);
  data.durationDecrement = generateChangeLink(terms, "periodYears", -1);
  data.duration = terms.periodYears;
  data.durationIncrement = generateChangeLink(terms, "periodYears", 1);
  data.aprDecrement = generateChangeLink(terms, "apr", -0.0025);
  data.apr = percentFormat.format(terms.apr);
  data.aprIncrement = generateChangeLink(terms, "apr", 0.0025);
  data.payment = currencyFormat.format(calculator.getMonthlyPayment());
  return data;
}

const SERVER = HTTP.createServer((req, res) => {
  const path = req.url;
  const { host } = req.headers;
  const params = getParams(path, host);

  if (path === "/favicon.ico") {
    res.statusCode = 404;
    res.end();
  } else {
    const terms = new LoanTerms(
      Number(params.get("amount")),
      Number(params.get("duration")),
      Number(params.get("apr")) || APR,
    );
    if (terms.amount && terms.periodYears) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      res.write(
        render(RAW_TEMPLATE, generateLoanOfferData(terms)),
      );
    } else {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/html");
      res.write(ERROR_MESSAGE_400);
    }
    // res.write('<!doctype html>');
    // res.write('<html><head>');
    // res.write(`<title>${generatePageTitle()}</title>`);
    // res.write('<style type="text/css"> th {text-align: right;}</style>');
    // res.write('</head><body>');
    // res.write(generateLoanTermsHtmlTable(getParams(path, host)));
    // res.write('</body></html>');
    res.end();
  }
});

SERVER.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
