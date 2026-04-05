---
title: 递归下降解析器浅论
date: 2026-04-05
format: Markdown
author: Armand
author_role: armand.dev
description: 从上下文无关文法出发，用 C++ 手写一个能处理表达式、函数调用和错误恢复的递归下降解析器。
---

解析器大概是编译器前端里最好玩的部分。

词法分析器枯燥，就是个大 switch；语义分析烧脑，类型系统一复杂就很容易绕进去；代码生成离得太远，很多项目根本走不到那步。解析器刚好在中间：它有形式化的理论支撑，又可以直接翻译成能跑的代码，写完还能立刻看到效果。

我在 Aethe 里用的就是递归下降，这篇文章将介绍从理论到实践的递归下降解析器写法。

---

## 小引

解析器的输入是 token 序列，输出是抽象语法树（AST）。

Token 是词法分析的产物。`1 + 2 * 3` 经过词法分析变成 `[NUMBER(1), PLUS, NUMBER(2), STAR, NUMBER(3), EOF]`。这个序列是线性的，没有任何结构。解析器要做的事，是把线性序列变成一棵树，让树的形状反映出语言的结构和优先级：

```
    +
   / \
  1   *
     / \
    2   3
```

从树的底部往上读：先算乘法，结果和 1 相加。优先级在树的形状里体现出来了。后续的语义分析和代码生成直接走这棵树，不再看原始 token。

---

## 上下文无关文法

递归下降的出发点是**上下文无关文法**（CFG，Context-Free Grammar）。先把语言的语法用文法写出来，再把文法翻译成代码。这不是多此一举——文法是解析器的设计文档，写清楚了，代码几乎是机械翻译。

对于表达式语言，文法大概这样写：

$$
\begin{aligned}
\text{expr}    &\;\to\; \text{add} \\
\text{add}     &\;\to\; \text{mul}\;((+\mid-)\;\text{mul})^* \\
\text{mul}     &\;\to\; \text{unary}\;((\times\mid\div)\;\text{unary})^* \\
\text{unary}   &\;\to\; {-}\;\text{unary}\;\mid\;\text{call} \\
\text{call}    &\;\to\; \text{primary}\;(\,\text{'('}\;\text{args}?\;\text{')'}\,)^* \\
\text{primary} &\;\to\; \texttt{NUMBER}\;\mid\;\texttt{IDENT}\;\mid\;\text{'('}\;\text{expr}\;\text{')'} \\
\text{args}    &\;\to\; \text{expr}\;(\,\text{','}\;\text{expr}\,)^*
\end{aligned}
$$

每一行叫一条**产生式**。左边是**非终结符**（non-terminal），右边是它的展开方式。全大写的 `NUMBER`、`IDENT` 是**终结符**（terminal），直接对应 token。`$(\ldots)^*$` 表示零次或多次重复，`$(\ldots)?$` 表示可选——这是 EBNF 记法，比原始 BNF 更紧凑，翻译成代码是 while 循环和 if 语句。

优先级通过**层级**体现：`add` 包含 `mul`，`mul` 包含 `unary`，越靠下的非终结符优先级越高。这不是随意安排，是递归下降机制的核心。解析 `1 + 2 * 3` 时，解析器先进入 `add` 层，`add` 调用 `mul` 来解析操作数，`mul` 把 `2 * 3` 整个吃掉返回，`add` 才把 `1` 和乘法结果拼在一起。层级决定了哪个算符先结合。

---

## 词法分析器

解析器不直接处理字符串，从词法分析器（lexer）拿 token。词法分析器的工作相对机械：跳过空白和注释，把字符序列切成 token，每个 token 带类型、原始文本和行号。

```cpp
enum class TokenType {
    Number, Ident, String,
    Plus, Minus, Star, Slash,
    LParen, RParen, Comma,
    Eof, Error
};

struct Token {
    TokenType        type;
    std::string_view text;  // 指向原始输入，不做拷贝
    int              line;
};
```

