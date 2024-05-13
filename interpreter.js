"use strict";
const VERSION = "0.1.0";

const fs = require("node:fs");

const processWrite = (...args) => process.stdout.write(...args);
const exit = process.exit;
let processOnStdin = () => {}; // Do this.

process.stdin.on("data", (buff) => processOnStdin(buff.toString("utf-8")));

const BIRRA_OPERATORS = [
	"=",
	"<",
	">",
	"<=",
	">=",
	"<>",
	"!=",

	",",
	":",
	";",

	"+",
	"-",
	"*",
	"/",
	"++",
	"--",
	"+=",
	"-=",
	"*=",
	"/=",

	"~",
	"&",
	"|",
	"^",
	"!",
	"&&",
	"||",
	"^^",
	"~=",
	"&=",
	"&&=",
	"|=",
	"||=",
	"^=",
	"^^=",

	"<<",
	">>",
	"<<=",
	">>=",

	"(",
	")",
	"[",
	"]",
	"{",
	"}",
];

class BirraLexer {
	errorAtLine(errStr) {
		if (!this.lastingLine) {
			console.error(
				errStr,
				this.tokenState.row + 1 + ":" + (this.tokenState.column + 1)
			);
			return -1;
		}

		console.error(this.lastingLine);
		console.error(" ".repeat(this.tokenState.column - 1) + "^");
		console.error("");
		console.error(
			errStr,
			"at",
			this.tokenState.row + 1 + ":" + (this.tokenState.column + 1)
		);

		return -1;
	}

	readCharacter() {
		if (this.tokenState.srcI >= this.tokenState.src.length) return "\0";

		const c = this.tokenState.src[this.tokenState.srcI];
		this.tokenState.srcI++;

		if (c === "\n") {
			this.tokenState.row++;
			this.lastTokensColumn = this.tokenState.column + 0;
			this.tokenState.column = 0;
			this.lastingLine = "";
			return c;
		}

		this.tokenState.column++;
		this.lastTokensColumn = this.tokenState.column;

		this.lastingLine = (
			(this.lastingLine ?? "") + (c === "\t" ? "    " : c)
		).slice(-2048);

		return c;
	}

	characterBack() {
		this.tokenState.srcI -= 1;
		if (this.tokenState.srcI < 0) this.tokenState.srcI = 0;

		this.tokenState.column = this.lastTokensColumn;
	}

	isWhitespace(c) {
		return c.charCodeAt(0) <= 0x20 || c.charCodeAt(0) === 0x7f;
	}

	isNumber(c) {
		return "0123456789.".split("").includes(c);
	}

	isOperator(c) {
		return BIRRA_OPERATORS.includes(c);
	}

	parseString(initialC) {
		let str = "",
			c = "";

		while (true) {
			c = this.readCharacter();
			if (c === initialC) break;

			if (c === "\0") {
				this.errorAtLine("Unexpected EOF while in string " + "declaration");
				return -1;
			}

			str += c;
		}

		this.tokens.push({
			type: "STRING",
			value: str,
		});

		return 0;
	}

	parseNumber(c) {
		let num = c,
			isDot = false;

		while (true) {
			c = this.readCharacter();

			if (this.isNumber(c)) {
				if (c === "." && num.includes(".")) {
					this.errorAtLine("Unexpected '.' in number " + "declaration");
					return -1;
				}

				num += c;
				continue;
			}

			if (num === ".") {
				isDot = true;
				this.characterBack();
				break;
			}

			if (c === "x" || c === "b") {
				if (num !== "0") {
					this.errorAtLine("Unexpected '" + c + "' in " + "number declaration");
					return -1;
				}

				num += c;
				continue;
			}

			this.characterBack();
			break;
		}

		if (isDot) {
			this.tokens.push({
				type: "OPERATOR",
				value: ".",
			});
			return 0;
		}

		this.tokens.push({
			type: "NUMBER",
			value: num,
		});
		return 0;
	}

	parseOperator(c) {
		let op = c;

		while (true) {
			c = this.readCharacter();

			if (c === "\0") {
				this.errorAtLine("Unexpected EOF while in operator " + "declaration");
				return -1;
			}

			if (this.isOperator(op + c)) {
				op += c;
			} else {
				this.characterBack();
				break;
			}
		}

		this.tokens.push({
			type: "OPERATOR",
			value: op,
		});

		return 0;
	}

