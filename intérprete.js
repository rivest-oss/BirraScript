"use strict";

const fs = require("node:fs");
const processArgv = process.argv.slice(2);
const processWrite = process.stdout.write;
let processOnStdin = () => {}; // Do this.
const exit = process.exit;
const endl = "\n";
process.stdin.on("data", processOnStdin);





const VERSION = "0.1.0";

const BIRRA_OPERATORS = {};
const BIRRA_OPERATORS_ARR = Object.values(BIRRA_OPERATORS);

for(const key of Object.keys(BIRRA_OPERATORS)) {
	BIRRA_OPERATORS[BIRRA_OPERATORS[key]] = BIRRA_OPERATORS[key];
};

class Birra {
	read_character() {
		if(this._tokens_state.srcI >= this._tokens_state.src.length)
			return '\0';
		
		const c = this._tokens_state.src[this._tokens_state.srcI];
		this._tokens_state.srcI++;
		
		if(c === '\n') {
			this._tokens_state.row++;
			this._lastTokensColumn = this._tokens_state.column + 0;
			this._tokens_state.column = 0;
		} else {
			this._tokens_state.column++;
			this._lastTokensColumn = this._tokens_state.column;
		}
		
		return c;
	};
	
	back_a_character() {
		this._tokens_state.srcI -= 1;
		if(this._tokens_state.srcI < 0) this._tokens_state.srcI = 0;
		
		this._tokens_state.column = this._lastTokensColumn;
	};
	
	is_whitespace(c) {
		if(c.charCodeAt(0) <= 0x20) return true;
		if(c.charCodeAt(0) === 0x7f) return true;
		
		return false;
	};
	
	skip_whitespace() {
		let c = '\0';
		while(true) {
			c = this.read_character();
			
			if(c === '\0') break;
			
			if(this.is_whitespace(c) === false) {
				this.back_a_character();
				break;
			}
		};
	};
	
	parse_tokens(src) {
		this._tokens_state = {
			eof: false, src, srcI: 0,
			row: 0, column: 0,
		};
		
		this._tokens = [];
		
		let c = '\0';
		
		while(this._tokens_state.eof === false) {
			this.skip_whitespace();
			
			c = this.read_character();
			if(c === '\0') break;
			
			if((c === '"') || (c === '\'')) {
				
			}
		};
		
		this._tokens.push({
			type: "EOF",
			value:	"L" + (this._tokens_state.row + 1) +
					"C" + (this._tokens_state.column + 1),
		});
		
		return this._tokens;
	};
	
	print_lexer_tokens(tokens) {
		console.log(tokens);
	};
};

function handleScriptFile(scriptFile, scriptArgv) {
	fs.readFile(scriptFile, (err, buff) => {
		if(err) {
			console.error("Error al intentar leer ese fichero:", err);
			return exit(1);
		}
		
		const birra = new Birra();
		const tokens = birra.parse_tokens(buff.toString("utf-8"));
		
		birra.print_lexer_tokens(tokens);
	});
};

class BirraREPL {
	static handle(scriptArgv) {
		processOnStdin = () => {
			// [TODO]
		};
	};
	
	static showWelcome() {
		processWrite("Birra " + VERSION + endl);
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
				console.log("El intérprete no sabe lidiar con ese " +
							"argumento \"" + arg + "\".");
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
