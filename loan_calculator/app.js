const HTTP = require('http');
const { URL } = require('url');
const HANDLEBARS = require('handlebars');
const QUERYSTRING = require('querystring');
const ROUTER = require('router');
const FINALHANDLER = require('finalhandler');
const SERVESTATIC = require('serve-static');
const { LoanTerms, LoanCalculator } = require('./loan_classes');

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

const router = ROUTER();
router.use(SERVESTATIC('public'));

router.get('/', (_, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.write(render(LOAN_FORM_SOURCE, { apr: APR }));
  res.end();
});

router.get('/loan-offer', (req, res) => {
  const params = getParams(req.url, req.headers.host);
  const terms = new LoanTerms(
    Number(params.get('amount')),
    Number(params.get('duration')),
    Number(params.get('apr')) || APR,
  );
  generateLoanOfferResponse(res, terms);
});

router.post('/loan-offer', async (req, res) => {
  const query = await getParsedFormDataPromise(req);
  const terms = new LoanTerms(
    Number(query.amount),
    Number(query.duration),
    Number(query.apr) || APR,
  );
  generateLoanOfferResponse(res, terms);
});

router.get('*', (_, res) => {
  res.statusCode = 404;
  res.end();
});

const SERVER = HTTP.createServer((req, res) => {
  router(req, res, FINALHANDLER(req, res));
});

SERVER.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
