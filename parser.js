"use strict";

const Birra = require("./common.js");

class BirraParser {
	reset(src, tokens) {
		this.src = src;
		this.tokens = tokens;
		this.tokenPtr = 0;
		this.currToken = tokens.at(this.tokenPtr);
	}

	errorAtCurrToken(msg) {
		if(this.currToken.type !== "EOF") {
			console.error(this.src.split(/\n/g)[this.currToken.row - 1]);

			console.error(" ".repeat(Math.max(this.currToken.column - 1, 0)) + "^".repeat(this.currToken.value.length));

			console.error("");
		}

		console.error(msg, "at", this.currToken.row + ":" + this.currToken.column);

		return -1;
	}

	next() {
		if(this.tokenPtr < this.tokens.length) this.tokenPtr++;
		if(this.tokenPtr >= this.tokens.length) return -1;

		this.currToken = this.tokens.at(this.tokenPtr);
		
		return 0;
	}

	back() {
		if(this.tokenPtr > 0) this.tokenPtr--;
		this.currToken = this.tokens.at(this.tokenPtr);
		return 0;
	}

	accept(type, value = false) {
		if(this.currToken.type !== type) return -1;
		if((value !== false) && (this.currToken.value !== value)) return -2;

		return 0;
	}

	expect(type, value = false) {
		if(this.accept(type, value) !== 0) {
			let msg = "Unexpected ";

			msg += ((this.currToken.type === "EOF")
				? "End of File"
				: ("\"" + this.currToken.type + "\""));

			if((value !== false) && (this.currToken.value !== undefined))
				msg += " ('" + this.currToken.value.toString() + "')";

			msg += " when expecting \"" + type + "\"";

			if(value !== false)
				msg += " ('" + value.toString() + "')";
			
			this.errorAtCurrToken(msg);
			return -1;
		}

		return 0;
	}

	isUnaryOperator() {
		return Birra.UNARY_OPERATORS
			.map(x => this.accept("OPERATOR", x))
			.some(x => (x === 0));
	}

	resolveExpression() {
		const token = this.currToken;

		if(this.accept("NUMBER") === 0) {
			if(this.next() < 0) return -1;
			return token;
		}
		
		if(this.accept("VARIABLE") === 0) {
			if(this.next() < 0) return -1;
			return token;
		};

		if(this.accept("STRING") === 0) {
			if(this.next() < 0) return -1;
			return token;
		};

		if(this.accept("BOOLEAN") === 0) {
			if(this.next() < 0) return -1;
			return token;
		};

		if(this.accept("OPERATOR", "(") === 0) {
			if(this.next() < 0) return -1;

			const expression = this.resolveBinaryOp();
			if(expression < 0) return -1;
			
			if(this.expect("OPERATOR", ")") < 0) return -1;
			if(this.next() < 0) return -1;

			return expression;
		}

		if(this.accept("OPERATOR", "[") === 0) return this.resolveArray();
		if(this.accept("OPERATOR", "{") === 0) return this.resolveDictionary();

		if((this.accept("KEYWORD", "function") === 0) || (this.accept("KEYWORD", "fn") === 0))
			return this.resolveFunction();
		
		if(this.isUnaryOperator())
			return this.resolveUnaryOp();
		
		if(this.expect("EXPRESSION") < 0) return -1;
		return -1;
	}

	resolveUnaryOp() {
		if(this.expect("OPERATOR") < 0) return -1;

		const operator = this.currToken.value;
		if(this.next() < 0) return -1;

		const value = this.resolveBinaryOp();
		if(value < 0) return -1;

		return {
			type: "UNARY_OP",
			operator,
			value,
		};
	}

	resolveBinaryOp(operatorPtr = false) {
		let callback = false;

		if(operatorPtr === false) operatorPtr = Birra.BINARY_OPERATORS.length - 1;

		if(operatorPtr === 0) {
			callback = () => this.resolveExpression();
		} else {
			callback = () => this.resolveBinaryOp(operatorPtr - 1);
		}

		let left = callback();
		if(left < 0) return -1;

		while(this.accept("OPERATOR", Birra.BINARY_OPERATORS[operatorPtr]) === 0) {
			const operator = this.currToken;
			if(this.next() < 0) return -1;
			const right = callback();

			if(right < 0) return -1;

			left = {
				type: "BINARY_OP",
				operator, left, right,
			};
		}

		return left;
	}

