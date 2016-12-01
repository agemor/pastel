import Token from "./token.js";

class Lexer {

    constructor() {
        this.defineStates();
    }

    /**
     * Define State-Transference machine for lexical analysis
     */
    defineStates() {

        // Acquisition lambdas
        let queue = i => { return this.text.charAt(i) };
        let store = c => { this.buffer += c };
        let flush = t => {
          if (this.buffer.length > 0) {

            // Special treatment for id tokens that contain only numbers
            let numberToken = (t == Token.ID && !isNaN(this.buffer));
            this.list.push(new Token(numberToken ? Token.NUMBER : t, this.buffer, line));
          }
          this.buffer = '';
        }

        // Line number updater
        let line = 0;
        let newline = i => { line++; };

        // State definitions
        let state = {

            // Transference function
            transference: (i) => {
                if (i < this.text.length)
                    state.identifier(i);
                else flush(Token.ID);
            },

            // For IDs
            identifier: (i, phase) => {
                let c = queue(i);

                switch (c) {
                  case '\"':
                  case '\'':
                      flush(Token.ID);
                      state.string(i + 1, c);
                      return;
                  case '\\':
                      flush(Token.ID);
                      state.extension(i);
                      return;
                  case ' ':
                  case ';':
                      flush(Token.ID);
                      state.delimiter(i);
                      return;
                  case '#':
                      flush(Token.ID);
                      state.comment(i + 1);
                      return;
                  case '(':
                  case ')':
                      flush(Token.ID);
                      state.parenthesis(i, c);
                      return;
                  default:
                      store(c);
                      state.transference(i + 1);
                }
            },

            // For strings
            string: (i, phase) => {
                let c = queue(i);

                switch (c) {
                  case phase:
                      flush(Token.STRING);
                      state.transference(i + 1, c);
                      return;
                  case '\\':
                      state.extension(i + 1);
                      return;
                  default:
                      store(c);
                      state.string(i + 1, c);
                }
            },

            // For escape characters
            extension: (i, phase) => {
                let c = queue(i);

                store('\\' + c);
                state.transference(i + 1);
            },

            // For comments
            comment: (i, phase) => {
                let c = queue(i);

                switch (c) {
                  case ';':
                      newline();
                      flush(Token.COMMENT);
                      state.transference(i + 1);
                      return;
                  default:
                      store(c);
                      state.comment(i + 1);
                }
            },

            // For parenthesis
            parenthesis: (i, phase) => {
                let c = queue(i);

                store(c);
                if (phase == '(') flush(Token.OPEN);
                else if (phase == ')') flush(Token.CLOSE);
                state.transference(i + 1);
            },

            // For whitespaces and linefeeds
            delimiter: (i, phase) => {
                let c = queue(i);

                switch (c) {
                  case ';':
                      newline();
                  case ' ':
                      store(c);
                      state.delimiter(i + 1);
                      return;
                  default:
                      flush(Token.SPACE);
                      state.transference(i);
                }
            }
        }
        this.state = state;
    }

    /**
     * Split code by syllables
     */
    analyze(text) {
        this.text = this.purify(text);
        this.list = [];
        this.buffer = '';
        this.state.transference(0);

        return this.list;
    }

    /**
     * Remove/unify unsupported characters.
     */
    purify(text) {

        // Unify newline formats
        text = text.replace(/(?:\r\n|\r|\n)/g, ';');

        // Unify whitespace formats
        text = text.replace(/\s/gi, " ");

        return text;
    }
}

export default Lexer;
