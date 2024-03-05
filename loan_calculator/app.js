const HTTP = require('http');
const { URL } = require('url');

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
const unitFormat = new Intl.NumberFormat('en-US');

function getParams(path, host) {
  const myUrl = new URL(path, `http://${host}`);
  return myUrl.searchParams;
}

class LoanTerms {
  constructor(amount, periodYears, apr) {
    this.amount = amount;
    this.periodYears = periodYears;
    this.apr = apr;
  }

  getPeriodMonths() {
    return this.periodYears * 12;
  }
}

class LoanCalculator {
  #terms;

  constructor(terms) {
    this.#terms = terms;
  }

  getMonthlyPayment() {
    const monthlyInterestRate = this.#terms.apr / 12;
    return (this.#terms.amount
      * (monthlyInterestRate
        / (1 - (1 + monthlyInterestRate) ** -this.#terms.getPeriodMonths())));
  }
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
  return '<a href="/?'
    + `amount=${newTerms.amount}`
    + `&duration=${newTerms.periodYears}`
    + `&apr=${newTerms.apr}`
    + `">${(delta > 0) ? '+' : '-'}`
    + `${formatter.format(Math.abs(delta))}`
    + '</a>';
}

function generateLoanTermsHtmlTable(params) {
  const terms = new LoanTerms(
    Number(params.get('amount')),
    Number(params.get('duration')),
    Number(params.get('apr')) || APR,
  );
  const calculator = new LoanCalculator(terms);
  if (!(terms.amount && terms.periodYears)) {
    return `You need to send both an <code>amount</code> and a
        <code>duration</code> in order to calculate a monthly payment.`;
  }
  return `
      <table>
        <tbody>
        <tr>
          <th>Amount:</th>
          <td>${generateChangeLink(terms, 'amount', -100)}</td>
          <td>${currencyWholeFormat.format(terms.amount)}</td>
          <td>${generateChangeLink(terms, 'amount', 100)}</td>
        </tr>
        <tr>
          <th>Duration:</th>
          <td>${generateChangeLink(terms, 'periodYears', -1)}</td>
          <td>${terms.periodYears}</td>
          <td>${generateChangeLink(terms, 'periodYears', 1)}</td>
        </tr>
        <tr>
          <th>APR:</th>
          <td>${generateChangeLink(terms, 'apr', -0.0025)}</td>
          <td>${percentFormat.format(terms.apr)}</td>
          <td>${generateChangeLink(terms, 'apr', 0.0025)}</td>
        </tr>
        <tr>
          <th>Monthly payment:</th>
          <td colspan="3">${currencyFormat.format(calculator.getMonthlyPayment())}</td>
        </tr>
        </tbody>
      </table>
      `;
}

function generatePageTitle() {
  return 'Loan Calculator';
}

const SERVER = HTTP.createServer((req, res) => {
  const path = req.url;
  const { host } = req.headers;

  if (path === '/favicon.ico') {
    res.statusCode = 404;
    res.end();
  } else {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.write('<!doctype html>');
    res.write('<html><head>');
    res.write(`<title>${generatePageTitle()}</title>`);
    res.write('<style type="text/css"> th {text-align: right;}</style>');
    res.write('</head><body>');
    res.write(generateLoanTermsHtmlTable(getParams(path, host)));
    res.write('</body></html>');
    res.end();
  }
});

SERVER.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
