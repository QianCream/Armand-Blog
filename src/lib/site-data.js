export const SITE_BRAND = {
  href: "#top",
  label: "armand.dev",
  image: "img/avatar.jpeg",
  alt: "Armand icon",
};

export const SITE_NAV_LINKS = [
  { href: "#top", label: "home" },
  { href: "#articles", label: "articles" },
  { href: "#intro", label: "intro" },
  { href: "#works", label: "works" },
];

export const SITE_FOOTER_LINKS = [
  { href: "articles/index.html", label: "archive" },
  { href: "feed.xml", label: "feed.xml" },
  { href: "sitemap.xml", label: "sitemap.xml" },
  { href: "https://github.com/QianCream", label: "github", external: true },
];

export const HOME_TERMINAL_LINES = [
  { key: "latest", value: "写了篇递归下降解析器_" },
  { key: "reading", value: "编译原理 / 图形学" },
  { key: "mood", value: "curious, caffeinated_" },
];

export const HOME_INTRO_STACK = [
  { key: "在用", value: "C++ / Pygame / Web" },
  { key: "感兴趣", value: "界面设计 / 交互 / 视觉" },
  { key: "在做", value: "Aethe 稳定推进中，偶尔写小项目" },
];

export const HOME_WORKS = [
  {
    href: "https://github.com/QianCream/Aethe",
    image: "img/work-aethe.jpg",
    alt: "Aethe cover",
    index: "01",
    panelIndex: "W1",
    command: "git clone QianCream/Aethe",
    title: "Aethe",
    description: "一门还在持续推进中的语言实验，重点放在管道式表达和可读的程序结构。",
    tags: ["compiler", "language"],
  },
  {
    href: "https://github.com/QianCream/Fpp",
    image: "img/work-fpp.png",
    alt: "F++ cover",
    index: "02",
    panelIndex: "W2",
    command: "git clone QianCream/Fpp",
    title: "F++",
    description: "围绕语言与实现继续试错的项目分支，偏向更直接的表达和实验性结构。",
    tags: ["syntax", "experiment"],
  },
  {
    href: "https://github.com/QianCream/FreeWorld",
    image: "img/work-freeworld.jpg",
    alt: "FreeWorld cover",
    index: "03",
    panelIndex: "W3",
    command: "git clone QianCream/FreeWorld",
    title: "FreeWorld",
    description: "更偏小型项目和世界观式构想的集合，记录实现过程里的视觉和玩法尝试。",
    tags: ["gameplay", "world"],
  },
];
