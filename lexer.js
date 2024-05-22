"use strict";

const Birra = require("./common.js");

class BirraLexer {
	reset(src) {
		this.src = src;
		this.srcPtr = 0;
		this.currLine = src.split(/\n/g)[0];
		this.currRow = 1;
		this.currColumn = 1;
		this.currChar = src.charAt(0) ?? "\0";
		this.tokens = [];
	}

	errorAtCurrLine(msg) {
		console.error(this.currLine);
		console.error(" ".repeat(Math.max(this.currColumn - 1, 0)) + "^");
		console.error("");
		console.error(msg, "at", this.currRow + ":" + this.currColumn);
		return -1;
	}

	next() {
		if(this.srcPtr >= this.src.length) {
			this.currChar = "\0";
			return -1;
		}

		this.srcPtr++;
		this.currChar = this.src.charAt(this.srcPtr);

		const backCharacter = this.src.charAt(this.srcPtr - 1) ?? this.src.charAt(0);

		if(backCharacter === "\n") {
			this.currColumn = 1;
			this.currRow++;
		} else {
			this.currColumn++;
		}

		this.currLine = this.src.split(/\n/g)[this.currRow - 1];

		return 0;
	}

	back() {
		this.srcPtr--;
		if(this.srcPtr < 0) this.srcPtr = 0;

		this.currChar = this.src.charAt(this.srcPtr);

		if(this.currChar === "\n") {
			this.currRow--;
			this.currLine = this.src.split(/\n/g)[this.currRow - 1];
			this.currColumn = this.currLine.length - 1;
		} else {
			this.currColumn--;
		}

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

	isOperator(s = this.currChar) {
		return Birra.OPERATORS.includes(s);
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
				if(this.currChar === "." && no.includes(".")) {
					this.errorAtCurrLine("Unexpected '.' in number declaration");
					return -1;
				}

				no += this.currChar;
				this.next();
				continue;
			}

			if((this.currChar === "x") && (no === "0")) {
				no += this.currChar;
				this.next();
				continue;
			}

			if((this.currChar === "b") && (no === "0")) {
				no += this.currChar;
				this.next();
				continue;
			}

			break;
		}

		return no;
	}

	readOperator() {
		let op = "";

		while(this.isOperator(op + this.currChar)) {
			op += this.currChar;
			this.next();
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

		let isComment = false, commentCollection = "";

		while(this.currChar.charCodeAt(0)) {
			if(isComment !== false) {
				commentCollection = (commentCollection + this.currChar);
				commentCollection = commentCollection.slice(-(isComment.length));

				if(typeof isComment === "string") {
					if(commentCollection === isComment) {
						isComment = false;
						commentCollection = "";
					}
				} else {
					if(this.currChar === "\n") {
						isComment = false;
						commentCollection = "";
					}
				}

				this.next();
				continue;
			}
			
			if(this.isWhitespace()) {
				this.next();
				continue;
			}

			let commentStr = this.currChar;

			// Detect "#" comments.
			if(commentStr === "#") {
				isComment = true;
				continue;
			}

			this.next();
			commentStr += this.currChar;

			// Detect "/" comments.
			if(commentStr === "//") {
				isComment = true;
				continue;
			}

			// Detect "/*" comments.
			if(commentStr === "/*") {
				isComment = "*/";
				continue;
			}

			// Detect "--" coments.
			if(commentStr === "--") {
				this.next();
				commentStr += this.currChar;
				this.next();
				commentStr += this.currChar;

				// Detect "--[[" comments.
				if(commentStr === "--[[") {
					isComment = "--]]";
					continue;
				} else {
					this.back();
					this.back();
					isComment = true;
					continue;
				}
			}

			this.back();

			const row = this.currRow, column = this.currColumn;

			// Read string.
			if((this.currChar === "\"") || (this.currChar === "'")) {
				const breaker = this.currChar;
				this.next();

				const str = this.readString(breaker);
				if(str === -1) return -1;

				this.tokens.push({
					type: "STRING",
					value: str,
					row, column,
				});

				continue;
			}

			// Read number or dot operator.
			if(this.isNumber()) {
				const no = this.readNumber();
				
				this.tokens.push({
					type: (no === ".") ? "OPERATOR" : "NUMBER",
					value: no,
					row, column,
				});

				continue;
			}

			// Read operator.
			if(this.isOperator()) {
				const op = this.readOperator();

				this.tokens.push({
					type: "OPERATOR",
					value: op,
					row, column,
				});

				continue;
			}

			// Read variables/keywords.
			if(this.isVariable()) {
				const variable = this.readVariable();

				let type = "VARIABLE";
				if(this.isKeyword(variable)) {
					type = ((variable === "true") || (variable === "false"))
						? "BOOLEAN"
						: "KEYWORD";
				}

				this.tokens.push({
					type,
					value: variable,
					row, column,
				});

				continue;
			}

			this.errorAtCurrLine("Unexpected token '" + this.currChar + "' (" + this.currChar.charCodeAt(0) + ")");
			return -1;
		}

		this.tokens.push({
			type: "EOF",
			row: this.currRow, column: this.currColumn,
		});

		return this.tokens;
	}
}

module.exports = BirraLexer;
