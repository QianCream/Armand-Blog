---
title: 柏林噪声浅论
description: 从基本原理到二维实现，浅谈 Perlin Noise 在地形生成中的作用。
date: 2026-03-29
format: Markdown
author: Armand
author_role: armand.dev
avatar: ../img/avatar.jpeg
---

## 小引

相信各位都玩过 **Minecraft**，而其中最令我感兴趣的部分之一，就是它的**地形生成**。在这些看似自然、实则高度可控的地貌背后，核心方法之一就是 **Perlin Noise（柏林噪声）**。

柏林噪声属于**梯度噪声**，其目标是在连续空间中构造一个标量场，使其同时具备以下性质：

- 连续性
- 平滑性
- 可复现性
- 局部相关性

通过对噪声的采样尺度、叠加层数以及后处理曲线进行调控，可以进一步派生出：

- 地形高度
- 洞穴分布
- 矿物富集区
- 群系边界

本文聚焦于 **Perlin Noise 的具体实现**，而非完整的理论证明；并尝试在 **2D 条件下复刻 Minecraft 风格的地形生成函数**。全文使用 **Python** 作为演示语言，以便更直观地进行可视化展示。

---

# 一、柏林噪声的基本原理

在正式开始实现之前，有必要先对 Perlin Noise 的核心结构有一个清晰认识。

Perlin Noise 的思路并不是“给每个点一个随机值”，而是：

1. 先将连续空间划分为整数网格；
2. 在每个网格角点放置一个伪随机梯度向量；
3. 对采样点与各角点之间的相对位移做点积；
4. 再通过平滑插值得到最终的噪声值。

这种方法的关键优点在于：它不会产生完全跳变的离散噪声，而会生成一个**连续、平滑、局部相关**的数值场。

## 1.1 网格与局部坐标

在二维情形下，将平面划分为整数网格。对于任意采样点 $(x, y)$，先确定其所在网格单元左下角的整数坐标：

$$
i = \lfloor x \rfloor, \qquad j = \lfloor y \rfloor
$$

然后定义采样点在当前单元中的局部坐标：

$$
u = x - i, \qquad v = y - j
$$

其中：

$$
u, v \in [0, 1)
$$

这里的 $(u, v)$ 描述了采样点在当前格子内部的位置，后续插值都会用到它们。

## 1.2 梯度向量与角点贡献

Perlin Noise 在网格角点上存储的并不是随机数，而是**梯度方向向量**。

对当前单元四个角点：

- $(i, j)$
- $(i+1, j)$
- $(i, j+1)$
- $(i+1, j+1)$

设其梯度向量分别为：

$$
\mathbf{g}_{00},\ \mathbf{g}_{10},\ \mathbf{g}_{01},\ \mathbf{g}_{11}
$$

采样点相对于这些角点的位移向量分别为：

$$
\mathbf{d}_{00} = (u, v)
$$

$$
\mathbf{d}_{10} = (u - 1, v)
$$

$$
\mathbf{d}_{01} = (u, v - 1)
$$

$$
\mathbf{d}_{11} = (u - 1, v - 1)
$$

于是四个角点对采样点的贡献由点积给出：

$$
n_{00} = \mathbf{g}_{00} \cdot \mathbf{d}_{00}
$$

$$
n_{10} = \mathbf{g}_{10} \cdot \mathbf{d}_{10}
$$

$$
n_{01} = \mathbf{g}_{01} \cdot \mathbf{d}_{01}
$$

$$
n_{11} = \mathbf{g}_{11} \cdot \mathbf{d}_{11}
$$

也就是说，每个角点贡献值的本质都是：

$$
n = \mathbf{g} \cdot \mathbf{d}
$$

这一步赋予了噪声“方向性变化”，使噪声值在空间中不是无规律跳变，而是沿某些方向自然起伏。

## 1.3 平滑插值与两步合成

如果直接对局部坐标 $(u, v)$ 进行普通线性插值，会在网格边界处产生明显折痕。因此 Perlin Noise 不直接使用 $u, v$，而是先通过一个平滑函数进行映射。

最经典的平滑函数是 **Fade 函数**：

$$
f(t) = 6t^5 - 15t^4 + 10t^3
$$

也可以写作：

