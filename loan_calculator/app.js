const HTTP = require('http');
const { URL } = require('url');
const HANDLEBARS = require('handlebars');
const FS = require('fs');
const PATH = require('path');
const QUERYSTRING = require('querystring');
const { LoanTerms, LoanCalculator } = require('./loan_classes');

const MIME_TYPES = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const PORT = 3000;
const APR = 0.05;
const percentFormat = new Intl.NumberFormat(
  'en-US',
  { style: 'percent', minimumFractionDigits: 2 },
);
const currencyFormat = new Intl.NumberFormat(
  'en-US',
  { style: 'currency', currency: 'USD' },
);
const currencyWholeFormat = new Intl.NumberFormat(
  'en-US',
  { style: 'currency', currency: 'USD', maximumFractionDigits: 0 },
);
const ERROR_MESSAGE_400 = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Error: Malformed Request</title>
  <link rel="stylesheet" href="/assets/css/styles.css">
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
const unitFormat = new Intl.NumberFormat('en-US');
const RAW_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Loan Calculator</title>
    <link rel="stylesheet" href="/assets/css/styles.css">
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
              <a href="{{durationDecrement.url}}">
                {{durationDecrement.label}}
              </a>
            </td>
            <td>{{duration}} years</td>
            <td>
              <a href="{{durationIncrement.url}}">
                {{durationIncrement.label}}
              </a>
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
const LOAN_FORM_SOURCE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Loan Calculator</title>
    <link rel="stylesheet" href="/assets/css/styles.css">
  </head>
  <body>
    <article>
      <h1>Loan Calculator</h1>
      <form action="/loan-offer" method="post">
        <p>All loans are offered at an APR of {{apr}}%.</p>
        <label for="amount">How much do you want to borrow (in dollars)?</label>
        <input type="number" name="amount" id="amount" value="">
        <label for="duration">
          How much time do you want to pay back your loan?
        </label>
        <input type="number" name="duration" id="duration" value="">
        <input type="submit" name="" value="Get loan offer!">
      </form>
    </article>
  </body>
</html>
`;
function render(template, data) {
  return HANDLEBARS.compile(template)(data);
}

function getParams(path, host) {
  const myUrl = new URL(path, `http://${host}`);
  return myUrl.searchParams;
}

function getParsedFormDataPromise(request) {
  return new Promise((resolve) => {
    let body = '';
    request
      .on('data', (chunk) => {
        body += chunk.toString();
      })
      .on('end', () => resolve(QUERYSTRING.parse(body)));
  });
}

function getPathname(path, host) {
  const myUrl = new URL(path, `http://${host}`);
  return myUrl.pathname;
}

function generateChangeLink(terms, paramToChange, delta) {
  const newTerms = { ...terms };
  newTerms[paramToChange] += delta;
  let formatter;
  if (paramToChange === 'amount') {
    formatter = currencyWholeFormat;
  } else if (paramToChange === 'periodYears') {
    formatter = unitFormat;
  } else {
    formatter = percentFormat;
  }
  return {
    url:
      `/loan-offer?amount=${newTerms.amount}`
      + `&duration=${newTerms.periodYears}`
      + `&apr=${newTerms.apr}`,
    label: `${(delta > 0) ? '+' : '-'}${formatter.format(Math.abs(delta))}`,
  };
}

function generateLoanOfferData(terms) {
  const calculator = new LoanCalculator(terms);
  const data = {};
  data.amountDecrement = generateChangeLink(terms, 'amount', -100);
  data.amount = currencyWholeFormat.format(terms.amount);
  data.amountIncrement = generateChangeLink(terms, 'amount', 100);
  data.durationDecrement = generateChangeLink(terms, 'periodYears', -1);
  data.duration = terms.periodYears;
  data.durationIncrement = generateChangeLink(terms, 'periodYears', 1);
  data.aprDecrement = generateChangeLink(terms, 'apr', -0.0025);
  data.apr = percentFormat.format(terms.apr);
  data.aprIncrement = generateChangeLink(terms, 'apr', 0.0025);
  data.payment = currencyFormat.format(calculator.getMonthlyPayment());
  return data;
}

function respondIndex(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.write(render(LOAN_FORM_SOURCE, { apr: '5' }));
  res.end();
}

function generateLoanOfferResponse(res, terms) {
  if (terms.amount && terms.periodYears) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.write(
      render(RAW_TEMPLATE, generateLoanOfferData(terms)),
    );
  } else {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html');
    res.write(ERROR_MESSAGE_400);
  }
  res.end();
}

function respondLoanOfferGet(res, path, host) {
  const params = getParams(path, host);
  const terms = new LoanTerms(
    Number(params.get('amount')),
    Number(params.get('duration')),
    Number(params.get('apr')) || APR,
  );
  generateLoanOfferResponse(res, terms);
}

async function respondLoanOfferPost(req, res) {
  const query = await getParsedFormDataPromise(req);
  const terms = new LoanTerms(
    Number(query.amount),
    Number(query.duration),
    Number(query.apr) || APR,
  );
  generateLoanOfferResponse(res, terms);
}

const SERVER = HTTP.createServer((req, res) => {
  const path = req.url;
  const { host } = req.headers;
  const pathname = getPathname(path, host);
  const fileExtension = PATH.extname(pathname);
  const { method } = req;

  if (pathname === '/') {
    respondIndex(res);
  } else if (pathname === '/loan-offer' && method === 'GET') {
    respondLoanOfferGet(res, path, host);
  } else if (pathname === '/loan-offer' && method === 'POST') {
    respondLoanOfferPost(req, res);
  } else {
    FS.readFile(`./public/${pathname}`, (_, data) => {
      if (data) {
        res.statusCode = 200;
        res.setHeader('Content-Type', `${MIME_TYPES[fileExtension]}`);
        res.write(`${data}\n`);
        res.end();
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
  }
});

SERVER.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