	resolveFunction() {
		if(this.expect("KEYWORD") < 0) return -1;
		if(this.next() < 0) return -1;

		const func = {
			type: "FUNCTION",
			args: [],
		};

		if(this.accept("VARIABLE") === 0) {
			func.name = this.currToken;
			if(this.next() < 0) return -1;
		} else if(this.accept("OPERATOR") === 0) {
			if(this.accept("OPERATOR", "(") === 0) {
				func.name = false;
			} else {
				func.name = this.currToken;
				if(this.next() < 0) return -1;
			}
		} else {
			this.expect("function name");
			return -1;
		}

		if(this.expect("OPERATOR", "(") < 0) return -1;
		if(this.next() < 0) return -1;

		while(true) {
			if(this.accept("OPERATOR", ")") === 0) break;

			if(this.expect("VARIABLE") < 0) return -1;
			func.args.push(this.currToken);
			if(this.next() < 0) return -1;

			if(this.accept("OPERATOR", ")") === 0) break;
			if(this.accept("OPERATOR", ",") === 0) {
				if(this.next() < 0) return -1;
				continue;
			}

			this.expect("function argument or end of arguments mark");
			return -1;
		}

		if(this.expect("OPERATOR", ")") < 0) return -1;
		if(this.next() < 0) return -1;

		func.body = this.resolveBlock(true, false);
		if(func.body < 0) return -1;

		if(this.expect("KEYWORD", "end") < 0) return -1;
		if(this.next() < 0) return -1;

		return func;
	}

	resolveWhile() {
		if(this.expect("KEYWORD", "while") < 0) return -1;
		if(this.next() < 0) return -1;

		const whileStatement = {
			type: "WHILE",
		};
		
		whileStatement.check = this.resolveBinaryOp();
		if(whileStatement.check < 0) return -1;

		if((this.accept("KEYWORD", "then") === 0) || (this.accept("KEYWORD", "do") === 0)) {
			if(this.next() < 0) return -1;

			whileStatement.body = this.resolveBlock(true, true);
			if(whileStatement.body < 0) return -1;

			if(this.expect("KEYWORD", "end") < 0) return -1;
			if(this.next() < 0) return -1;

			return whileStatement;
		} else {
			this.expect("KEYWORD", "do");
			return -1;
		}
	}

	resolveFor() {
		if(this.expect("KEYWORD", "for") < 0) return -1;
		if(this.next() < 0) return -1;

		const forStatement = {
			type: "FOR",
			pre: [],
			check: false,
			post: false,
			body: [],
		};

		while(true) {
			const expression = this.resolveBinaryOp();
			if(expression < 0) return -1;

			forStatement.pre.push(expression);

			if(this.accept("OPERATOR", ",") === 0) {
				if(this.next() < 0) return -1;
				continue;
			}

			break;
		}

		while(true) {
			if(this.accept("KEYWORD", "while") === 0) {
				if(forStatement.check !== false) {
					this.errorAtCurrToken("Unexpected \"while\" statement");
					return -1;
				}

				if(this.next() < 0) return -1;

				forStatement.check = this.resolveBinaryOp();
				if(forStatement.check < 0) return -1;

				continue;
			}

			if(this.accept("KEYWORD", "after") === 0) {
				if(forStatement.post !== false) {
					this.errorAtCurrToken("Unexpected \"after\" statement");
					return -1;
				}

				if(this.next() < 0) return -1;

				forStatement.post = [];

				while(true) {
					const expression = this.resolveBinaryOp();
					if(expression < 0) return -1;
		
					forStatement.post.push(expression);
		
					if(this.accept("OPERATOR", ",") === 0) {
						if(this.next() < 0) return -1;
						continue;
					}
		
					break;
				}

				continue;
			}

			if((this.accept("KEYWORD", "do") === 0) || (this.accept("KEYWORD", "then") === 0)) {
				if(this.next() < 0) return -1;
				break;
			}

			this.expect("loop keyword");
			return -1;
		}

		forStatement.body = this.resolveBlock(true, true);
		if(forStatement.body < 0) return -1;

		if(this.expect("KEYWORD", "end") < 0) return -1;
		if(this.next() < 0) return -1;

		return forStatement;
	}

	resolveArray() {
		if(this.expect("OPERATOR", "[") < 0) return -1;
		if(this.next() < 0) return -1;

		const arr = {
			type: "ARRAY",
			elements: [],
		};

		while(true) {
			if(this.accept("OPERATOR", "]") === 0) break;

			const expression = this.resolveBinaryOp();
			if(expression < 0) return -1;

			arr.elements.push(expression);

			if(this.accept("OPERATOR", ",") === 0) {
				if(this.next() < 0) return -1;
				continue;
			}

			if(this.expect("OPERATOR", "]") < 0) return -1;
		}

		if(this.expect("OPERATOR", "]") < 0) return -1;
		if(this.next() < 0) return -1;

		return arr;
	}

	resolveDictionary() {
		if(this.expect("OPERATOR", "{") < 0) return -1;
		if(this.next() < 0) return -1;

		const dict = {
			type: "DICTIONARY",
			elements: [],
		};

		while(true) {
			if(this.accept("OPERATOR", "}") === 0) break;

			const expression = this.resolveBinaryOp();
			if(expression < 0) return -1;

			dict.elements.push(expression);

			if(this.accept("OPERATOR", ",") === 0) {
				if(this.next() < 0) return -1;
				continue;
			}

			if(this.expect("OPERATOR", "}") < 0) return -1;
		}

		if(this.expect("OPERATOR", "}") < 0) return -1;
		if(this.next() < 0) return -1;

		return dict;
	}