$$
f(t) = t^3\bigl(t(6t - 15) + 10\bigr)
$$

它满足：

$$
f(0) = 0, \qquad f(1) = 1
$$

并且其一阶导数为：

$$
f'(t) = 30t^4 - 60t^3 + 30t^2
$$

所以在端点处有：

$$
f'(0) = 0, \qquad f'(1) = 0
$$

这保证了插值在格子边界处仍然平滑。

定义平滑后的权重：

$$
s = f(u), \qquad t = f(v)
$$

然后先沿 $x$ 方向插值：

$$
a = \operatorname{lerp}(s, n_{00}, n_{10})
$$

$$
b = \operatorname{lerp}(s, n_{01}, n_{11})
$$

再沿 $y$ 方向插值：

$$
N(x, y) = \operatorname{lerp}(t, a, b)
$$

其中线性插值函数定义为：

$$
\operatorname{lerp}(\alpha, p, q) = p + \alpha(q - p)
$$

因此二维 Perlin Noise 的完整形式可以写为：

$$
N(x, y) = \operatorname{lerp}\Bigl(t,\ \operatorname{lerp}(s, n_{00}, n_{10}),\ \operatorname{lerp}(s, n_{01}, n_{11})\Bigr)
$$

至此，我们就在二维空间中构造出了一个连续、平滑、具有局部相关性的噪声函数。

---

# 二、噪声的基础方法

在真正实现柏林噪声之前，还需要先准备几组基础函数。它们本身并不直接生成噪声，但会为后续的梯度计算与插值提供支持。

## 2.1 Fade 函数

首先是平滑函数，也就是 `fade` 函数。它的输入是一个介于 $0$ 与 $1$ 之间的浮点数，用于表示采样点在单元格内部的位置。

```python
def fade(t):
    return t * t * t * (t * (t * 6 - 15) + 10)
```

其数学表达式为：

$$
\operatorname{fade}(t) = 6t^5 - 15t^4 + 10t^3
$$

它最重要的性质是：

$$
\operatorname{fade}'(0) = \operatorname{fade}'(1) = 0
$$

这意味着在格子边界处，插值曲线不会突然拐折。

## 2.2 线性插值 `lerp`

线性插值是 Perlin Noise 中最基础的一步：

```python
def lerp(t, a, b):
    return a + t * (b - a)
```

数学表达式为：

$$
\operatorname{lerp}(t, a, b) = a + t(b - a)
$$

当：

- $t = 0$ 时，结果为 $a$；
- $t = 1$ 时，结果为 $b$。

在 Perlin Noise 中，$t$ 通常不是直接使用局部坐标，而是使用经过 `fade` 处理后的平滑权重。

## 2.3 梯度贡献 `grad`

实现梯度贡献有两种经典路线。

### 路线 A：显式存梯度向量表，再做点积

为了教学和调试方便，可以显式定义二维梯度方向表。例如使用 8 个方向：

```python
GRADS_2D = (
    (1, 0), (-1, 0), (0, 1), (0, -1),
    (1, 1), (-1, 1), (1, -1), (-1, -1),
)

def grad(hash_value: int, dx: float, dy: float) -> float:
    gx, gy = GRADS_2D[hash_value & 7]  # 0..7
    return gx * dx + gy * dy
```

数学上就是：

$$
\operatorname{grad}(h, dx, dy) = g_x(h)\,dx + g_y(h)\,dy
$$

其中 $(g_x(h), g_y(h))$ 表示由哈希值 $h$ 选出的梯度方向。

### 路线 B：不显式存梯度表，用哈希低位隐式选择方向

另一种更工程化的写法如下：

```python
def grad(hash_value, x, y):
    h = hash_value & 3
    if h == 0:
        return  x + y
    if h == 1:
        return -x + y
    if h == 2:
        return  x - y
    return -x - y
```

这种写法本质上仍然是在计算：

$$
\mathbf{g} \cdot \mathbf{d}
$$

只是把梯度方向的选择编码在哈希值里，而不单独维护一个方向表。

这里的 $x, y$ 不是世界坐标，而是采样点相对角点的局部位移。

## 2.4 多层叠加 Octaves

单层噪声往往过于平滑，因此常见做法是叠加多层噪声。每一层都具有更高的频率、更低的振幅，从而同时保留“大轮廓”和“小细节”。