用 `string_view` 而不是 `string`：token 的文本直接引用原始输入缓冲区，避免大量小字符串的堆分配。前提是在解析期间保持输入缓冲区的生命周期，通常不是问题。

词法分析器本身就是一个大循环加 switch，识别各类 token。这里略过具体实现，假设有一个 `Lexer` 类，`next()` 方法返回下一个 token，遇到末尾返回 `TokenType::Eof`。

---

## 解析器骨架

解析器持有词法分析器的引用，维护一个"当前 token"：

```cpp
class Parser {
public:
    explicit Parser(Lexer& lex) : lexer(lex) {
        advance();  // 填充 current
    }

    NodePtr parse() { return parse_expr(); }

private:
    Lexer& lexer;
    Token  current;
    Token  previous;
    bool   had_error = false;

    void advance() {
        previous = current;
        current  = lexer.next();
    }

    bool check(TokenType t) const {
        return current.type == t;
    }

    bool match(TokenType t) {
        if (!check(t)) return false;
        advance();
        return true;
    }

    Token consume(TokenType t, std::string_view msg) {
        if (!check(t)) error(current, msg);
        Token tok = current;
        advance();
        return tok;
    }
};
```

`check` 看当前 token 但不消耗，`match` 匹配上了就消耗，`consume` 必须匹配否则报错。这三个函数贯穿整个解析器——习惯之后写每个 parse 函数都像填空题。

`previous` 保存刚消耗过的 token，有时要回头看看刚才吃了什么（比如报错时定位行号）。

---

## 核心机制：非终结符 = 函数

递归下降的中心思想是：**文法里每个非终结符，对应解析器里的一个成员函数**。函数消耗若干 token，返回对应的 AST 节点。

文法里的结构直接翻译成代码结构：

| 文法写法 | C++ 写法 |
|---|---|
| $A\;B\;C$（序列） | 依次调用 `parse_a()`, `parse_b()`, `parse_c()` |
| $A \mid B$（选择） | `if-else` 或 `switch`，看当前 token |
| $A^*$（重复） | `while` 循环 |
| $A?$（可选） | `if (match(...))` |

把 `add` 翻译一遍就清楚了：

$$\text{add} \;\to\; \text{mul}\;((+\mid-)\;\text{mul})^*$$

```cpp
NodePtr parse_add() {
    NodePtr left = parse_mul();

    while (check(TokenType::Plus) || check(TokenType::Minus)) {
        BinOp op = current.type == TokenType::Plus ? BinOp::Add : BinOp::Sub;
        advance();
        NodePtr right = parse_mul();
        left = make_node<BinaryNode>(op, std::move(left), std::move(right));
    }

    return left;
}
```

先调 `parse_mul` 拿左操作数，然后 while 循环：只要当前 token 是 `+` 或 `-`，就消耗掉，再调 `parse_mul` 拿右操作数，把两边包成一个二元节点赋给 `left`。循环结束时 `left` 是整个加减链的根节点。

注意每次循环都是 `left = make_binary(op, left, right)`——把已有树包进新节点，实现**左结合**：`1 - 2 - 3` 生成 `((1 - 2) - 3)`，这是减法的正确语义。

`mul` 完全对称，把 `+/-` 换成 `*//` 就行。

---

## 一元运算符

一元取负是右结合的：

$$\text{unary} \;\to\; -\;\text{unary}\;\mid\;\text{call}$$

```cpp
NodePtr parse_unary() {
    if (match(TokenType::Minus)) {
        NodePtr operand = parse_unary();  // 递归
        return make_node<UnaryNode>(UnaryOp::Neg, std::move(operand));
    }
    return parse_call();
}
```

`--x` 会递归两层：外层消耗第一个 `-`，递归进去消耗第二个，最终到 `call` 拿 `x`，然后往外包两次 `Neg`。这个递归不是死循环，因为每次递归都消耗了一个 `-` token，token 有限，递归必然终止。

