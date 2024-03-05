const HTTP = require("http");
const PORT = 3000;
const URL = require("url").URL;

class Die {
  #sides;
  constructor(sides) {
    this.#sides = sides;
  }
  roll() {
    return Math.ceil(Math.random() * this.#sides);
  }
}

const SERVER = HTTP.createServer((req, res) => {
  let method = req.method;
  let path = req.url;

  if (path === "/favicon.ico") {
    res.statusCode = 404;
    res.end();
  } else {
    let host = `http://${req.headers.host}`;
    let myURL = new URL(path, host);
    let params = myURL.searchParams;
    let dieSides = Number(params.get("sides")) || 6;
    let rolls = Number(params.get("rolls")) || 1;
    const die = new Die(dieSides);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html");
    res.write("<html><head></head><body>");
    for (let x = 0; x < rolls; x += 1) {
      res.write(`<h1>${die.roll()}</h1>`);
    }
    res.write(`<p>${method} ${path}</p>`);
    res.write("</body></html>");
    res.end();
  }
});

SERVER.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