推荐采用标准参数化方式：

- `lacunarity`：控制频率增长，常用 $2.0$；
- `persistence`：控制振幅衰减，常用 $0.5$。

设基础噪声函数为 $N(x, y)$，那么 $K$ 层 fBm 可以写为：

$$
\operatorname{fBm}(x, y) = \sum_{k=0}^{K-1} A_k\,N(F_kx, F_ky)
$$

其中频率和振幅满足递推关系：

$$
F_k = F_0\lambda^k
$$

$$
A_k = A_0p^k
$$

这里：

- $\lambda$ 表示 `lacunarity`；
- $p$ 表示 `persistence`。

如果希望输出范围更稳定，还可以做归一化：

$$
\operatorname{fBm}_{\text{norm}}(x, y) =
\frac{\sum_{k=0}^{K-1} A_k\,N(F_kx, F_ky)}{\sum_{k=0}^{K-1} A_k}
$$

代码主循环通常写成：

```python
total += noise(x * freq, y * freq) * amp
freq *= lacunarity
amp *= persistence
```

---

# 三、简单地形

## 3.1 由 $x$ 得到高度 $h(x)$

在完成基础噪声方法之后，可以开始使用噪声生成最简单的二维地形。这里的目标很明确：**根据横向坐标 $x$，生成一个连续变化的高度值**。

最基础的做法是对 $x$ 坐标进行噪声采样：

```python
n = fbm(x * scale, y0)
h = int(base + n * amplitude)
```

其数学形式可写为：

$$
h(x) = \left\lfloor \text{base} + \text{amplitude} \cdot \operatorname{fBm}(x \cdot \text{scale}, y_0) \right\rfloor
$$

其中：

- `scale`：控制横向变化速度；
- `amplitude`：控制纵向起伏高度；
- `base`：控制整体海拔基准；
- $y_0$：固定偏移，用于在二维噪声中沿一条水平线取样。

简单来说：

- `scale` 决定横向变化的快慢；
- `amplitude` 决定纵向起伏的剧烈程度；
- `base` 决定整体高低；
- $y_0$ 决定采样切片的位置。

## 3.2 `scale` 的选取与地形尺度

`scale` 越小，噪声“走得越慢”，地形越接近大陆级大轮廓；`scale` 越大，噪声变化越快，地形会显得更破碎。

例如：

```python
n1 = fbm(x * 0.002, 0.0)  # 大陆级起伏
n2 = fbm(x * 0.012, 0.0)  # 丘陵更密
```

从函数角度看，就是比较：

$$
\operatorname{fBm}(0.002x, 0) \quad \text{与} \quad \operatorname{fBm}(0.012x, 0)
$$

显然，后者在单位长度内变化更快。

## 3.3 `octaves` 层数与细节强度

单层噪声往往只是一条比较圆滑的曲线。为了让地形同时拥有：

- 大陆级轮廓；
- 丘陵级变化；
- 坡面细节；

就需要把不同尺度的噪声叠加起来。

在标准 fBm 中，每一层都遵循两个递推关系：

$$
\text{freq}_{k+1} = \text{freq}_k \cdot \text{lacunarity}
$$

$$
\text{amp}_{k+1} = \text{amp}_k \cdot \text{persistence}
$$

代码核心形式如下：

```python
total += noise(x * freq, y * freq) * amp
freq *= lacunarity
amp *= persistence
```

其中：

- `lacunarity` 一般取 $2.0$，表示频率翻倍；
- `persistence` 一般取 $0.45 \sim 0.55$，表示振幅逐层衰减；
- `octaves` 一般取 $4 \sim 8$ 层已经足够。

层数太少会显得单调，层数太多则容易出现颗粒感，并增加计算量。

## 3.4 `base` 与 `sea_level` 的联动关系

如果引入海平面 `sea_level`，那么高度函数应当保证海陆比例合理。常见策略是让 `base` 稍低于 `sea_level`，使噪声波动时既能露出陆地，也能形成海洋。

例如：

```python
base = sea_level - 25
amplitude = 55
h = int(base + fbm(x * scale, 0.0) * amplitude)
```

其数学形式为：