右结合在递归下降里非常自然——直接递归调自己就是右结合。左结合需要用循环（见 `parse_add`）。这个区别值得记一下。

---

## 函数调用

函数调用的文法用 $(\ldots)^*$ 支持链式调用（如 `f()()` 这种），实际用 $(\ldots)?$ 也可以：

$$\text{call} \;\to\; \text{primary}\;(\,\text{'('}\;\text{args}?\;\text{')'}\,)^*$$

```cpp
NodePtr parse_call() {
    NodePtr callee = parse_primary();

    while (match(TokenType::LParen)) {
        std::vector<NodePtr> args;

        if (!check(TokenType::RParen)) {
            args.push_back(parse_expr());
            while (match(TokenType::Comma)) {
                args.push_back(parse_expr());
            }
        }

        consume(TokenType::RParen, "expect ')' after arguments");
        callee = make_node<CallNode>(std::move(callee), std::move(args));
    }

    return callee;
}
```

进入 while 循环说明刚消耗了 `(`，接下来解析参数列表：先检查是不是立刻就是 `)`（无参调用），不是的话解析第一个参数，然后 while 循环消耗逗号继续解析。最后 `consume` 断言并消耗 `)`。

参数解析用的是 `parse_expr()` 而不是 `parse_add()`——这是为了让参数支持完整表达式，包括以后可能加的赋值表达式之类的东西。文法层级越高，限制越少。

---

## primary：叶节点

`primary` 是递归的最底层，不再调用其他 parse 函数（除了括号里的 `parse_expr`）：

```cpp
NodePtr parse_primary() {
    if (match(TokenType::Number)) {
        double val = std::stod(std::string(previous.text));
        return make_node<LiteralNode>(val);
    }

    if (match(TokenType::Ident)) {
        return make_node<VarNode>(std::string(previous.text));
    }

    if (match(TokenType::LParen)) {
        NodePtr inner = parse_expr();
        consume(TokenType::RParen, "expect ')'");
        return inner;
    }

    error(current, std::string("unexpected token: '") + std::string(current.text) + "'");
}
```

括号这里有点意思：消耗 `(`，调 `parse_expr`（最高层入口），消耗 `)`，返回括号内的节点。括号不产生新的 AST 节点——它只是改变解析路径，让里面的表达式在结构上整体成为一个 `primary`，从而提升了优先级。

---

## 左递归：遇到了会死

递归下降有一个硬限制：如果文法有**直接左递归**，直接翻译成代码会死循环。

比如这样写文法：

$$\text{add} \;\to\; \text{add}\;(+\mid-)\;\text{mul}\;\mid\;\text{mul}$$

翻译成代码：

```cpp
NodePtr parse_add() {
    NodePtr left = parse_add();  // 第一步就调自己，无限递归
    // ...
}
```

第一行没有消耗任何 token，直接递归进自己，栈溢出。

**消除方法**很固定：把 $A \to A\;\alpha \mid \beta$ 改成 $A \to \beta\;\alpha^*$。两种写法描述的语言完全相同，但第二种可以写成 while 循环。这就是为什么文法写的是：

$$\text{add} \;\to\; \text{mul}\;((+\mid-)\;\text{mul})^*$$

还有**间接左递归**：$A \to B \to A$，在手写解析器里通常不会出现，设计文法时能规避。如果真碰到了，也有系统性的消除算法，但那需要先把文法写完整再做变换，这篇文章不展开。

---

## AST 节点设计

解析器返回的东西是 AST，节点怎么设计影响后续所有阶段。C++ 里常见两种方式。

**方式一：继承体系**

```cpp
struct Expr {
    int line = 0;
    virtual ~Expr() = default;
};

struct BinaryExpr : Expr {
    BinOp                  op;
    std::unique_ptr<Expr>  left, right;
};

struct LiteralExpr : Expr {
    double value;
};

struct VarExpr : Expr {
    std::string name;
};

struct CallExpr : Expr {
    std::unique_ptr<Expr>              callee;
    std::vector<std::unique_ptr<Expr>> args;
};
```

