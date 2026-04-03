---
title: Aethe 教程
description: 面向初学者梳理 Aethe 2 的基本读法、运行方式、变量、函数与集合式管道，适合作为入门路径。
summary: 从第一个管道开始，快速理解 Aethe 2 的运行方式、变量规则和常用集合操作。
date: 2026-04-03
format: Markdown
author: Armand
author_role: armand.dev
avatar: ../img/avatar.jpeg
---

## 小引

这篇文章整理自 Aethe 项目的新手文档，目标不是罗列全部语法，而是给出一条足够短、足够顺的入门路径。

如果你以前没接触过 Aethe，甚至还没有完整写过一门“以管道为核心”的语言，这篇教程应该先于语言参考阅读。等你把这里的例子跑通，再去看 [Aethe 2 语言参考](./aethe-2-reference.html) 会轻松很多。

---

## 一、Aethe 到底在做什么

Aethe 最核心的设计，不是“函数调用”，而是“值沿着管道向前流动”。

很多语言会写成这样：

```text
print(to_upper(trim("  hello  ")))
```

Aethe 更倾向于这样写：

```scala
"  hello  " |> trim |> upper |> emit;
```

从左往右读就行：

1. 先得到字符串 `"  hello  "`
2. 交给 `trim`
3. 交给 `upper`
4. 交给 `emit`

如果你抓住了“值在流动”这个感觉，后面的语法大多都会自然很多。

---

## 二、先把程序跑起来

构建方式很直接：

```bash
g++ -std=c++11 main.cpp -o aethe
```

启动：

```bash
./aethe
```

当前实现默认进入终端 IDE。如果你想严格体验旧式 REPL，可以这样启动：

```bash
./aethe --repl
```

终端 IDE 下最常用的是：

- `Ctrl-O` 打开文件
- `Ctrl-S` 保存文件
- `Ctrl-R` 运行当前缓冲区
- `Ctrl-Q` 退出

如果使用 `--repl`，要记住一条很关键的规则：输入代码后不会立刻执行，只有单独输入一行 `run`，当前缓冲区才会统一运行。

```text
>>> "hello" |> emit;
...> run
hello
```

---

## 三、第一个 Aethe 程序

最简单的例子就是输出一段文本：

```scala
"hello, Aethe" |> emit;
run
```

这里已经包含三件最重要的事：

- 字符串用双引号
- `|>` 是管道符
- `emit` 用于输出当前值

`print` 和 `show` 目前与 `emit` 等价，都会输出值，并把这个值继续向后传递：

```scala
"hello" |> emit |> upper |> emit;
run
```

输出会是：

```text
hello
HELLO
```

---

## 四、值、变量与裸标识符

Aethe 当前支持这些运行时值：

- `int`
- `bool`
- `string`
- `nil`
- `array`
- `dict`
- `object`
- `callable`

变量定义可以直接用 `let`：

```scala
let name = "Alice";
let score = 95;
run
```

读取变量时要写成 `$name` 和 `$score`：

```scala
$name |> emit;
$score |> emit;
run
```

这里有个 Aethe 非常重要的规则：

- `name` 是裸标识符，通常表示一个“符号名字”
- `$name` 才是读取变量

也正因为这样，Aethe 很适合写成这种风格：

```scala
100 |> into(score);
{name: "Alice", role: admin} |> where(role, admin) |> emit;
run
```

也就是说，“名字本身”也可以作为管道参数的一部分。

---

## 五、表达式和管道该怎么理解

表达式的目标永远是“先算出一个值”，然后再决定要不要继续往后传。

例如：

```scala
(1 + 2 * 3) |> emit;
run
```

Aethe 的一个重点，是很多调用都支持自动首参注入。比如：

```scala
"  hello  " |> trim |> upper |> emit;
run
```

这里的 `trim` 和 `upper` 本质上都接收了左边流过来的值。

如果你想在目标表达式里多次使用这个流过来的值，可以使用占位符 `_`：

```scala
5 |> add(_, mul(_, 2)) |> emit;
run
```