$$
h(x) = \left\lfloor (\text{sea\_level} - 25) + 55 \cdot \operatorname{fBm}(x \cdot \text{scale}, 0) \right\rfloor
$$

这样做的本质是让噪声围绕海平面上下波动，而不是整体全部偏高或偏低。

---

# 四、结合温度、湿度的群系判断

## 4.1 温度与湿度仍然是噪声

仅有高度并不足以描述完整地形。为了区分沙漠、平原、森林、雪山等区域，可以额外引入两个参数：

- 温度 `temperature`
- 湿度 `moisture`

它们本质上仍然来自噪声函数，只是使用了不同的采样尺度和偏移：

```python
temperature = noise(x * temp_scale, 10)
moisture = noise(x * moist_scale, 20)
```

可以写为：

$$
T(x) = N(x \cdot s_T, 10)
$$

$$
M(x) = N(x \cdot s_M, 20)
$$

其中不同的偏移值（如 $10$ 和 $20$）可以让两组噪声场彼此独立，避免高度相关。

## 4.2 海拔修正温度：雪线的关键开关

为了让高海拔地区更冷，可以在温度上叠加一个“随海拔降低”的修正项。

在二维方块世界里，若采用**屏幕坐标系向下为正**的习惯，那么地表越高，`height` 数值反而越小。此时可以定义：

$$
\text{altitude} = \text{sea\_level} - \text{height}
$$

于是温度修正可写为：

$$
T' = T - k \cdot \frac{\text{altitude}}{\text{world\_height}}
$$

对应代码为：

```python
altitude = sea_level - height
temperature -= k * (altitude / world_height)
```

其中：

- $k$ 控制“高度对温度的影响强度”；
- `world_height` 用于归一化。

这样就能自然形成“越高越冷”的效果，也更容易形成雪线。

## 4.3 群系划分

在得到高度、温度、湿度之后，就可以通过简单规则划定群系。例如：

```python
if altitude >= snow_alt:
    biome = "snow_mountain"
elif temperature > 0.25 and moisture < -0.35:
    biome = "desert"
elif moisture > 0.35:
    biome = "forest"
else:
    biome = "plains"
```

从逻辑上可以概括为：

$$
\text{biome} =
\begin{cases}
\text{snow\_mountain}, & \text{if } \text{altitude} \ge \text{snow\_alt} \\
\text{desert}, & \text{if } T > 0.25 \text{ and } M < -0.35 \\
\text{forest}, & \text{if } M > 0.35 \\
\text{plains}, & \text{otherwise}
\end{cases}
$$

这是一种最小可用的划分方式，虽然简单，但已经足够形成直观的群系差异。

## 4.4 群系确定之后，真正要做的是“群系落地”

群系被判定出来之后，还只是一个字符串，例如：

- `desert`
- `forest`
- `plains`

真正让玩家一眼看出差异的，不是这个标签本身，而是它对应的**落地规则**。在二维地形生成中，最常见、也最稳定的落地方式主要包括四类：

1. 地表材料；
2. 表土结构；
3. 坡度控制；
4. 装饰生成。

## 4.5 地表材料与表土结构

最直观的群系差异，就是地表第一层与地下前几层由什么组成。

建议采用统一框架：

- 第一层：`surface`
- 下面几层：`subsurface`
- 更深处：统一为 `stone`

例如：

```python
if y == h:
    block = surface
elif y < h + topsoil_depth:
    block = subsurface
else:
    block = "stone"
```

可抽象写为：

$$
\text{block}(x, y) =
\begin{cases}
\text{surface}, & y = h \\
\text{subsurface}, & h < y < h + \text{topsoil\_depth} \\
\text{stone}, & y \ge h + \text{topsoil\_depth}
\end{cases}
$$

不同群系参数可以设置为：

### plains

- `surface = grass`
- `subsurface = dirt`
- `topsoil_depth = 3 \sim 5`

### forest

- `surface = grass`
- `subsurface = dirt` 或 `mud`
- `topsoil_depth` 可以更厚一些

### desert

- `surface = sand`
- `subsurface = sand`
- `topsoil_depth` 更厚

### snow_mountain

- `surface = snow`
- `subsurface = stone` 或 `dirt`
- `topsoil_depth = 1 \sim 2`