	resolveIf() {
		if(this.expect("KEYWORD", "if") < 0) return -1;
		if(this.next() < 0) return -1;

		const statements = [];
		let isIF = true;

		while(true) {
			let check = false;

			if(isIF) {
				check = this.resolveBinaryOp();
				if(check < 0) return -1;
			}

			if(isIF) {
				if(this.expect("KEYWORD", "then") < 0) return -1;
				if(this.next() < 0) return -1;
			}
			
			const block = this.resolveBlock(true, false, true);
			if(block < 0) return -1;

			statements.push({
				type: "IF",
				check,
				block,
			});

			if(this.accept("KEYWORD", "end") === 0) break;

			if(isIF === false) {
				this.expect("KEYWORD", "end");
				return -1;
			}

			if(this.accept("KEYWORD", "else") === 0) {
				if(this.next() < 0) return -1;

				if(this.accept("KEYWORD", "if") === 0) {
					isIF = true;
					if(this.next() < 0) return -1;
					continue;
				}
				
				isIF = false;
				continue;
			}
		}

		if(this.expect("KEYWORD", "end") < 0) return -1;
		if(this.next() < 0) return -1;

		return statements;
	}

	resolveBlock(allowEND, breakable, isIFBody = false) {
		const statements = [];

		while(true) {
			if(this.accept("KEYWORD", "let") === 0) {
				if(this.next() < 0) return -1;

				while(true) {
					const expression = this.resolveBinaryOp();
					if(expression < 0) return -1;

					const declaration = {
						type: "DECLARATION",
						modus: "LET",
						expression,
					};

					statements.push(declaration);

					if(this.accept("OPERATOR", ",") === 0) {
						if(this.next() < 0) return -1;
						continue;
					}

					break;
				}

				continue;
			}

			if(this.accept("KEYWORD", "const") === 0) {
				if(this.next() < 0) return -1;

				while(true) {
					const expression = this.resolveBinaryOp();
					if(expression < 0) return -1;

					const declaration = {
						type: "DECLARATION",
						modus: "CONST",
						expression,
					};

					statements.push(declaration);

					if(this.accept("OPERATOR", ",") === 0) {
						if(this.next() < 0) return -1;
						continue;
					}

					break;
				}

				continue;
			}

			if(this.accept("KEYWORD", "while") === 0) {
				const whileStatement = this.resolveWhile();
				if(whileStatement < 0) return -1;

				statements.push(whileStatement);

				continue;
			}

			if(this.accept("KEYWORD", "for") === 0) {
				const forStatement = this.resolveFor();
				if(forStatement < 0) return -1;

				statements.push(forStatement);

				continue;
			}

			if(this.accept("KEYWORD", "if") === 0) {
				const ifStatement = this.resolveIf();
				if(ifStatement < 0) return -1;

				statements.push(ifStatement);

				continue;
			}

			if(isIFBody && (this.accept("KEYWORD", "else") === 0))
				break;

			if(this.accept("KEYWORD", "end") === 0) {
				if(allowEND) break;

				this.errorAtCurrToken("Unexpected \"end\" keyword");
				return -1;
			}

			if(this.accept("KEYWORD", "break") === 0) {
				if(breakable) {
					statements.push(this.currToken);
					if(this.next() < 0) return -1;

					continue;
				}

				this.errorAtCurrToken("Unexpected \"break\" keyword");
				return -1;
			}

			if(this.accept("KEYWORD", "continue") === 0) {
				if(breakable) {
					statements.push(this.currToken);
					if(this.next() < 0) return -1;

					continue;
				}

				this.errorAtCurrToken("Unexpected \"continue\" keyword");
				return -1;
			}

			if(this.accept("KEYWORD", "return") === 0) {
				if(allowEND === false) {
					this.errorAtCurrToken("Unexpected \"return\" keyword");
					return -1;
				}

				if(this.next() < 0) return -1;

				const expression = this.resolveBinaryOp();
				if(expression < 0) return -1;

				statements.push({
					type: "RETURN",
					value: expression,
				});

				continue;
			}

			//Birra.printDebug("@[Parser.block] Goin' to end of loop:", this.currToken);

			if(this.accept("EOF") === 0) {
				// It must be root then.
				if(allowEND === false)
					break;

				this.expect("EXPRESSION");
				return -1;
			}

			const expression = this.resolveBinaryOp();
			if(expression < 0) return -1;

			statements.push(expression);

			continue;
		}

		return statements;
	}

	parse(src, tokens) {
		if(tokens < 0) return -1;
		this.reset(src, tokens);

		return this.resolveBlock(false, false);
	}
};

module.exports = BirraParser;
