"use strict";

const fs = require("node:fs");
const processArgv = process.argv.slice(2);
const processWrite = (...args) => process.stdout.write(...args);
let processOnStdin = () => {}; // Do this.
const exit = process.exit;
const endl = "\n";
process.stdin.on("data", buff => processOnStdin(buff.toString("utf-8")));





const VERSION = "0.1.0";

const BIRRA_OPERATORS = [
	"=", "<", ">", "<=", ">=", "<>", "!=",
	
	",", ":", ";",
	
	"+", "-", "*", "/",
	"++", "--",
	"+=", "-=", "*=", "/=",
	
	"~", "&", "|", "^",
	"!", "&&", "||", "^^",
	"~=", "&=", "&&=", "|=", "||=", "^=", "^^=",
	
	"<<", ">>", "<<=", ">>=",
	
	"(", ")", "[", "]", "{", "}",
];

class BirraLexer {
	errorAtLine(err_str, show_column = true) {
		if(!this.lastLine) {
			console.error(	err_str,
							(this.tokensState.row + 1)
							+ ":" +
							(this.tokensState.column + 1));
		} else {
			console.error(this.lastLine);
			console.error(' '.repeat(this.tokensState.column - 1) + '^');
			console.error('');
			console.error(	err_str, "at",
							(this.tokensState.row + 1)
							+ ":" +
							(this.tokensState.column + 1));
		}
		
		return -1;
	};
	
	readCharacter() {
		if(this.tokensState.srcI >= this.tokensState.src.length)
			return '\0';
		
		const c = this.tokensState.src[this.tokensState.srcI];
		this.tokensState.srcI++;
		
		if(c === '\n') {
			this.tokensState.row++;
			this.lastTokensColumn = this.tokensState.column + 0;
			this.tokensState.column = 0;
			this.lastLine = "";
		} else {
			this.tokensState.column++;
			this.lastTokensColumn = this.tokensState.column;
			
			this.lastLine =	((this.lastLine ?? "") +
							((c === '\t') ? "    " : c)).slice(-2048);
		}
		
		return c;
	};
	
	backACharacter() {
		this.tokensState.srcI -= 1;
		if(this.tokensState.srcI < 0) this.tokensState.srcI = 0;
		
		this.tokensState.column = this.lastTokensColumn;
	};
	
	isWhitespace(c) {
		if(c.charCodeAt(0) <= 0x20) return true;
		if(c.charCodeAt(0) === 0x7f) return true;
		
		return false;
	};
	
	isNumber(c) {
		return ("0123456789.".split('').includes(c));
	};
	
	isOperator(c) {
		return (BIRRA_OPERATORS.includes(c));
	};
	
	parseString(initialC) {
		let str = "", c = '';
		
		while(true) {
			c = this.readCharacter();
			if(c === initialC) break;
			
			if(c === '\0') {
				this.errorAtLine(	"Unexpected EOF while in String " +
									"declaration");
				return -1;
			}
			
			str += c;
		};
		
		this.tokens.push({
			type: "STRING",
			value: str,
		});
		
		return 0;
	};
	
	parseNumber(c) {
		let num = c, isDot = false;
		
		while(true) {
			c = this.readCharacter();
			
			if(this.isNumber(c)) {
				if((c === '.') && num.includes('.')) {
					this.errorAtLine(	"Unexpected '.' in Number " +
										"declaration");
					return -1;
				}
				
				num += c;
			} else {
				if(num === ".") {
					isDot = true;
					this.backACharacter();
					break;
				}
				
				if((c === 'x') || (c === 'b')) {
					if(num === "0") {
						num += c;
						continue;
					} else {
						this.errorAtLine(	"Unexpected '" + c + "' in " +
											"Number declaration");
						return -1;
					}
				}
				
				this.backACharacter();
				break;
			}
		};
		
		if(isDot) {
			this.tokens.push({
				type: "OPERATOR",
				value: ".",
			});
		} else {
			this.tokens.push({
				type: "NUMBER",
				value: num,
			});
		}
		
		return 0;
	};
	
	parseOperator(c) {
		let op = c;
		
		while(true) {
			c = this.readCharacter();
			
			if(c === '\0') {
				this.errorAtLine(	"Unexpected EOF while in Operator " +
									"declaration");
				return -1;
			}
			
			if(this.isOperator(op + c)) {
				op += c;
			} else {
				this.backACharacter();
				break;
			}
		};
		
		this.tokens.push({
			type: "OPERATOR",
			value: op,
		});
		
		return 0;
	};
	
