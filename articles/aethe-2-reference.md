---
title: Aethe 语言参考
description: 结合 Aethe 2 参考文档整理其实现范围、词法规则、管道语义、对象系统与内建能力，适合作为查询入口。
summary: 面向查询场景梳理 Aethe 2 的核心语法、管道机制、可调用对象和常用内建能力。
date: 2026-04-02
format: Markdown
author: Armand
author_role: armand.dev
avatar: ../img/avatar.jpeg
---

## 小引

这篇文章整理自 Aethe 2 的语言参考文档。

---

## 一、当前实现的范围

截至 Aethe 2 / 2.6.0，当前实现可以概括为：

- 单文件解释器实现
- 编译标准为 C++11
- 默认运行方式是终端 IDE
- 支持 `--repl`
- 支持 `--run <file.ae>`
- 暂不支持模块系统
- 暂不支持静态类型系统
- 暂不支持类型注解

已经实现的重点能力包括：

- `fn`、`flow`
- `stage`
- 匿名 `pipe(...) { ... }`
- `type` 对象系统
- 条件、匹配、循环、延迟执行
- 自动首参注入、占位符注入、多位置复用
- 裸标识符作为变量名、字段名和筛选值
- 较完整的字符串、容器与集合式内建阶段

---

## 二、词法与值模型

### 2.1 词法约定

Aethe 的基础词法很直接：

- 空白符只负责分隔记号
- 仅支持单行注释 `//`
- 标识符首字符是字母或下划线，后续可接数字
- 当前数字字面量只支持十进制整数
- 字符串使用双引号

关键字包括：

- `fn`
- `flow`
- `stage`
- `type`
- `when`
- `match`
- `while`
- `for`
- `give`
- `return`
- `let`
- `defer`
- `break`
- `continue`
- `pipe`
- `true`
- `false`
- `nil`

### 2.2 运行时值

运行时类型目前有：

- `int`
- `bool`
- `string`
- `nil`
- `array`
- `dict`
- `object`
- `callable`

Aethe 是动态类型语言，类型检查主要发生在运行期。

---

## 三、变量与裸标识符

这一部分几乎决定了 Aethe 的语言气质。

定义变量：

```scala
let score = 100;
```

读取变量：

```scala
$score |> emit;
run
```

而不带 `$` 的 `score`，往往是一个裸标识符值。它常出现在字段访问、筛选条件和管道阶段里：

```scala
100 |> into(score);
{name: "Alice", role: admin} |> where(role, admin) |> emit;
run
```

这意味着 Aethe 把“名字本身”也当作表达能力的一部分，而不是只把它当变量引用。

---

## 四、表达式与语句

### 4.1 表达式

当前表达式体系覆盖了：

- 主表达式
- 数组字面量
- 字典字面量
- 调用表达式
- `pipe` 字面量
- 索引访问
- 成员访问
- 一元与二元运算
- 赋值表达式

一个简单例子：

```scala
let values = [1, 2, 3];
$values[0] |> emit;
run
```

### 4.2 语句

当前语句体系包括：

- 表达式语句
- `let`
- 赋值
- `when`
- `match`
- `while`
- `for`
- `break`
- `continue`
- `defer`
- `give` / `return`

也就是说，Aethe 已经具备一门小型脚本语言应有的基础控制流。

---

## 五、管道语义是核心中的核心

如果只看一节，我认为应该看这一节。

### 5.1 自动首参注入

最常见的写法就是：

```scala
"  hello  " |> trim |> upper |> emit;
run
```

左边的值会被自动注入右边的可调用目标。

### 5.2 占位符注入

如果需要显式指定插入位置，可以使用 `_`：

```scala
5 |> add(_, 3) |> emit;
run
```

也可以多次复用：

```scala
5 |> add(_, mul(_, 2)) |> emit;
run
```

### 5.3 裸表达式目标

Aethe 允许把更复杂的表达式放到管道目标位置，只要这个目标最终是可调用的，或者能够接收当前值。

这使得“值沿管道流动”的表达方式可以覆盖很多高层抽象，而不需要频繁回退到函数嵌套。

---

## 六、可调用对象：`fn`、`flow`、`stage`、`pipe`

