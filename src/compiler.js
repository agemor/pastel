import Parser from "./parser.js";
import Token from "./token.js";
import Node from "./node.js";
import Opcodes from "./opcodes.js";
import SymbolTable from "./symboltable.js";
import Error from "./error.js";

class Compiler {
    
    constructor() {
        this.parser = new Parser();
        this.initialize();
    }

    initialize() {
        this.definition = new Object();
        this.memoization = new Object();

        this.defineBasicFunctions();
    }

    compileText(text) {

        this.initialize();

        let node = this.parser.analyze(text);

        if (node instanceof Error) {
            console.log(node.message);
            return node;
        }
        let opcodes = new Opcodes();
        let symbolTable = new SymbolTable();
        this.compileNode(node, opcodes, symbolTable);

        return opcodes.codes.join("\n");
    }

    compileNode(node, opcodes, symbolTable) {

        // 만약 자식이 없는 노드라면, 데이터 추출
        if (!node.hasChildren()) {
            let token = node.getData();

            // 여러 토큰 타입 대응
            switch(token.type) {
                case Token.STRING:
                case Token.NUMBER:
                    opcodes.add(Opcodes.PUSH, token.data);
                    break;
                case Token.ID:

                    // 상수
                    if (symbolTable.constants.hasItem(token.data)) {
                        let constantValue = symbolTable.constants.getProperty(token.data);
                        opcodes.add(Opcodes.PUSH, constantValue);
                    }

                    // 파라미터
                    else if (false) {

                    }
                    
                    // 등록되지 않은 id
                    else {
                        // 경고 정도는 표시해줄수도 있다.
                        return opcodes.add(Opcodes.PUSH, token.data);
                    }
                    break;
            }

        }

        // 자식이 있다면
        else {
            let children = node.getChildren();

            // 첫번째는 무조건 serialize
            let head = children[0].getData().data;
            let list = [head];

            // define문은 non-stack 타입. 리턴 null
            if (list[0] == "define") {
                if (children.length < 3)
                    return new Error(Error.SYNTAX, "Define clause needs at least 3 parameters", children[0].getData().lineNumber);

                // 이름 가져오기. 이름은 run-time에 explicit 해야 함. 그렇다고 동적 할당이 안되는 것은 아님!
                let name = this.compileNode(children[1], parameters);
                if (name instanceof Error)
                    return name.after(children[1].getData().lineNumber);

                // 선언은 바꿀 수 없음
                if (name in this.definition) {
                    return null;
                    //return new Error(Error.SYNTAX, "The definition " + name +" already exists.", children[1].getData().lineNumber);
                }

                // 파라미터가 있을 경우
                if (children.length > 3) {

                    // 파라미터 가져오기. 파라미터 배열은 무조건 linear id 배열 형태여야 함.
                    let parameters = this.compileNode(children[2], parameters); // 배열 리턴
                    if (parameters instanceof Error)
                        return parameters.after(children[2].getData().lineNumber);

                    // 파라미터 타입 체크는 당장은 하지 않는다.
                    this.definition[name] = [/*파라미터*/parameters, /*코드블록*/children[3]];
                }

                // 파라미터가 없을 경우: 상수 함수
                else {
                    // 함수 정의 리스트에 노드 추가.
                    this.definition[name] = [/*파라미터*/[], /*코드블록*/children[2]];
                }

                return null;
            }

            // 람다식 익명 함수 이름 리턴
            if (list[0] == "lambda") {

            }

            // 메모이제이션. 플래그를 on 시킨다. 나머지는 그냥 재귀처리.
            if (list[0] == "memoize") {

                // 함수 이름 구하기

            }


            // 만약 late-serialize 문, 즉 if 가 아니면 나머지도 serialize
            if (list[0] != "if") {
                for (let i = 1; i < children.length; i++) {
                    let body = this.compileNode(children[i], parameters);
                    if (body == null) continue;
                    if (body instanceof Error)
                        return body;
                    list.push(body);
                }
            }

            // 만약 if문이면
            else {

                // 파라미터 체크
                if (children.length < 3)
                    return new Error(Error.SYNTAX, "If clause needs at least 3 parameters", children[0].getData().lineNumber);

                // 두 번째 인수 평가
                let conditional = this.compileNode(children[1], parameters);

                if (conditional instanceof Error) {
                    console.log(conditional)
                    return conditional.after(children[1].getData().lineNumber);
                }

                let clauseValue = 0;

                // 만약 참이면
                if (conditional) {
                    // 세 번째 인수 평가
                    let trueClause = this.compileNode(children[2], parameters);
                    if (trueClause instanceof Error)
                        return trueClause.after(children[2].getData().lineNumber);
                    clauseValue = trueClause;
                }

                // 거짓이면
                else if (children.length > 3) {
                    let falseCluase = this.compileNode(children[3], parameters);
                    if (falseCluase instanceof Error)
                        return falseCluase.after(children[3].getData().lineNumber);
                    clauseValue = falseCluase;
                } else {
                    clauseValue = undefined;
                }

                return clauseValue;
            }

            // 함수 체크
            if (head in this.definition) {

                // 커스텀 정의
                if (this.definition[head] instanceof Array) {

                    let parameterKeys = this.definition[head][0];

                    // 파라미터 길이 체크
                    if (list.length - 1 != parameterKeys.length)
                        return new Error(Error.SYNTAX, "Definiton " + head + " needs " + parameterKeys.length + " parameters", children[0].getData().lineNumber);

                    // 파라미터 매핑
                    let parameterMap = new Object();
                    for (let i = 0; i < parameterKeys.length; i++) {
                        parameterMap[parameterKeys[i]] = list[i + 1];
                    }
                    // 값 계산
                    let value = this.compileNode(this.definition[head][1], parameterMap);
                    if (value instanceof Error)
                        return value.after(children[0].getData().lineNumber);

                    return value;
                }

                // 빌트인 정의
                else {

                    // 그대로 인수로 넘긴다.
                    list.shift();

                    let value = this.definition[head](list);
                    if (value instanceof Error)
                        return value.after(children[0].getData().lineNumber);

                    return value;
                }
            }

            // unstack resource를 제거한다.
            list = list.filter(function(n){ return n != null });

            // 리스트. 값을 최대한 깐다(pill)
            if (list.length == 1)
                return list[0];
            else
                return list;
        }
    }