这种结构的优点是：群系差异主要集中在“表层几层”，而深层逻辑仍可统一复用。

## 4.6 坡度控制：不同群系的地形“性格”

只靠高度函数，往往会出现“看起来不像它该有的样子”的问题。例如：

- 沙漠过陡，会显得奇怪；
- 山地过平，会显得无力。

因此一个非常实用的方法，是给每个群系设定一个“陡峭系数” `steepness`，用来放大或压缩局部起伏。

直观写法是：

```python
terrain_height = int(base_height - variation * steepness)
```

可写为：

$$
h_{\text{terrain}} = \left\lfloor h_{\text{base}} - \Delta h \cdot s \right\rfloor
$$

其中：

- $\Delta h$ 表示局部变化量；
- $s$ 表示群系的 `steepness`。

经验上可取：

- `plains`：较小；
- `forest`：略高于平原；
- `desert`：中等或略高；
- `mountain` / `snow_mountain`：最大。

这是一种非常直观的参数化方式。

## 4.7 水体表现：海洋与湖泊的落地

海洋类群系通常不是靠温湿度判断，而是由**高度是否低于海平面**直接决定。

最简单规则是：

$$
h < \text{sea\_level}
$$

则该列应被灌水。

实现时要注意两个细节。

### 4.7.1 海底材料应与陆地不同

最简单做法是：

- 海底表层使用 `sand`；
- 不继续沿用陆地上的 `grass`。

### 4.7.2 水应填充到海平面，而不是只填一层

```python
for y in range(sea_level, h):
    if world[y][x] == "air":
        world[y][x] = "water"
```

更准确地说，如果采用“向下为正”的数组坐标，需要根据坐标系方向调整循环边界。它的本质规则是：

$$
\forall y \in [h,\ \text{sea\_level}],\quad \text{if block}(x, y) = \text{air, then fill with water}
$$

这样才能形成连续水柱，而不是一条薄线。

## 4.8 装饰生成：让群系一眼可辨

群系真正“活起来”，往往靠装饰物：

- 树
- 草
- 花
- 石头

推荐把装饰生成写成概率表，而不是继续堆叠条件判断。

例如对每一列地表点做一次随机抽样：

```python
r = rand01(x, h, seed)
if r < tree_p:
    place_tree()
elif r < tree_p + rock_p:
    place_rock()
elif r < tree_p + rock_p + plant_p:
    place_plant()
```

抽象成概率分段就是：

$$
r \sim U(0, 1)
$$

$$
\text{decoration} =
\begin{cases}
\text{tree}, & 0 \le r < p_{\text{tree}} \\
\text{rock}, & p_{\text{tree}} \le r < p_{\text{tree}} + p_{\text{rock}} \\
\text{plant}, & p_{\text{tree}} + p_{\text{rock}} \le r < p_{\text{tree}} + p_{\text{rock}} + p_{\text{plant}} \\
\text{none}, & \text{otherwise}
\end{cases}
$$

这样每个群系只需要给出各自的概率参数，就可以保持生成逻辑统一。

## 4.9 一个可复用的群系参数表写法

为了避免 `if` 越写越长，推荐把群系参数做成字典，例如：

```python
BIOME = {
    "plains":  {"surface":"grass","sub":"dirt","top":4,"steep":0.28,"tree":0.06,"plant":0.40},
    "forest":  {"surface":"grass","sub":"dirt","top":5,"steep":0.45,"tree":0.80,"plant":0.10},
    "desert":  {"surface":"sand", "sub":"sand","top":6,"steep":0.75,"tree":0.00,"plant":0.00},
    "mountain":{"surface":"rock", "sub":"stone","top":2,"steep":1.60,"tree":0.00,"plant":0.00},
    "snow_mountain":{"surface":"snow","sub":"stone","top":2,"steep":1.80,"tree":0.00,"plant":0.00},
}
```

这样做的好处是：

- 群系判断与群系参数解耦；
- 新增群系时只需扩展字典；
- 后续放树、铺层、调坡度都能统一读取参数。

---

# 五、矿洞和矿物

## 5.1 洞穴的本质是“在实心方块中挖空”

矿洞的生成可以看作是在已有地形内部，再使用一次二维噪声进行“挖空”。