	parseKeyword(c) {
		let word = c;

		while (true) {
			c = this.readCharacter();

			if (this.isWhitespace(c)) break;
			if (c === ".") {
				this.characterBack();
				break;
			}

			if (this.isOperator(c) || c === '"' || c === "'") {
				this.characterBack();
				break;
			}

			word += c;
		}

		this.tokens.push({
			type: "KEYWORD",
			value: word,
		});

		return 0;
	}

	parse(src) {
		this.tokenState = {
			eof: false,
			src,
			srcI: 0,
			row: 0,
			column: 0,
		};

		this.tokens = [];

		let c = "\0",
			onComment = false,
			onMultilineComment = false,
			lastCommentThingy = "";

		while (this.tokenState.eof === false) {
			c = this.readCharacter();
			if (c === "\0") break;

			if (onMultilineComment !== false) {
				lastCommentThingy = (lastCommentThingy + c).slice(-8);

				if (lastCommentThingy.endsWith(onMultilineComment)) {
					lastCommentThingy = "";
					onMultilineComment = false;
				}

				continue;
			}

			if (onComment) {
				if (c === "\n") onComment = false;
				continue;
			}

			if (this.isWhitespace(c)) continue;

			// Detect "#" single-line comments.
			if (c === "#") {
				onComment = true;
				continue;
			}

			// Detect "//" single-line coments.
			if (c === "/") {
				const nextC = this.readCharacter();

				if (nextC === "/") {
					onComment = true;
					continue;
				}
				this.characterBack();
			}

			// Detect "--" single-line coments.
			if (c === "-") {
				const nextC = this.readCharacter();

				if (nextC === "-") {
					onComment = true;
					continue;
				}
				this.characterBack();
			}

			// Detect "~~" single-line coments.
			if (c === "~") {
				const nextC = this.readCharacter();

				if (nextC === "~") {
					onComment = true;
					continue;
				}
				this.characterBack();
			}

			// Detect "/*" multi-line comments.
			if (c === "/") {
				const nextC = this.readCharacter();

				if (nextC === "*") {
					onMultilineComment = "*/";
					continue;
				}
				this.characterBack();
			}

			// pure bs that doesn't work when refactored
			//      ^ did you understood the reference?
			if((c === '"') || (c === '\'')) {
				if(this.parseString(c) < 0)
					return -1;
			} else if(this.isNumber(c)) {
				if(this.parseNumber(c) < 0)
					return -1;
			} else if(this.isOperator(c)) {
				if(this.parseOperator(c) < 0)
					return -1;
			} else {
				if(this.parseKeyword(c) < 0)
					return -1;
			}
		}

		this.tokens.push({
			type: "EOF",
			value: this.tokenState.row + 1 + ":" + (this.tokenState.column + 1),
		});

		return this.tokens;
	}

	printLexerTokens(tokens) {
		if (tokens < 0) return -1;

		for (const token of tokens) {
			console.log(token.type.padStart(8, " ") + ": " + token.value);
		}
	}
}

class BirraParser {
	parse(tokens) {}
}

function handleScriptFile(scriptFile, scriptArgv) {
	fs.readFile(scriptFile, (err, buff) => {
		if (err) {
			console.error("Couldn't read the script:", err);
			return exit(1);
		}

		const birra = new BirraLexer();
		const tokens = birra.parse(buff.toString("utf-8"));

		birra.printLexerTokens(tokens);
	});
}

class BirraREPL {
	static endl = "\n";
	static handle() {
		const birra = new BirraLexer();

		BirraREPL.showWelcome();
		BirraREPL.showInput();

		processOnStdin = (str) => {
			const tokens = birra.parse(str);
			birra.printLexerTokens(tokens);

			BirraREPL.showInput();
		};

		return birra;
	}

	static showWelcome() {
		processWrite("BirraScript " + VERSION + " 🍺🍻🍺" + this.endl);
	}

	static showInput() {
		processWrite("> ");
	}
}

function main(argv) {
	let scriptFile = false,
		scriptArgv = [];

	for (const arg of argv) {
		if (scriptFile) {
			scriptArgv.push(arg);
		} else {
			if (arg.startsWith("-")) {
				console.log("The interpreter can't handle argument \"" + arg + '".');
				return exit(1);
			}

			scriptFile = arg;
		}
	}

	if (scriptFile === false) {
		BirraREPL.handle(scriptArgv);
	} else {
		handleScriptFile(scriptFile, scriptArgv);
	}
}

const processArgv = process.argv.slice(2);
main(processArgv);
