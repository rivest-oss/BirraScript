"use strict";

const BIRRA_VERSION = "0.1.0";

function birraHashString(str) {
	const hash = new Uint16Array([ 65521 ]);
	let i = 0;

	while(isNaN(str.charCodeAt(i)) === false) {
		hash[0] *= 19;
		hash[0] += str.charCodeAt(i) * 17;
		i++;
	}

	return hash[0];
}

function birraPrintDebug(...args) {
	for(let i = 0; i < args.length; i++) {
		if(String(args[i]).startsWith("@")) {
			args[i] = args[i].slice(1);
			let m = birraHashString(args[i]);
			let color = "\x1b[30m\x1b[48;2;";

			color += Math.floor(128 + ((m / 0x10000) * 128)) + ";";
			m ^= 0xffff;
			color += Math.floor(128 + ((m / 0x10000) * 128)) + ";";
			m ^= 65521;
			color += Math.floor(128 + ((m / 0x10000) * 128)) + "m";

			args[i] = color + args[i] + "\x1b[0m";
		}
	}

	console.debug("\x1b[5m\x1b[45m\x1b[97m[DEBUG]\x1b[0m", ...(args));
}

const BIRRA_OPERATORS = {
	"==": "EQ",
	"<": "LT",
	">": "GT",
	"<=": "GTE",
	">=": "LTE",
	"<>": "GTLT",
	"!=": "NE",

	"=": "ASSIGN",
	".": "PERIOD",
	",": "COMMA",
	":": "COLON",
	";": "SEMICOLON",
	"?": "QUESTION",
	"??": "QQ",

	"+": "ADD",
	"-": "SUB",
	"*": "MUL",
	"**": "POW",
	"/": "DIV",
	"%": "MOD",
	"++": "INC",
	"--": "DEC",
	"+=": "ADD_ASSIGN",
	"-=": "SUB_ASSIGN",
	"*=": "MUL_ASSIGN",
	"**=": "POW_ASSIGN",
	"/=": "DIV_ASSIGN",

	"~": "LNOT",
	"&": "LAND",
	"|": "LOR",
	"^": "LXOR",

	"!": "BNOT",
	"&&": "BAND",
	"||": "BOR",
	"^^": "BXOR",

	"~=": "LNOT_ASSIGN",
	"&=": "LAND_ASSIGN",
	"&&=": "BAND_ASSIGN",
	"|=": "LOR_ASSIGN",
	"||=": "BOR_ASSIGN",
	"^=": "LXOR_ASSIGN",
	"^^=": "BXOR_ASSIGN",

	"<<": "SL",
	">>": "SR",
	"<<=": "SL_ASSIGN",
	">>=": "SR_ASSIGN",

	"(": "L_PARENS",
	")": "R_PARENS",
	"[": "L_BRACKETS",
	"]": "R_BRACKETS",
	"{": "L_BRACES",
	"}": "R_BRACES",
};

const BIRRA_KEYWORDS = [
	"let", "const",
	"namespace", "class",
	"if", "while", "for", "after",
	"fn", "function", "return",
	"pub", "static",
	"then", "else", "do", "end",
	"extends", "override",
	"false", "true",
];

for(const key of Object.keys(BIRRA_OPERATORS)) {
	BIRRA_OPERATORS[BIRRA_OPERATORS[key]] = BIRRA_OPERATORS[key];
}

module.exports = {
	VERSION: BIRRA_VERSION,
	printDebug: birraPrintDebug,
	OPERATORS: BIRRA_OPERATORS,
	KEYWORDS: BIRRA_KEYWORDS,
};
