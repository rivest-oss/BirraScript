"use strict";

const Birra = require("./common.js");

const BIRRA_PARSER_BLOCK_TYPES = {
	"ROOT": {
		acceptPubDeclaration: false,
		acceptStaticDeclaration: false,
		acceptLetDeclaration: true,
		acceptConstDeclaration: true,
		acceptNamespace: true,
		acceptClass: true,
		acceptWhile: true,
		acceptFor: true,
		acceptIf: true,
		acceptElse: false,
		acceptEnd: false,
		acceptBreak: false,
		acceptContinue: false,
		acceptReturn: false,
		acceptEOF: true,
	},
	
	"FUNCTION": {
		acceptPubDeclaration: false,
		acceptStaticDeclaration: false,
		acceptLetDeclaration: true,
		acceptConstDeclaration: true,
		acceptNamespace: true,
		acceptClass: true,
		acceptWhile: true,
		acceptFor: true,
		acceptIf: true,
		acceptElse: false,
		acceptEnd: true,
		acceptBreak: false,
		acceptContinue: false,
		acceptReturn: true,
		acceptEOF: false,
	},
	
	"WHILE": {
		acceptPubDeclaration: false,
		acceptStaticDeclaration: false,
		acceptLetDeclaration: true,
		acceptConstDeclaration: true,
		acceptNamespace: true,
		acceptClass: true,
		acceptWhile: true,
		acceptFor: true,
		acceptIf: true,
		acceptElse: false,
		acceptEnd: true,
		acceptBreak: true,
		acceptContinue: true,
		acceptReturn: false,
		acceptEOF: false,
	},
	
	"IF": {
		acceptPubDeclaration: false,
		acceptStaticDeclaration: false,
		acceptLetDeclaration: true,
		acceptConstDeclaration: true,
		acceptNamespace: true,
		acceptClass: true,
		acceptWhile: true,
		acceptFor: true,
		acceptIf: true,
		acceptElse: true,
		acceptEnd: true,
		acceptBreak: false,
		acceptContinue: false,
		acceptReturn: false,
		acceptEOF: false,
	},
	
	"NAMESPACE": {
		acceptPubDeclaration: false,
		acceptStaticDeclaration: false,
		acceptLetDeclaration: true,
		acceptConstDeclaration: true,
		acceptNamespace: true,
		acceptClass: true,
		acceptWhile: true,
		acceptFor: true,
		acceptIf: true,
		acceptElse: false,
		acceptEnd: true,
		acceptBreak: false,
		acceptContinue: false,
		acceptReturn: false,
		acceptEOF: false,
	},
	
	"CLASS": {
		acceptPubDeclaration: true,
		acceptStaticDeclaration: true,
		acceptLetDeclaration: true,
		acceptConstDeclaration: true,
		acceptNamespace: false,
		acceptClass: false,
		acceptWhile: false,
		acceptFor: false,
		acceptIf: false,
		acceptElse: false,
		acceptEnd: true,
		acceptBreak: false,
		acceptContinue: false,
		acceptReturn: false,
		acceptEOF: false,
	},
};

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

	resolveAtom(context) {
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

			const expression = this.resolveExpression();
			if(expression < 0) return -1;
			
			if(this.expect("OPERATOR", ")") < 0) return -1;
			if(this.next() < 0) return -1;

			return expression;
		}

		if(this.accept("OPERATOR", "[") === 0) return this.resolveArray(context);
		if(this.accept("OPERATOR", "{") === 0) return this.resolveDictionary(context);

		if((this.accept("KEYWORD", "function") === 0) || (this.accept("KEYWORD", "fn") === 0))
			return this.resolveFunction(context);
		
		if(this.isUnaryOperator())
			return this.resolveUnaryOp(context);
		
		if(this.expect("EXPRESSION") < 0) return -1;
		return -1;
	}

	resolveUnaryOp(context) {
		if(this.expect("OPERATOR") < 0) return -1;

		const operator = this.currToken;
		if(this.next() < 0) return -1;

		const value = this.resolveExpression();
		if(value < 0) return -1;

		return {
			type: "UNARY_OP",
			operator,
			value,
		};
	}

	resolveBinaryOp(operatorPtr = false, context) {
		let callback = false;

		if(operatorPtr === false) operatorPtr = Birra.BINARY_OPERATORS.length - 1;

		if(operatorPtr === 0) {
			callback = () => {
				const expression = this.resolveAtom(context);
				if(expression < 0) return -1;

				if(this.isUnaryOperator()) {
					const operator = this.currToken;
					if(this.next() < 0) return -1;

					return {
						type: "UNARY_OP",
						operator,
						value: expression,
					};
				}

				return expression;
			};
		} else {
			callback = () => this.resolveBinaryOp(operatorPtr - 1, context);
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

	resolveExpression() {
		return this.resolveBinaryOp();
	}

	resolveFunction(context) {
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

		func.body = this.resolveBlock("FUNCTION");
		if(func.body < 0) return -1;

		if(this.expect("KEYWORD", "end") < 0) return -1;
		if(this.next() < 0) return -1;

		return func;
	}

	resolveWhile(context) {
		if(this.expect("KEYWORD", "while") < 0) return -1;
		if(this.next() < 0) return -1;

		const whileStatement = {
			type: "WHILE",
		};
		
		whileStatement.check = this.resolveExpression();
		if(whileStatement.check < 0) return -1;

		if((this.accept("KEYWORD", "then") === 0) || (this.accept("KEYWORD", "do") === 0)) {
			if(this.next() < 0) return -1;

			whileStatement.body = this.resolveBlock("WHILE");
			if(whileStatement.body < 0) return -1;

			if(this.expect("KEYWORD", "end") < 0) return -1;
			if(this.next() < 0) return -1;

			return whileStatement;
		} else {
			this.expect("KEYWORD", "do");
			return -1;
		}
	}

	resolveFor(context) {
		if(this.expect("KEYWORD", "for") < 0) return -1;
		if(this.next() < 0) return -1;

		const forStatement = {
			type: "FOR",
			pre: [],
			check: false,
			post: false,
			body: [],
		};

		forStatement.pre = this.resolveCommaExpressions(context);
		if(forStatement.pre < 0) return -1;

		while(true) {
			if(this.accept("KEYWORD", "while") === 0) {
				if(forStatement.check !== false) {
					this.errorAtCurrToken("Unexpected \"while\" statement");
					return -1;
				}

				if(this.next() < 0) return -1;

				forStatement.check = this.resolveExpression();
				if(forStatement.check < 0) return -1;

				continue;
			}

			if(this.accept("KEYWORD", "after") === 0) {
				if(forStatement.post !== false) {
					this.errorAtCurrToken("Unexpected \"after\" statement");
					return -1;
				}

				if(this.next() < 0) return -1;

				forStatement.post = this.resolveCommaExpressions();
				if(forStatement.post < 0) return -1;

				continue;
			}

			if((this.accept("KEYWORD", "do") === 0) || (this.accept("KEYWORD", "then") === 0)) {
				if(this.next() < 0) return -1;
				break;
			}

			this.expect("loop keyword");
			return -1;
		}

		forStatement.body = this.resolveBlock("WHILE", context);
		if(forStatement.body < 0) return -1;

		if(this.expect("KEYWORD", "end") < 0) return -1;
		if(this.next() < 0) return -1;

		return forStatement;
	}

	resolveArray(context) {
		if(this.expect("OPERATOR", "[") < 0) return -1;
		if(this.next() < 0) return -1;

		const arr = {
			type: "ARRAY",
			elements: [],
		};

		while(true) {
			if(this.accept("OPERATOR", "]") === 0) break;

			const expression = this.resolveExpression();
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

	resolveDictionary(context) {
		if(this.expect("OPERATOR", "{") < 0) return -1;
		if(this.next() < 0) return -1;

		const dict = {
			type: "DICTIONARY",
			elements: [],
		};

		while(true) {
			if(this.accept("OPERATOR", "}") === 0) break;

			const expression = this.resolveExpression();
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

	resolveIf(context) {
		if(this.expect("KEYWORD", "if") < 0) return -1;
		if(this.next() < 0) return -1;

		const statements = [];
		let isIF = true;

		while(true) {
			let check = false;

			if(isIF) {
				check = this.resolveExpression();
				if(check < 0) return -1;
			}

			if(isIF) {
				if(this.expect("KEYWORD", "then") < 0) return -1;
				if(this.next() < 0) return -1;
			}
			
			const block = this.resolveBlock("IF", context);
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

	resolveCommaExpressions(context) {
		const statements = [];

		while(true) {
			const expression = this.resolveExpression();
			if(expression < 0) return -1;

			statements.push(expression);

			if(this.accept("OPERATOR", ",") === 0) {
				if(this.next() < 0) return -1;
				continue;
			}

			if(this.accept("OPERATOR", ";") === 0)
				if(this.next() < 0) return -1;

			break;
		}

		return statements;
	}

	resolveBlock(type, context = false) {
		const options = BIRRA_PARSER_BLOCK_TYPES[type];
		if(options === undefined) {
			console.error("Couldn't find block type \"" + type + "\"");
			return -1;
		}

		if(context === false) {
			context = {
				scope: [],
			};
		}

		const statements = [];

		while(true) {
			let prevKeywords = false;
			const statement = {
				const: 0,
				public: false,
				static: false,
				
				scope: [ ...(context.scope) ],
			};

			while(this.accept("KEYWORD") === 0) {
				if(this.accept("KEYWORD", "pub") === 0) {
					if((options.acceptPubDeclaration === false) || statement.public) {
						this.errorAtCurrToken("Unexpected \"pub\" declaration");
						return -1;
					}
	
					statement.public = true;
					prevKeywords = true;
	
					if(this.next() < 0) return -1;

					continue;
				}

				if(this.accept("KEYWORD", "static") === 0) {
					if((options.acceptStaticDeclaration === false) || statement.static) {
						this.errorAtCurrToken("Unexpected \"static\" declaration");
						return -1;
					}
	
					statement.static = true;
					prevKeywords = true;
	
					if(this.next() < 0) return -1;

					continue;
				}

				if(this.accept("KEYWORD", "let") === 0) {
					if((options.acceptLetDeclaration === false) || statement.const) {
						this.errorAtCurrToken("Unexpected \"let\" declaration");
						return -1;
					}
	
					statement.const = false;
					prevKeywords = true;
	
					if(this.next() < 0) return -1;

					continue;
				}

				if(this.accept("KEYWORD", "const") === 0) {
					if((options.acceptConstDeclaration === false) || (statement.const !== 0)) {
						this.errorAtCurrToken("Unexpected \"const\" declaration");
						return -1;
					}
	
					statement.const = true;
					prevKeywords = true;
	
					if(this.next() < 0) return -1;

					continue;
				}

				break;
			}

			statement.const = Boolean(statement.const);

			if(this.accept("KEYWORD", "namespace") === 0) {
				if((options.acceptNamespace === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"namespace\" declaration");
					return -1;
				}

				if(this.next() < 0) return -1;
				if(this.expect("VARIABLE") < 0) return -1;

				statement.type = "NAMESPACE";
				statement.name = this.currToken;

				if(this.next() < 0) return -1;

				const subContext = {
					scope: [ ...(context.scope), statement.name.value ],
				};

				statement.statements = this.resolveBlock("NAMESPACE", subContext);
				statements.push(statement);

				if(this.expect("KEYWORD", "end") < 0) return -1;
				if(this.next() < 0) return -1;

				continue;
			}

			if(this.accept("KEYWORD", "class") === 0) {
				if((options.acceptClass === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"class\" declaration");
					return -1;
				}

				if(this.next() < 0) return -1;
				if(this.expect("VARIABLE") < 0) return -1;

				statement.type = "CLASS";
				statement.name = this.currToken;

				if(this.next() < 0) return -1;

				const subContext = {
					scope: [ ...(context.scope), statement.name.value ],
				};

				statement.statements = this.resolveBlock("CLASS", subContext);
				statements.push(statement);

				if(this.expect("KEYWORD", "end") < 0) return -1;
				if(this.next() < 0) return -1;

				continue;
			}

			if(this.accept("KEYWORD", "while") === 0) {
				if((options.acceptWhile === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"while\" declaration");
					return -1;
				}

				const subContext = {
					scope: [ ...(context.scope), "[while:" + Birra.randomFloat().toString() + "]" ],
				};

				const whileStatement = this.resolveWhile(subContext);
				if(whileStatement < 0) return -1;

				Object.assign(statement, whileStatement);
				statements.push(statement);

				continue;
			}

			if(this.accept("KEYWORD", "for") === 0) {
				if((options.acceptFor === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"for\" declaration");
					return -1;
				}

				const subContext = {
					scope: [ ...(context.scope), "[for:" + Birra.randomFloat().toString() + "]" ],
				};

				const forStatement = this.resolveFor(subContext);
				if(forStatement < 0) return -1;

				Object.assign(statement, forStatement);
				statements.push(statement);

				continue;
			}

			if(this.accept("KEYWORD", "if") === 0) {
				if((options.acceptIf === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"if\" declaration");
					return -1;
				}

				const subContext = {
					scope: [ ...(context.scope), "[if:" + Birra.randomFloat().toString() + "]" ],
				};

				const ifStatements = this.resolveIf(subContext);
				if(ifStatements < 0) return -1;

				statement.statements = ifStatements;
				statements.push(statement);

				continue;
			}

			if(this.accept("KEYWORD", "else") === 0) {
				if((options.acceptElse === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"else\" declaration");
					return -1;
				}

				break;
			}

			if(this.accept("KEYWORD", "end") === 0) {
				if((options.acceptEnd === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"end\" declaration");
					return -1;
				}

				break;
			}

			if(this.accept("KEYWORD", "break") === 0) {
				if((options.acceptBreak === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"break\" declaration");
					return -1;
				}

				if(this.next() < 0) return -1;

				statement.type = "BREAK";
				statements.push(statement);

				continue;
			}

			if(this.accept("KEYWORD", "continue") === 0) {
				if((options.acceptContinue === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"continue\" declaration");
					return -1;
				}

				if(this.next() < 0) return -1;

				statement.type = "CONTINUE";
				statements.push(statement);

				continue;
			}

			if(this.accept("KEYWORD", "return") === 0) {
				if((options.acceptReturn === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected \"return\" declaration");
					return -1;
				}

				if(this.next() < 0) return -1;

				statement.type = "RETURN";
				statement.value = this.resolveExpression();
				if(statement.value < 0) return -1;

				statements.push(statement);

				continue;
			}

			if(this.accept("EOF") === 0) {
				if((options.acceptEOF === false) || prevKeywords) {
					this.errorAtCurrToken("Unexpected End of File");
					return -1;
				}

				break;
			}
			
			Birra.printDebug("@[Parser.block] Goin' to end of loop:", this.currToken);

			const expressions = this.resolveCommaExpressions(statement);
			if(expressions < 0) return -1;

			statement.type = "EXPRESSIONS";
			statement.statements = expressions;

			statements.push(statement);
		}

		return statements;
	}

	parse(src, tokens) {
		if(tokens < 0) return -1;
		this.reset(src, tokens);

		return this.resolveBlock("ROOT");
	}
};

module.exports = BirraParser;