    defineBasicFunctions() {

        function checkParameters(operands, minimum, maximum) {
            if (operands.length < minimum) {
                return new Error(Error.SYNTAX, "At least " + minimum + " parameters are required");
            } else if (operands.length > maximum) {
                return new Error(Error.SYNTAX, "Number of function parameters must be under " + maximum);
            }
            return null;
        }
        function cumulative(operands, operator, minimum = 1, maximum = 10000) {
            let isError = checkParameters(operands, minimum, maximum);
            if (isError instanceof Error) return isError;
            let value = operands[0];
            for (let i = 1; i < operands.length; i++)
                value = operator(value, operands[i]);
            return value;
        }
        function decisive(operands, operator, minimum = 1, maximum = 10000) {
            let isError = checkParameters(operands, minimum, maximum);
            if (isError instanceof Error) return isError;
            let head = operands[0];
            for (let i = 1; i < operands.length; i++) {
                if (operator(head, operands[i]))
                    head = operands[i];
                else return false;
            }
            return true;
        }

        this.definition["+"]  = function(args) { return cumulative(args, (a, b) => { return a + b; }, 2); };
        this.definition["-"]  = function(args) { return cumulative(args, (a, b) => { return a - b; }, 2); };
        this.definition["*"]  = function(args) { return cumulative(args, (a, b) => { return a * b; }, 2); };
        this.definition["/"]  = function(args) { return cumulative(args, (a, b) => { return a / b; }, 2); };
        this.definition["%"]  = function(args) { return cumulative(args, (a, b) => { return a % b; }, 2, 2); };
        this.definition["&"]  = function(args) { return cumulative(args, (a, b) => { return a & b; }, 2); };
        this.definition["|"]  = function(args) { return cumulative(args, (a, b) => { return a | b; }, 2); };
        this.definition["^"]  = function(args) { return cumulative(args, (a, b) => { return a ^ b; }, 2); };
        this.definition["<<"] = function(args) { return cumulative(args, (a, b) => { return a << b; }, 2); };
        this.definition[">>"] = function(args) { return cumulative(args, (a, b) => { return a >> b; }, 2); };
        this.definition["~"]  = function(args) { return ~args[0]; };
        this.definition["="]  = function(args) { return decisive(args, (a, b) => { return a == b; }, 2); };
        this.definition["!="] = function(args) { return decisive(args, (a, b) => { return a != b; }, 2); };
        this.definition["<"]  = function(args) { return decisive(args, (a, b) => { return a < b; }, 2); };
        this.definition[">"]  = function(args) { return decisive(args, (a, b) => { return a > b; }, 2); };
        this.definition["<="] = function(args) { return decisive(args, (a, b) => { return a <= b; }, 2); };
        this.definition[">="] = function(args) { return decisive(args, (a, b) => { return a >= b; }, 2); };
        this.definition["&&"] = function(args) { return decisive(args, (a, b) => { return a && b; }, 2); };
        this.definition["||"] = function(args) { return decisive(args, (a, b) => { return a || b; }, 2); };
        this.definition["!"]  = function(args) { return !args[0]; };
        this.definition["zero"]  = function(args) { return args[0] == 0 ? 1 : 0; };
        this.definition["square"]  = function(args) { return Math.sqrt(args[0]); };
        this.definition["print"]  = function(args) { console.log(args[0]); return args[0]; };
        this.definition["add"]      = this.definition["+"];
        this.definition["subtract"] = this.definition["-"];
        this.definition["multiply"] = this.definition["*"];
        this.definition["divide"]   = this.definition["/"];
        this.definition["modular"]  = this.definition["%"];
        this.definition["equals"]   = this.definition["="];
        this.definition["differs"]  = this.definition["!="];
        this.definition["smaller"]  = this.definition["<"];
        this.definition["bigger"]   = this.definition[">"];
        this.definition["below"]    = this.definition["<="];
        this.definition["above"]    = this.definition[">="];
        this.definition["and"]      = this.definition["&&"];
        this.definition["or"]       = this.definition["||"];
        this.definition["not"]      = this.definition["!"];
    }
}

export default Compiler;
