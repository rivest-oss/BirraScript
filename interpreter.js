"use strict";
const VERSION = "0.1.0";

const fs = require("node:fs");

const processWrite = (...args) => process.stdout.write(...args);
const exit = process.exit;
let processOnStdin = () => {}; // Do this.
const processArgv = process.argv.slice(2);

process.stdin.on("data", (buff) => processOnStdin(buff.toString("utf-8")));

const BIRRA_OPERATORS = [
	"==",
	"<",
	">",
	"<=",
	">=",
	"<>",
	"!=",

	"=",
	",",
	":",
	";",
	"?",
	"??",

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
				this.errorAtLine(	"Unexpected EOF while in string " +
									"declaration");
				return -1;
			}

			str += c;
		}

		this.tokens.push({
			type: "STRING",
			value: str,
			row: this.tokenState.row,
			column: this.tokenState.column,
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
					this.errorAtLine(	"Unexpected '.' in number " +
										"declaration");
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
					this.errorAtLine(	"Unexpected '" + c + "' in " +
										"number declaration");
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
				row: this.tokenState.row,
				column: this.tokenState.column,
			});

			return 0;
		}

		this.tokens.push({
			type: "NUMBER",
			value: num,
			row: this.tokenState.row,
			column: this.tokenState.column,
		});

		return 0;
	}

	parseOperator(c) {
		let op = c;

		while (true) {
			c = this.readCharacter();

			if (c === "\0") {
				this.errorAtLine(	"Unexpected EOF while in operator " +
									"declaration");
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
			row: this.tokenState.row,
			column: this.tokenState.column,
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

		const isKeyword = [
			"let", "const",
			"namespace", "class",
			"if", "while", "for",
			"fn", "return",
			"pub", "static",
			"then", "else", "do", "end",
		].includes(word);

		this.tokens.push({
			type: isKeyword ? "KEYWORD" : "VARIABLE",
			value: word,
			row: this.tokenState.row,
			column: this.tokenState.column,
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
			// shutup if-if-if guy
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
			value: this.tokenState.row + 1 + ":" +(this.tokenState.column + 1),
			row: this.tokenState.row,
			column: this.tokenState.column,
		});

		return this.tokens;
	}

	printLexerTokens(tokens) {
		if (tokens < 0) return -1;

		console.debug("[BirraLexer] Tokens:");

		for (const token of tokens) {
			console.debug(token.type.padStart(8, " ") + ": " + token.value);
		}
	}
}

class BirraParser {
	clear(tokens) {
		this.tokens = tokens;
		this.token_i = 0;
		this.token = (tokens[0] ?? false);
	}

	back() {
		this.token_i--;
		this.token = this.tokens.at(this.token_i);

		if(this.token_i < 0) {
			this.token = this.tokens.at(-1);
			return -1;
		}

		return 0;
	}

	next() {
		this.token_i++;
		this.token = this.tokens.at(this.token_i);

		if(this.token_i >= this.tokens.length) {
			this.token = this.tokens.at(-1);
			return -1;
		}

		return 0;
	}

	accept(type, value = false) {
		const token = this.token;

		if(this.token.type !== type)
			return false;
		if((value !== false) && (this.token.value !== value))
			return false;
		
		return token;
	}

	expect(type, value = false) {
		const expected = this.accept(type, value);

		if(expected === false) {
			let msg = "[BirraParser] Unexpected ";

			if(this.token.type === "EOF") {
				msg += "End of File";
			} else {
				msg += this.token.type;
			}

			msg += " when expecting " + type + " ";

			if(value !== false) msg += "(" + value + ") ";

			msg += "at " + (this.token.row + 1) + ":";
			msg += (this.token.column + 1);

			console.error(msg);

			exit(1);
		}

		return this.token;
	}

	factor() {
		if(this.token.type === "NUMBER")
			return this.token;
		if(this.token.type === "VARIABLE")
			return this.token;
	}

	factor() {
		const token = this.token;

		if(this.accept("NUMBER"))
			return token;
		if(this.accept("VARIABLE"))
			return token;
		
		if(this.accept("OPERATOR", "+")) {
			//
		}

		if(this.accept("OPERATOR", "-")) {
			//
		}

		this.expect("NUMBER or VARIABLE");
	}

	expression() {
		let left = this.factor();
		this.next();

		while(
			this.accept("OPERATOR", "+") ||
			this.accept("OPERATOR", "-")
		) {
			const operator = this.token.value;
			this.next();
			const right = this.expression();

			left = {
				type: "BINARY_OP",
				operator,
				left,
				right,
			};
		}

		return left;
	}

	// `modus` may be "LET", "CONST", et cetera.
	assignment(modus) {
		const variable = {
			type: "ASSIGNMENT",
			modus,
			value: false,
		};

		console.log("ANTES DE OWOOOOO", this.token, this.token_i);

		variable.name = this.expect("VARIABLE").value;
		this.next();

		if(
			this.accept("OPERATOR", "=") ||
			this.accept("OPERATOR", ":")
		) {
			this.next();
			variable.value = this.expression();

			if(variable.value === false) {
				console.error(	"Unexpected EOF when assigning variable \"" +
								variable.name + "\" at " +
								(this.token.row + 1) + ":" +
								(this.token.column + 1));
				exit(1);
			}
		}

		if(this.accept("OPERATOR", ",")) this.next();

		return variable;
	}

	block(root = false) {
		const block = {
			type: "BLOCK",
			statements: [],
		};

		while(this.token !== false) {
			// for
			if(this.accept("KEYWORD", "for")) {
				this.next();
				block.statements.push(this.for_loop());
				continue;
			}

			// let x = y
			if(this.accept("KEYWORD", "let")) {
				this.next();
				block.statements.push(this.assignment("LET"));
				continue;
			}

			// const x = y
			if(this.accept("KEYWORD", "const")) {
				this.next();
				block.statements.push(this.assignment("CONST"));
				continue;
			}

			if(this.accept("KEYWORD", "end")) {
				this.next();
				break;
			}

			if(this.accept("EOF")) {
				if(root) {
					break;
				} else {
					console.error("[TODO] parser/ WHAT!? EOF HERE!?");
					exit(1);
				}
			}

			console.debug("[TODO] parser/ Add 'if's in 'block'().", this.token);
			console.debug("^^^^^^", this.token_i, this.tokens.length);
			exit(1); // <= remove this line
			this.next();
		}

		return block;
	}

	parse(tokens) {
		if(tokens < 0) return -1;
		this.clear(tokens);

		return this.block(true);
	}

	printAST(ast, root = true, sep_n = 0) {
		if(root) console.debug("[BirraParser] AST:");

		const endl = "\n";
		const sep = "    ";
		
		switch(ast.type) {
			case "BINARY_OP":
				console.debug(sep.repeat(sep_n) + "BINARY_OP: " + ast.operator);
				this.printAST(ast.left, false, sep_n + 1);
				this.printAST(ast.right, false, sep_n + 1);
				break;

			case "VARIABLE":
				console.debug(sep.repeat(sep_n) + "VARIABLE: " + ast.value);
				break;
			
			case "NUMBER":
				console.debug(sep.repeat(sep_n) + "NUMBER: " + ast.value);
				break;
			
			case "ASSIGNMENT":
				console.debug(sep.repeat(sep_n) + "ASSIGNMENT: " + ast.name);
				this.printAST(ast.value, false, sep_n + 1);
				break;
			
			case "BLOCK": {
				console.debug(sep.repeat(sep_n) + "BLOCK:");

				for(let i = 0; i < ast.statements.length; i++) {
					this.printAST(ast.statements[i], false, sep_n + 1);
				}

				break;
			}
		}
	}
}

function handleScriptFile(scriptFile, scriptArgv) {
	fs.readFile(scriptFile, (err, buff) => {
		if (err) {
			console.error("Couldn't read the script:", err);
			return exit(1);
		}

		const birraLexer = new BirraLexer();
		const birraParser = new BirraParser();

		const tokens = birraLexer.parse(buff.toString("utf-8"));
		birraLexer.printLexerTokens(tokens);

		const ast = birraParser.parse(tokens);
		birraParser.printAST(ast);
	});
}

class BirraREPL {
	static endl = "\n";
	static handle() {
		const birraLexer = new BirraLexer();
		const birraParser = new BirraParser();

		BirraREPL.showWelcome();
		BirraREPL.showInput();

		processOnStdin = (str) => {
			const tokens = birraLexer.parse(str);
			birraLexer.printLexerTokens(tokens);

			const ast = birraParser.parse(tokens);
			birraParser.printAST(ast);

			BirraREPL.showInput();
		};
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
				console.log("The interpreter can't handle argument \"" + arg + 
							'".');
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

main(processArgv);
