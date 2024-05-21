"use strict";

const Birra = require("./common.js");

class BirraLexer {
	reset(src) {
		this.src = src;
		this.srcPtr = 0;
		this.lastLine = "";
		this.currRow = 1;
		this.currColumn = 1;
		this.currChar = src.charAt(0) ?? "\0";
		this.tokens = [];
	}

	errorAtCurrLine(msg) {
		console.error(this.lastLine);
		console.error(" ".repeat(this.currColumn - 1) + "^");
		console.error("");
		console.error(msg, "at", this.currRow + ":" + this.currColumn);
		return -1;
	}

	next() {
		if(this.srcPtr >= this.src.length) return -1;

		const c = this.src.charAt(this.srcPtr);
		this.srcPtr++;

		if(c === "\n") {
			this.currRow++;
			this.currColumn = 1;
			this.lastLine = "";
			this.currChar = c;
			return 0;
		}

		this.currColumn++;
		this.lastLine = (this.lastLine + c).slice(-40);
		this.currChar = c;
		return 0;
	}

	back() {
		this.srcPtr--;
		if(this.srcPtr < 0) return -1;
		if(this.currColumn > 1) this.currColumn--;

		this.currChar = this.src.charAt(this.srcPtr);
		this.lastLine = (this.lastLine + c).slice(0, -1);

		return 0;
	}

	isWhitespace(character = this.currChar) {
		return ((character.charCodeAt(0) <= 0x20) || (character.charCodeAt(0) === 0x7f));
	}

	isNumber(character = this.currChar) {
		// Between '0' and '9', or '.'.
		return	(((character.charCodeAt(0) >= 0x30) &&
				(character.charCodeAt(0) <= 0x39)) ||
				(character === "."));
	}

	isVariable(character = this.currChar) {
		// Returns true if between '0' and '9',
		return	(((character.charCodeAt(0) >= 0x30) &&
				(character.charCodeAt(0) <= 0x39)) ||
				// '@' and 'Z',
				((character.charCodeAt(0) >= 0x40) &&
				(character.charCodeAt(0) <= 0x5a)) ||
				// 'a' and 'z',
				((character.charCodeAt(0) >= 0x61) &&
				(character.charCodeAt(0) <= 0x7a)) ||
				// or greater than [DEL] (may be UTF-8).
				(character.charCodeAt(0) > 0x7f));
	}

	isKeyword(s) {
		return Birra.KEYWORDS.includes(s);
	}

	readOperator(s = this.currChar) {
		return (Birra.OPERATORS[s] !== undefined);
	}

	readString(breaker) {
		let str = "";

		while(true) {
			if(this.currChar === breaker) break;
			if(this.currChar === "\0") {
				this.errorAtCurrLine("Unexpected EOF while in string declaration");
				return -1;
			}

			str += this.currChar;
			this.next();
		}

		this.next();

		return str;
	}

	readNumber() {
		let no = "";

		while(true) {
			if(this.isNumber()) {
				if(c === "." && no.includes(".")) {
					this.errorAtCurrLine("Unexpected '.' in number declaration");
					return -1;
				}

				no += c;
				this.next();
				continue;
			}

			if((this.currChar === "x") && (no === "0")) {
				no += c;
				this.next();
				continue;
			}

			if((this.currChar === "b") && (no === "0")) {
				no += c;
				this.next();
				continue;
			}

			break;
		}

		return no;
	}

	readOperator() {
		let op = "";

		while(this.isOperator()) {
			if(this.isOperator(op + this.currChar)) {
				op += this.currChar;
				this.next();
			}

			break;
		}

		return op;
	}

	readVariable() {
		let word = "";

		while(this.isVariable()) {
			word += this.currChar;
			this.next();
		}

		return word;
	}

	parse(src) {
		this.reset(src);

		// [TODO] Comments.
		let onComment = false, comment = "";

		while(this.currChar !== "\0") {
			if(this.isWhitespace()) {
				this.next();
				continue;
			}

			if((this.currChar === "\"") || (this.currChar === "'")) {
				const breaker = this.currChar;
				this.next();

				const str = this.readString(breaker);
				if(str === -1) return -1;

				this.tokens.push({
					type: "STRING",
					value: str,
				});

				continue;
			}

			if(this.isNumber()) {
				const no = this.readNumber();
				
				this.tokens.push({
					type: (no === ".") ? "OPERATOR" : "NUMBER",
					value: no,
				});

				continue;
			}

			if(this.isOperator()) {
				const op = this.readOperator();

				this.tokens.push({
					type: "OPERATOR",
					value: op,
				});

				continue;
			}

			const variable = this.readVariable();

			this.tokens.push({
				type: this.isKeyword(variable) ? "KEYWORD" : "VARIABLE",
				value: variable,
			});

			continue;
		}
	}
}

module.exports = BirraLexer;
