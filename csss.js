// csss.js
const fs = require('fs');

// 1. Lexer: Tokenize input with example comments
class Lexer {
  constructor(input) {
    this.input = input.trim();
    this.pos = 0;
    this.tokens = [];
  }

  tokenize() {
    while (this.pos < this.input.length) {
      let char = this.input[this.pos];

      // Whitespace: "  \n\t"
      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      // Identifier: "div", "loop", "times", "say", "color"
      if (/[a-zA-Z]/.test(char)) {
        let value = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9-]/.test(this.input[this.pos])) {
          value += this.input[this.pos++];
        }
        this.tokens.push({ type: 'Identifier', value });
        continue;
      }

      // Number: "3", "42"
      if (/[0-9]/.test(char)) {
        let value = '';
        while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
          value += this.input[this.pos++];
        }
        this.tokens.push({ type: 'Number', value });
        continue;
      }

      // String: "\"hello\""
      if (char === '"') {
        let value = '';
        this.pos++;
        while (this.pos < this.input.length && this.input[this.pos] !== '"') {
          value += this.input[this.pos++];
        }
        this.pos++;
        this.tokens.push({ type: 'String', value });
        continue;
      }

      // Comment: "/* this is a comment */"
      if (char === '/' && this.input[this.pos + 1] === '*') {
        this.pos += 2;
        while (this.pos < this.input.length && !(this.input[this.pos] === '*' && this.input[this.pos + 1] === '/')) {
          this.pos++;
        }
        this.pos += 2;
        continue;
      }

      // Ampersand: "&" (for nested loops)
      if (char === '&') {
        this.tokens.push({ type: 'Ampersand', value: '&' });
        this.pos++;
        continue;
      }

      // Left Brace: "{"
      if (char === '{') this.tokens.push({ type: 'LBrace', value: '{' });
      // Right Brace: "}"
      else if (char === '}') this.tokens.push({ type: 'RBrace', value: '}' });
      // Colon: ":"
      else if (char === ':') this.tokens.push({ type: 'Colon', value: ':' });
      // Semicolon: ";"
      else if (char === ';') this.tokens.push({ type: 'Semicolon', value: ';' });
      else throw new Error(`Unexpected character: ${char} at position ${this.pos}`);
      this.pos++;
    }
    return this.tokens;
  }
}

// 2. Parser: Handle variables in say:
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse() {
    const ast = { type: 'Program', body: [] };
    while (this.pos < this.tokens.length) {
      ast.body.push(this.parseRule());
    }
    return ast;
  }

  parseRule() {
    const selector = this.consume('Identifier');
    this.consume('LBrace');
    const declarations = [];
    while (this.tokens[this.pos] && this.tokens[this.pos].type !== 'RBrace') {
      declarations.push(this.parseDeclaration());
    }
    this.consume('RBrace');
    return { type: 'Rule', selector: selector.value, declarations };
  }

  parseDeclaration() {
    const token = this.tokens[this.pos];
    if (token.type === 'Identifier' && token.value === 'loop') {
      this.consume('Identifier');
      this.consume('LBrace');
      const body = [];
      while (this.tokens[this.pos] && this.tokens[this.pos].type !== 'RBrace') {
        body.push(this.parseDeclaration());
      }
      this.consume('RBrace');
      return { type: 'Loop', body };
    } else if (token.type === 'Ampersand') {
      this.consume('Ampersand');
      this.consume('Identifier', 'loop');
      this.consume('LBrace');
      const body = [];
      while (this.tokens[this.pos] && this.tokens[this.pos].type !== 'RBrace') {
        body.push(this.parseDeclaration());
      }
      this.consume('RBrace');
      return { type: 'NestedLoop', body };
    } else {
      const property = this.consume('Identifier');
      this.consume('Colon');
      const value = this.parseValue();
      this.consume('Semicolon');
      return { type: 'Declaration', property: property.value, value };
    }
  }

  parseValue() {
    const token = this.tokens[this.pos];
    if (token.type === 'Number') {
      this.pos++;
      return { type: 'Literal', value: parseInt(token.value) };
    } else if (token.type === 'String') {
      this.pos++;
      return { type: 'Literal', value: token.value };
    } else if (token.type === 'Identifier') {
      this.pos++;
      return { type: 'Variable', name: token.value };
    }
    throw new Error(`Unexpected token in value: ${token.type}`);
  }

  consume(expectedType, expectedValue) {
    const token = this.tokens[this.pos++];
    if (!token || token.type !== expectedType || (expectedValue && token.value !== expectedValue)) {
      throw new Error(`Expected ${expectedType}${expectedValue ? `:${expectedValue}` : ''}, got ${token?.type || 'EOF'}:${token?.value || ''}`);
    }
    return token;
  }
}

// 3. Generator: Access variables in say:
class Generator {
  constructor(ast) {
    this.ast = ast;
    this.variables = new Set();
  }

  generate() {
    let js = '';
    for (const node of this.ast.body) {
      js += this.generateNode(node);
    }
    return js;
  }

  generateNode(node) {
    if (node.type === 'Rule') {
      let js = '';
      for (const decl of node.declarations) {
        js += this.generateDeclaration(decl);
      }
      return js;
    }
    throw new Error(`Unknown node type: ${node.type}`);
  }

  generateDeclaration(decl) {
    if (decl.type === 'Loop') {
      let times = 1;
      let bodyJs = '';
      for (const innerDecl of decl.body) {
        if (innerDecl.type === 'Declaration' && innerDecl.property === 'times') {
          times = innerDecl.value.value;
        } else {
          bodyJs += this.generateDeclaration(innerDecl);
        }
      }
      return `for(let i = 0; i < ${times}; i++) {\n${bodyJs}}\n`;
    } else if (decl.type === 'NestedLoop') {
      let times = 1;
      let bodyJs = '';
      for (const innerDecl of decl.body) {
        if (innerDecl.type === 'Declaration' && innerDecl.property === 'times') {
          times = innerDecl.value.value;
        } else {
          bodyJs += this.generateDeclaration(innerDecl);
        }
      }
      return `for(let j = 0; j < ${times}; j++) {\n${bodyJs}}\n`;
    } else if (decl.type === 'Declaration') {
      if (decl.property === 'say') {
        if (decl.value.type === 'Variable') {
          return `console.log(${decl.value.name});\n`;
        } else {
          return `console.log(${JSON.stringify(decl.value.value)});\n`;
        }
      } else if (decl.property !== 'times') {
        this.variables.add(decl.property);
        return `let ${decl.property} = ${decl.value.type === 'Literal' ? JSON.stringify(decl.value.value) : decl.value.name};\n`;
      }
    }
    return '';
  }
}

// 4. Transpile and Execute
function transpile(input) {
  const lexer = new Lexer(input);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const generator = new Generator(ast);
  return generator.generate();
}

// CLI Handling: Accept .css or .csss
if (process.argv.length < 3) {
  console.error('Usage: node csss.js <file.css|file.csss>');
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath.endsWith('.css') && !filePath.endsWith('.csss')) {
  console.error('File must have .css or .csss extension');
  process.exit(1);
}

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }
  try {
    const jsCode = transpile(data);
    eval(jsCode);
  } catch (e) {
    console.error(`Error processing CSSS: ${e.message}`);
    process.exit(1);
  }
});