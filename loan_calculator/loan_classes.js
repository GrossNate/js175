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

module.exports = {LoanTerms, LoanCalculator};