### 6.1 `fn`

`fn` 是最接近常规语言函数的构造：

```scala
fn square(x) {
  return x * x;
}
```

### 6.2 `flow`

`flow` 更强调流程式写法，本质上也是可调用对象，但语义上偏向“由若干步骤组成的处理流”。

### 6.3 `stage`

`stage` 的定位最适合直接接在管道中：

```scala
stage shout(text) {
  return upper(text);
}

"hello" |> shout |> emit;
run
```

### 6.4 `pipe`

`pipe` 是匿名可调用对象，特别适合局部回调和集合操作：

```scala
[1, 2, 3]
|> map(pipe(x) {
     return x * 2;
   })
|> emit;
run
```

如果要给出一个简单选择建议：

- 需要普通命名函数时用 `fn`
- 需要可组合的流程对象时用 `flow`
- 主要服务于管道链时用 `stage`
- 只在局部用一次时用匿名 `pipe`

---

## 七、对象系统

Aethe 通过 `type` 提供对象能力，覆盖：

- 类型定义
- 构造
- 方法
- 成员访问

概念上并不追求非常庞杂的对象模型，而是给脚本表达提供足够实用的结构化能力。

一个典型的使用方向，是给一组相关数据和操作打包，而不是把所有逻辑都写成平铺的字典加管道。

---

## 八、内建能力的大致版图

语言参考里内建能力的覆盖面已经很广，查阅时可以按功能区块理解。

### 8.1 通用能力

- `range`
- `str`
- `int`
- `bool`
- `type_of`
- `input`
- `read_file`

### 8.2 输出与状态阶段

- `emit`
- `print`
- `show`
- `into`
- `store`
- `drop`
- `give`

### 8.3 数值与逻辑阶段

- `add`
- `sub`
- `mul`
- `div`
- `mod`
- `eq`
- `gt`
- `lt`
- `not`
- `default`

### 8.4 字符串阶段

- `trim`
- `upper`
- `lower`
- `concat`
- `substring`
- `split`
- `replace`
- `join`

### 8.5 复合值阶段

- `size`
- `append`
- `update`
- `contains`
- `slice`
- `reverse`
- `flatten`
- `get`
- `set`
- `keys`
- `values`
- `entries`
- `pick`
- `omit`
- `merge`
- `rename`
- `evolve`
- `derive`

### 8.6 集合式管道阶段

- `map`
- `flat_map`
- `filter`
- `each`
- `reduce`
- `scan`
- `find`
- `all`
- `any`
- `group_by`
- `index_by`
- `count_by`
- `sort_by`
- `distinct_by`
- `sum_by`
- `pluck`
- `where`

这部分是 Aethe 实用性最强的一块，也是写数据处理逻辑时最常进入的区域。

---

## 九、错误行为与边界

参考文档里还专门定义了错误行为和未实现特性，这一点很重要，因为 Aethe 当前仍然是一门持续演进中的语言。

在实践中，比较值得先记住的边界有：

- 非法转义会触发词法错误
- `_` 只在管道目标里有意义
- 很多类型错误要到运行时才会暴露
- 目前不支持模块、类型注解和静态类型系统

所以它更适合快速实验、脚本组织和语言机制设计迭代，而不是把“强静态约束”作为首要目标。

---

## 十、把这篇文章当成什么来用

我更建议把这篇文章当成查询入口，而不是第一次接触 Aethe 时的学习材料。

适合拿它回头查的场景包括：

- 我忘了 `stage` 和 `fn` 的边界
- 我想确认 `_` 的注入规则
- 我想找某个集合式阶段是不是已经内建
- 我想知道当前对象系统已经支持到哪一步

如果你现在还处在“先建立语感”的阶段，回到 [Aethe 2 新手教程](./aethe-2-tutorial.html) 会更高效。

---

## 结语

语言参考的价值，不在于一次读完，而在于当你开始真正写程序时，它能稳定回答“这门语言现在到底支持什么、边界在哪里、我该怎么写才更符合它的模型”。

对 Aethe 来说，这个模型始终围绕同一个中心展开：值如何进入管道、在阶段间流动，并最终形成清晰的程序结构。
