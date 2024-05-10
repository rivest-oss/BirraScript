"use strict";

const fs = require("node:fs");
const processArgv = process.argv.slice(2);
const processWrite = process.stdout.write;
let processOnStdin = () => {}; // Do this.
const exit = process.exit;
const endl = "\n";
process.stdin.on("data", processOnStdin);





const VERSION = "0.1.0";

class Birra {
	parse_tokens(src) {
		//
	};
	
	print_lexer_tokens(tokens) {
		//
	};
};

function handleScriptFile(scriptFile, scriptArgv) {
	fs.readFileSync(scriptFile, (err, buff) => {
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
	
	if(scriptFile !== false) {
		handleScriptFile(scriptFile, scriptArgv);
	} else {
		BirraREPL.handle(scriptArgv);
	}
};

main(processArgv);