优点是可以随时加新节点类型，不改现有代码；缺点是遍历 AST 需要 `dynamic_cast` 或虚函数，而且每加一个遍历 pass 就要写一遍所有节点的分发逻辑。

**方式二：`std::variant`**

```cpp
struct BinaryExpr;
struct LiteralExpr { double value; };
struct VarExpr     { std::string name; };
struct CallExpr;

using Expr = std::variant<LiteralExpr, VarExpr, BinaryExpr, CallExpr>;

struct BinaryExpr {
    BinOp                  op;
    std::unique_ptr<Expr>  left, right;
};

struct CallExpr {
    std::unique_ptr<Expr>              callee;
    std::vector<std::unique_ptr<Expr>> args;
};
```

优点是 `std::visit` 强制处理所有情况，漏掉某个节点类型编译器会告诉你；缺点是循环依赖（`BinaryExpr` 包含 `Expr`，`Expr` 又是 `variant` 包含 `BinaryExpr`）必须用 `unique_ptr` 打断，整体写法更繁琐。

遍历时这样写：

```cpp
double eval(const Expr& e) {
    return std::visit([](const auto& node) -> double {
        using T = std::decay_t<decltype(node)>;
        if constexpr (std::is_same_v<T, LiteralExpr>) {
            return node.value;
        } else if constexpr (std::is_same_v<T, BinaryExpr>) {
            double l = eval(*node.left);
            double r = eval(*node.right);
            // ...
        }
        // 编译器会提示缺少的分支
    }, e);
}
```

我在 Aethe 里用的是第二种方案，配合自定义 arena allocator 管理节点内存——arena 里 bump allocate，解析结束一起释放，避免大量 `unique_ptr` 的单独堆分配和析构开销。这对大文件解析的速度有明显影响。

---

## 错误处理

遇到错误直接崩溃是最简单的做法，但体验很差——用户改一行，报一个错，改完再跑，又报另一个错。最好一次跑完能报出尽量多的错误。

**恐慌模式（panic mode）**：遇到错误后，跳过 token 直到找到一个"同步点"，然后继续解析。同步点通常是语句分隔符（`;`），或者 `if`、`while`、`return` 这类语句开头的关键字。

```cpp
void error(Token tok, const std::string& msg) {
    had_error = true;
    // 打印错误信息，带行号
    std::cerr << "[line " << tok.line << "] Error at '"
              << tok.text << "': " << msg << '\n';
    throw ParseError{};
}

void synchronize() {
    advance();  // 跳过出错的 token
    while (!check(TokenType::Eof)) {
        if (previous.type == TokenType::Semicolon) return;
        switch (current.type) {
            case TokenType::If:
            case TokenType::While:
            case TokenType::Fn:
            case TokenType::Return:
                return;
            default:
                break;
        }
        advance();
    }
}
```

在解析语句的最外层 catch `ParseError`，调 `synchronize`，然后继续：

```cpp
std::vector<StmtPtr> parse_program() {
    std::vector<StmtPtr> stmts;
    while (!check(TokenType::Eof)) {
        try {
            stmts.push_back(parse_stmt());
        } catch (const ParseError&) {
            synchronize();
        }
    }
    return stmts;
}
```

这样一次解析可以报出多个错误，每个语句出错后同步到下一个语句继续走。

恐慌模式不完美：同步点选得不好会产生**级联错误**（cascade errors）——一个真实错误引发后续一连串假错误。比如遗漏了一个 `)`，同步到下一个 `;`，接下来几行的解析全都错乱了。这是解析器错误恢复里最难的部分，至今没有彻底好用的通用解法，只能根据语言的语法具体调整同步策略。

