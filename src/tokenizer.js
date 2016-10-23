import Token from "./token.js";

class Tokenizer {

    /**
     * Initialize buffer and token array
     */
    initialize() {
        this.buffer = "";
        this.tokens = [];
    }

    /**
     * Buffer write
     */
    write(char) {
        this.buffer += char;
    }

    /** 
     * Buffer flush
     */
    flush() {
        if (this.buffer.length > 0) {
            let type = this.identify(this.buffer);
            this.tokens.push(new Token(type, this.buffer));
            this.buffer = "";
        }
    }

    /** 
     * Remove/unify unsupported characters.
     */
    purify(text) {

        // Unify whitespace formats
        text = text.replace(/\s/g, " ");

        return text;
    }

    /**
     * Identify token type
     */
    identify(data) {
        if (data == "(") return Token.OPEN;
        else if (data == ")") return Token.CLOSE;
        else if (!isNaN(data)) return Token.NUMBER;
        else if (data.charAt(0) == "\"" || data.charAt(0) == "\'") return Token.STRING;
        else return Token.ID;
    }

    /**
     * Split code by syllables
     */
    tokenize(text) {

        this.initialize();

        // Purify
        text = this.purify(text);

        // Space flags
        let spaceFlag = false;

        // String flags
        let stringOpened = false;
        let stringOpener = "";

        for (let i in text) {

            let char = text.charAt(i);

            // Space is delimiter
            if (char == " " && !stringOpened) {
                if (!spaceFlag) {
                    spaceFlag = true;
                    this.flush();
                }
                // Space is non-insertive
                continue;
            } else {
                spaceFlag = false;
            }

            // Parens as delemiter
            if ((char == "(" || char == ")") && !stringOpened) {
                if (char == "(") {
                    this.write(char);
                    this.flush();
                } else {
                    this.flush();
                    this.write(char);
                }
                continue;
            }

            // Bundle up strings as delimiter
            if (char == "\"" || char == "\'") {

                // String open
                if (!stringOpened) {
                    stringOpener = char;
                    stringOpened = true;
                    this.flush();
                    this.write(char);
                    continue;
                }
                // String close
                else if (stringOpener == char) {
                    stringOpened = false;
                    this.write(char);
                    this.flush();
                    continue;
                }
            }

            // Write buffer
            this.write(char);
        }
        // Last flush
        this.flush();

        return this.tokens;
    }

}

export default Tokenizer;