	parseKeyword(c) {
		let word = c;
		
		while(true) {
			c = this.readCharacter();
			
			if(this.isWhitespace(c)) break;
			if(c === '.') {
				this.backACharacter();
				break;
			}
			
			if(
				(this.isOperator(c)) ||
				(c === '"') ||
				(c === '\'')
			) {
				this.backACharacter();
				break;
			}
			
			word += c;
		};
		
		this.tokens.push({
			type: "KEYWORD",
			value: word,
		});
		
		return 0;
	};
	
	parse(src) {
		this.tokensState = {
			eof: false, src, srcI: 0,
			row: 0, column: 0,
		};
		
		this.tokens = [];
		
		let	c = '\0', onComment = false, onMultilineComment = false,
			lastCommentThingy = "";
		
		while(this.tokensState.eof === false) {
			c = this.readCharacter();
			if(c === '\0') break;
			
			if(onMultilineComment !== false) {
				lastCommentThingy = (lastCommentThingy + c).slice(-8);
				
				if(lastCommentThingy.endsWith(onMultilineComment)) {
					lastCommentThingy = "";
					onMultilineComment = false;
				}
				
				continue;
			}
			
			if(onComment) {
				if(c === '\n') onComment = false;
				continue;
			}
			
			if(this.isWhitespace(c)) continue;
			
			// Detect "#" single-line comments.
			if(c === '#') {
				onComment = true;
				continue;
			}
			
			// Detect "//" single-line coments.
			if(c === '/') {
				const nextC = this.readCharacter();
				
				if(nextC === '/') {
					onComment = true;
					continue;
				} else {
					this.backACharacter();
				}
			}
			
			// Detect "--" single-line coments.
			if(c === '-') {
				const nextC = this.readCharacter();
				
				if(nextC === '-') {
					onComment = true;
					continue;
				} else {
					this.backACharacter();
				}
			}
			
			// Detect "~~" single-line coments.
			if(c === '~') {
				const nextC = this.readCharacter();
				
				if(nextC === '~') {
					onComment = true;
					continue;
				} else {
					this.backACharacter();
				}
			}
			
			// Detect "/*" multi-line comments.
			if(c === '/') {
				const nextC = this.readCharacter();
				
				if(nextC === '*') {
					onMultilineComment = "*/";
					continue;
				} else {
					this.backACharacter();
				}
			}
			
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
		};
		
		this.tokens.push({
			type: "EOF",
			value:	(this.tokensState.row + 1) + ":" +
					(this.tokensState.column + 1),
		});
		
		return this.tokens;
	};
	
	printTokens(tokens) {
		if(tokens < 0) return -1;
		
		for(const token of tokens) {
			console.log(token.type.padStart(8, ' ') + ": " + token.value);
		};
	};
};

class BirraParser {
	parse(tokens) {
	};
};

function handleScriptFile(scriptFile, scriptArgv) {
	fs.readFile(scriptFile, (err, buff) => {
		if(err) {
			console.error("Couldn't read the script:", err);
			return exit(1);
		}
		
		const birra = new BirraLexer();
		const tokens = birra.parse(buff.toString("utf-8"));
		
		birra.printTokens(tokens);
	});
};

class BirraREPL {
	static handle(scriptArgv) {
		const birra = new BirraLexer();
		
		BirraREPL.showWelcome();
		BirraREPL.showInput();
		
		processOnStdin = str => {
			const tokens = birra.parse(str);
			birra.printTokens(tokens);
			
			BirraREPL.showInput();
		};
		
		return birra;
	};
	
	static showWelcome() {
		processWrite("BirraScript " + VERSION + " 🍺🍻🍺" + endl);
	};
	
	static showInput() {
		processWrite("> ");
	};
};

function main(argv) {
	let scriptFile = false, scriptArgv = [];
	
	for(const arg of argv) {
		if(scriptFile) {
			scriptArgv.push(arg);
		} else {
			if(arg.startsWith('-')) {
				console.log("The interpreter couldn't handle argument \"" +
							arg + "\".");
				return exit(1);
			}
		
			scriptFile = arg;
		}
	};
	
	if(scriptFile === false) {
		BirraREPL.handle(scriptArgv);
	} else {
		handleScriptFile(scriptFile, scriptArgv);
	}
};

main(processArgv);
