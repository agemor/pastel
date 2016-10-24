import Parser from "./parser.js";
import Token from "./token.js";
import Node from "./node.js";
import Error from "./error.js";

class Evaluator {
    constructor() {

        this.parser = new Parser();
        this.definition = new Object();

        defineBasicFunctions();
    }

    evaluateText(text) {
        let node = this.parser.analyze(text);
        return evaluateNode(node);
    }

    evaluateNode(node, parameters) {

        // 만약 자식이 없는 노드라면, 데이터 추출
        if (node.hasChildren()) {
            let token = node.getData();
            if (token.type == Token.NUMBER) {
                return Number(token.data);
            } else {

                // 파라미터 체크 (파라미터가 정의보다 우선순위)
                if (token.data in parameters) {
                    return parameters[token.data];
                }

                // 정의 체크
                if (token.data in this.definition) {

                    // 만약, 파라미터가 없는 함수일 경우, 값 평가 후 리턴
                    if (this.definition[token.data] instanceof Array && this.definition[token.data][0].length == 0) {
                        let value = this.evaluateNode(this.definition[token.data][1]);
                        if (value instanceof Error)
                            return value.after(children[0].getData().location);
                        return value;
                    }
                }

                return token.data;
            }
        }

        // 자식이 있다면
        else {
            let children = node.getChildren();
            
            // 첫번째는 무조건 serialize
            let head = evaluateNode(children[0]);
            if (head instanceof Error)
                return head.after(children[0].getData().location);
            let list = [head];

            // define 문은 id 리턴
            if (list[0] == "define") {
                if (children.length < 3)
                    return new Error(Error.SYNTAX, "Define clause needs at least 3 parameters", children[0].getData().location);
                
                // 이름 가져오기. 이름은 run-time에 explicit 해야 함
                let name = evaluateNode(children[1]);
                if (name instanceof Error)
                    return name.after(children[1].getData().location);

                // 선언은 바꿀 수 없음
                if (name in this.definition) 
                    return new Error(Error.SYNTAX, "The definition " + name +" already exists.", children[1].getData().location);

                // 파라미터가 있을 경우
                if (children.length > 3) {

                    // 파라미터 가져오기. 파라미터 배열은 무조건 linear id 배열 형태여야 함.
                    let parameters = evaluateNode(children[2]); // 배열 리턴
                    if (parameters instanceof Error)
                        return parameters.after(children[2].getData().location);

                    // 파라미터 타입 체크는 당장은 하지 않는다.
                    this.definition[name] = [/*파라미터*/parameters, /*코드블록*/children[3]];
                }

                // 파라미터가 없을 경우: 상수 함수
                else {
                    // 함수 정의 리스트에 노드 추가.
                    this.definition[name] = [/*파라미터*/[], /*코드블록*/children[2]];
                }

                return name;
            }

            // 람다식 익명 함수 이름 리턴
            if (list[0] == "lambda") {

            }

            // 메모이제이션
            if (list[0] == "memoize") {

            }


            // 만약 late-serialize 문, 즉 if 가 아니면 나머지도 serialize
            if (list[0] != "if") {
                for (let i = 1; i < children.length; i++) {
                    let body = evaluateNode(children[i]);
                    if (body instanceof Error)
                        return body.after(children[i].getData().location);
                    list.push(body);
                }
            }

            // 만약 if문이면
            else {

                // 파라미터 체크
                if (children.length < 3)
                    return new Error(Error.SYNTAX, "If clause needs at least 3 parameters", children[0].getData().location);

                // 두 번째 인수 평가
                let conditional = evaluateNode(children[1]);
                if (conditional instanceof Error)
                    return conditional.after(children[1].getData().location);

                let clauseValue = 0;

                // 만약 참이면
                if (conditional) {
                    // 세 번째 인수 평가
                    let trueClause = evaluateNode(children[2]);
                    if (trueClause instanceof Error)
                        return trueClause.after(children[2].getData().location);
                    clauseValue = trueClause;
                }

                // 거짓이면
                else if (children.length > 3) {
                    let falseCluase = evaluateNode(children[3]);
                    if (falseCluase instanceof Error)
                        return falseCluase.after(children[3].getData().location);
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
                        return new Error(Error.SYNTAX, "Definiton " + head + " needs " + parameterKeys.length + " parameters", children[0].getData().location);

                    // 파라미터 매핑
                    let parameterMap = new Object();
                    for (let i = 0; i < parameterKeys.length; i++) {
                        parameterMap[parameterKeys[i]] = list[i + 1];
                    }

                    // 값 계산
                    let value = evaluateNode(this.definition[head][1], parameterMap);
                    if (value instanceof Error)
                        return value.after(children[0].getData().location);

                    return value;
                }

                // 빌트인 정의
                else {

                    // 그대로 인수로 넘긴다.
                    list.shift();
                    let value = this.definition[head](list);
                    if (value instanceof Error)
                        return value.after(children[0].getData().location);

                    return value;
                }
            }

            // 리스트
            return list;
        }
    }