对于任意地下位置 $(x, y)$，先计算洞穴噪声值：

```python
cave_value = noise(x * cave_scale, y * cave_scale)
```

当噪声值落入某个较窄区间时，就认为该位置应该被挖空：

```python
if -T < cave_value < T:
    block = "air"
```

这相当于定义一个判定条件：

$$
|\text{cave\_value}| < T
$$

则当前位置变为洞穴。

这种写法的直观含义是：只有噪声值靠近零附近的一小段区域会被挖空，于是能形成弯曲而连续的洞穴带。

## 5.2 深度相关阈值：让“越深越复杂”

为了避免地表被大面积挖穿，同时让深层洞穴更密集，可以让阈值 $T$ 随深度增加：

```python
T = T0 + T1 * (y / world_height)
if -T < cave_value < T:
    block = "air"
```

其数学形式为：

$$
T(y) = T_0 + T_1 \cdot \frac{y}{\text{world\_height}}
$$

因此判定条件变为：

$$
|N(x \cdot s_c, y \cdot s_c)| < T(y)
$$

这样越往深处，允许被挖空的范围越大，洞穴网络就会更复杂。

## 5.3 矿物生成

矿物生成更稳定的做法是：**只在 `stone` 中替换 + 噪声阈值 + 深度范围限制**。

最小形式如下：

```python
ore_value = fbm(x * ore_scale, y * ore_scale)
if ore_value > threshold and y > deep_limit:
    block = "ore"
```

可以抽象为：

$$
\text{ore\_value} = \operatorname{fBm}(x \cdot s_o, y \cdot s_o)
$$

当满足：

$$
\text{ore\_value} > \theta
\quad \text{且} \quad
y > y_{\text{deep}}
$$

时，将当前位置从 `stone` 替换为矿物。

这里：

- $y > y_{\text{deep}}$ 是深度门槛，用于控制矿种层位；
- $\theta$ 控制稀有度，阈值越高越稀有；
- 只在 `stone` 里替换，可以避免矿漂浮在空气或水里。

## 5.4 矿脉感来自 `field` 与 `shape` 的组合

如果只用单一噪声阈值，矿物分布常常会显得“到处是随机点”。为了让矿呈现“矿区 + 矿脉纹理”的感觉，可以把两层不同尺度的噪声组合起来：

```python
field = fbm(x * field_scale, y * field_scale)
shape = fbm(x * shape_scale, y * shape_scale + 100.0)
ore_value = 0.5 * (field + shape)
```

数学上可写为：

$$
F(x, y) = \operatorname{fBm}(x \cdot s_f, y \cdot s_f)
$$

$$
S(x, y) = \operatorname{fBm}(x \cdot s_s, y \cdot s_s + 100)
$$

$$
O(x, y) = \frac{F(x, y) + S(x, y)}{2}
$$

其中：

- `field` 负责决定“大范围上哪里更容易出矿”；
- `shape` 负责在矿区内部塑造更像“矿脉纹理”的局部结构；
- 最终再对 $O(x, y)$ 施加阈值，就能得到更自然的矿体分布。

例如：

```python
if block == "stone" and ore_value > ore_threshold and y > deep_limit:
    block = "ore"
```

这样得到的矿分布通常会比单层噪声更有“块状聚集 + 局部延展”的感觉。

---

# 六、总结

从实现角度看，一个简化版的 2D Minecraft 风格地形生成器，通常可以拆成以下几个层次：

1. 使用 **Perlin Noise** 构造连续平滑的基础噪声；
2. 通过 **fBm 多层叠加** 生成具有大轮廓与细节的地表高度；
3. 再用额外噪声场生成 **温度** 与 **湿度**，完成群系判定；
4. 根据群系参数落地到 **表层材料、坡度、水体与装饰**；
5. 最后在地下叠加 **洞穴** 与 **矿物** 逻辑，补足世界内部结构。

也就是说，Minecraft 风格地形并不是由“一个噪声函数”直接生成的，而是由一整套**可组合、可调参、可复用**的噪声系统共同构成的。

Perlin Noise 提供的，不只是“随机地形”，而是一种能在连续空间中写出“自然感结构”的方法。对于 2D 地形生成来说，它既足够简单，又足够强大，是理解程序化生成的一个非常好的起点。
