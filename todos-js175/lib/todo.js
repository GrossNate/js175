const nextId = require("./next-id");

class Todo {
  static makeToDo(rawTodo) {
    return Object.assign(new Todo(), rawTodo);
  }

  constructor(title) {
    this.id = nextId();
    this.title = title;
    this.done = false;
  }

  toString() {
    let marker = this.isDone() ? Todo.DONE_MARKER : Todo.UNDONE_MARKER;
    return `[${marker}] ${this.title}`;
  }

  markDone() {
    this.done = true;
  }

  markUndone() {
    this.done = false;
  }

  isDone() {
    return this.done;
  }

  toggleDoneness() {
    if (this.isDone()) {
      this.markUndone();
    } else {
      this.markDone();
    }
  }

  setTitle(title) {
    this.title = title;
  }
}

Todo.DONE_MARKER = "X";
Todo.UNDONE_MARKER = " ";

module.exports = Todo;
