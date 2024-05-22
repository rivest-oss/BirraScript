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

			if(value !== false)
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

		if(operatorPtr === false) operatorPtr = Birra.OPERATORS_PRECEDENCE.length - 1;

		if(operatorPtr === 0) {
			callback = () => this.resolveExpression();
		} else {
			callback = () => this.resolveBinaryOp(operatorPtr - 1);
		}

		let left = callback();
		if(left < 0) return -1;

		while(this.accept("OPERATOR", Birra.OPERATORS_PRECEDENCE[operatorPtr]) === 0) {
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
		Birra.printDebug("@[resolveFunction]", "[TODO]");
	}

	resolveSimpleAssignment(modus) {
		if(this.expect("VARIABLE") < 0) return -1;

		const left = this.currToken;

		if(this.next() < 0) return -1;

		if(this.expect("OPERATOR", "=") < 0) return -1;
		const operator = this.currToken;

		if(this.next() < 0) return -1;

		const right = this.resolveBinaryOp();
		if(right < 0) return -1;

		return {
			type: "ASSIGNMENT",
			operator,
			modus,
			left,
			right,
		};
	}

	block(allowEND, mustComma) {
		const statements = [];

		while(true) {
			if(this.accept("KEYWORD", "let") === 0) {
				if(this.next() < 0) return -1;

				while(true) {
					const assignment = this.resolveSimpleAssignment("LET");
					if(assignment < 0) return -1;

					statements.push(assignment);

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
					const assignment = this.resolveSimpleAssignment("CONST");
					if(assignment < 0) return -1;

					statements.push(assignment);

					if(this.accept("OPERATOR", ",") === 0) {
						if(this.next() < 0) return -1;
						continue;
					}

					break;
				}

				continue;
			}

			Birra.printDebug("@[Parser.block] Goin' to end of loop:", this.currToken);

			if(mustComma) break;

			// [TODO]
			break;
		}
		
		return statements;
	}

	parse(src, tokens) {
		if(tokens < 0) return -1;
		this.reset(src, tokens);

		return this.block(false, false);
	}
};

module.exports = BirraParser;