Aethe 里我现在用的是更保守的策略：同步点尽量多，错误信息尽量具体，宁可少报几个后续错误，也不要误导用户。

---

## 完整跑一遍：`1 + 2 * 3`

把上面的所有函数串起来，看一遍 `1 + 2 * 3` 的解析过程。

Token 序列：`NUMBER(1) PLUS NUMBER(2) STAR NUMBER(3) EOF`

调用栈展开：

1. `parse_expr()` → `parse_add()`
2. `parse_add()` 调 `parse_mul()`
3. `parse_mul()` 调 `parse_unary()` → `parse_call()` → `parse_primary()`
4. `parse_primary()` 匹配 `NUMBER(1)`，返回 `Literal(1.0)`
5. 回到 `parse_mul()`：当前 token 是 `PLUS`，不是 `*` 或 `/`，while 不进入，返回 `Literal(1.0)`
6. 回到 `parse_add()`：当前 token 是 `PLUS`，进入 while
7. 消耗 `PLUS`，调 `parse_mul()`
8. `parse_mul()` 调 `parse_primary()` 拿到 `Literal(2.0)`
9. 当前 token 是 `STAR`，进入 while
10. 消耗 `STAR`，调 `parse_unary()` → ... → `Literal(3.0)`
11. 当前 token 是 `EOF`，不是 `*` 或 `/`，while 退出，返回 `Binary(Mul, 2, 3)`
12. 回到 `parse_add()`：当前 token 是 `EOF`，while 退出
13. 返回 `Binary(Add, 1, Binary(Mul, 2, 3))`

树的形状正确，调用栈里自然地体现了优先级：`parse_mul` 的调用层级比 `parse_add` 更深，所以乘法先被解析、先被结合。

---

## 还有些没覆盖的东西

这篇文章的范围是表达式解析。实际写一门完整语言，还有几个方向：

**语句和声明**。`if`、`while`、函数定义这些有自己的产生式，和表达式层级并列。写法完全一样，就是多几个 `parse_if()`、`parse_while()` 函数，每个函数对应一条产生式。

**Pratt 解析**。递归下降处理前缀和中缀运算符很直接，但如果语言里有很多优先级层级，或者需要支持用户自定义运算符优先级（像 Haskell 那样），维护一堆 `parse_levelN` 函数就很麻烦。Pratt 解析器用一张数字化的优先级表替代文法层级，可以动态修改，代码也更短。两种方法可以混用：用 Pratt 处理表达式，递归下降处理语句和声明。

**FIRST 和 FOLLOW 集**。形式化地分析文法，判断解析器在哪个位置需要往前看几个 token（lookahead），能否避免回溯。这是 LL(1) 解析理论的核心，手写解析器里不一定要算，但碰到歧义时这套工具很好用。

**符号解析**。解析器输出的 AST 里变量名只是字符串。后续要一个单独的语义分析阶段，把名字绑定到声明，做作用域分析，检查类型。解析和语义分析解耦着写更干净——不要把符号表查询混进 `parse_primary()`，那条路只会越来越乱。

---

递归下降最大的优点是**可读性**。代码结构和文法结构直接对应，哪个函数负责哪条产生式，一眼就清楚。Aethe 的解析器现在大概两千行，文法有五十多条产生式，但基本每个函数读一眼就知道在干什么，不需要注释。这在自己写的项目里难能可贵，调 bug 的时候省了很多时间。

---

## 进一步看

- *Crafting Interpreters*，Robert Nystrom。在线免费，是我见过把递归下降讲得最清楚的材料，而且实际从头写了一门完整语言，不是玩具。
- *Engineering a Compiler*，Cooper & Torczon。更系统，适合看 FIRST/FOLLOW 集的证明、LL/LR 解析的形式化讨论。
- Aethe 源码：[github.com/QianCream/Aethe](https://github.com/QianCream/Aethe)，解析器在 `src/parser/` 目录下，产生式在注释里都标了。