上面可以理解成把当前值 `5` 注入到多个位置。`_` 只能在管道目标里使用，它不是匿名函数，也不是一个普通变量。

---

## 六、`fn`、`stage` 与匿名 `pipe`

写 Aethe 时，最常见的困惑之一，就是什么时候该用 `fn`，什么时候该用 `stage`。

### 6.1 `fn` 适合普通函数

```scala
fn square(x) {
  return x * x;
}

3 |> square |> emit;
run
```

`fn` 更像常见语言里的函数。它适合明确接收参数、明确返回结果的逻辑。

### 6.2 `stage` 适合被放进管道里

```scala
stage shout(text) {
  return upper(text);
}

"hello" |> shout |> emit;
run
```

`stage` 的阅读感更贴近“处理流水线里的当前值”。如果一个能力主要就是为了被 `|>` 串起来，那么 `stage` 往往更顺手。

### 6.3 `pipe` 适合局部的一次性逻辑

```scala
[1, 2, 3]
|> map(pipe(x) {
     return x * 2;
   })
|> emit;
run
```

当一段逻辑只在某个局部位置使用一次时，匿名 `pipe` 很方便，不需要额外命名。

---

## 七、条件、循环和常见控制流

条件分支使用 `when`：

```scala
let score = 87;

when $score >= 90 {
  "A" |> emit;
} else {
  "B" |> emit;
}

run
```

多分支可以用 `match`，循环有 `while` 和 `for`，中断控制则有 `break`、`continue` 和 `defer`。

如果你是第一次接触 Aethe，不需要一次记住全部细节。先把下面三种场景跑熟更重要：

- 判断一个值是否满足条件
- 遍历一个数组并逐项处理
- 在函数里显式返回结果

---

## 八、数组、字典与集合式管道

除了“单个值”的直线处理，Aethe 另一块非常好用的能力，是对数组进行批量操作。

例如把数组每一项翻倍：

```scala
[1, 2, 3, 4]
|> map(pipe(x) {
     return x * 2;
   })
|> emit;
run
```

筛选偶数：

```scala
[1, 2, 3, 4, 5, 6]
|> filter(pipe(x) {
     return x % 2 == 0;
   })
|> emit;
run
```

求和：

```scala
[1, 2, 3, 4, 5] |> sum |> emit;
run
```

字典也很自然：

```scala
let user = {name: "Alice", score: 95};

$user |> get(name) |> emit;
$user |> get(score) |> emit;
run
```

在实际写法里，`map`、`filter`、`reduce`、`group_by`、`where`、`pluck` 会非常高频。

---

## 九、一个更像样的小例子

把几种概念放在一起：

```scala
let students = [
  {name: "Alice", score: 95},
  {name: "Bob", score: 82},
  {name: "Cindy", score: 91}
];

$students
|> filter(pipe(item) {
     return get(item, score) >= 90;
   })
|> pluck(name)
|> emit;
run
```

这个例子同时用到了：

- 数组
- 字典
- 匿名 `pipe`
- 集合式管道

也是 Aethe 比较典型的风格之一。

---

## 十、建议的学习顺序

如果你刚开始接触 Aethe，我建议按这个顺序走：

1. 先跑通 `emit`、`trim`、`upper` 这种单值管道
2. 再理解 `let`、`$name` 和裸标识符的区别
3. 接着学会 `fn`、`stage`、`pipe`
4. 然后进入 `map`、`filter`、`reduce` 等集合式管道
5. 最后再去系统查阅对象系统和完整内建索引

当你已经能顺手写出一段包含变量、条件和数组处理的小程序时，就可以转去读 [Aethe 2 语言参考](./aethe-2-reference.html) 了。

---

## 结语

这篇文章对应的是“先能写，再逐步查”的学习路线。Aethe 的门槛其实不在语法量，而在思维方式切换：不要先想函数嵌套，先想值是怎么沿着管道流过去的。

一旦这个视角建立起来，后面的 `stage`、占位符注入、集合式管道都会变得很自然。