    defineBasicFunctions() {

        function checkParameters(operands, minimum, maximum) {
            if (operands.length < minimum) {
                return Error(Error.SYNTAX, "At least " + minimum + " parameters are required");
            } else if (operands.length > maximum) {
                return Error(Error.SYNTAX, "Number of function parameters must be under " + maximum);
            }
            return null;
        }
        function cumulative(operands, operator, minimum = 1, maximum = 10000) {
            let isError = check(operands, minimum, maximum);
            if (isError instanceof Error) return isError; 
            let value = 0;
            for (let i = 0; i < operands.length; i++)
                value = operator(value, operands[i]);
            return value;
        }
        function decisive(operands, operator, minimum = 1, maximum = 10000) {
            let isError = check(operands, minimum, maximum);
            if (isError instanceof Error) return isError;
            let head = operands[0];
            for (let i = 1; i < operands.length; i++) {
                if (operator(head, operands[i]))
                    head = operands[i];
                else return false;
            }
            return true;
        }

        this.definition["+"]  = function() { return cumulative(arguments, (a, b) => { return a + b; }, 2); };
        this.definition["-"]  = function() { return cumulative(arguments, (a, b) => { return a - b; }, 2); };
        this.definition["*"]  = function() { return cumulative(arguments, (a, b) => { return a * b; }, 2); };
        this.definition["/"]  = function() { return cumulative(arguments, (a, b) => { return a / b; }, 2); };
        this.definition["%"]  = function() { return cumulative(arguments, (a, b) => { return a % b; }, 2, 2); };
        this.definition["&"]  = function() { return cumulative(arguments, (a, b) => { return a & b; }, 2); };
        this.definition["|"]  = function() { return cumulative(arguments, (a, b) => { return a | b; }, 2); };
        this.definition["^"]  = function() { return cumulative(arguments, (a, b) => { return a ^ b; }, 2); };
        this.definition["<<"] = function() { return cumulative(arguments, (a, b) => { return a << b; }, 2); };
        this.definition[">>"] = function() { return cumulative(arguments, (a, b) => { return a >> b; }, 2); };
        this.definition["~"]  = function(a) { return ~a; };
        this.definition["="]  = function() { return decisive(arguments, (a, b) => { return a == b; }, 2); };
        this.definition["!="] = function() { return decisive(arguments, (a, b) => { return a != b; }, 2); };
        this.definition["<"]  = function() { return decisive(arguments, (a, b) => { return a < b; }, 2); };
        this.definition[">"]  = function() { return decisive(arguments, (a, b) => { return a > b; }, 2); };
        this.definition["<="] = function() { return decisive(arguments, (a, b) => { return a <= b; }, 2); };
        this.definition[">="] = function() { return decisive(arguments, (a, b) => { return a >= b; }, 2); };
        this.definition["&&"] = function() { return decisive(arguments, (a, b) => { return a && b; }, 2); };
        this.definition["||"] = function() { return decisive(arguments, (a, b) => { return a || b; }, 2); };
        this.definition["!"]  = function(a) { return !a; };
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
