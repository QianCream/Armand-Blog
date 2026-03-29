const header = document.querySelector(".site-header");
const reveals = document.querySelectorAll(".reveal");
const yearNode = document.querySelector("#year");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const interactiveCards = document.querySelectorAll(
  ".hero-copy, .profile-card, .article-card, .work-card, .stack-item, .article-block, .article-note, .article-stage, .article-quote",
);
const interactiveElements = document.querySelectorAll(
  ".button, .section-tags span, .panel-index, .panel-label, .article-meta, .work-meta",
);
const staggerTargets = document.querySelectorAll(".hero-copy h1, .section-heading h2, .article-title");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const themeStorageKey = "theme-preference";

if (yearNode) {
  yearNode.textContent = new Date().getFullYear().toString();
}

const syncHeaderState = () => {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

syncHeaderState();
window.addEventListener("scroll", syncHeaderState, { passive: true });

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -6% 0px",
    },
  );

  reveals.forEach((node) => observer.observe(node));
} else {
  reveals.forEach((node) => node.classList.add("is-visible"));
}

const createThemeToggle = () => {
  const button = document.createElement("button");
  const label = document.createElement("span");
  const value = document.createElement("span");

  button.type = "button";
  button.className = "theme-toggle";
  button.setAttribute("aria-label", "toggle theme");

  label.className = "theme-toggle-label";
  label.textContent = "theme";

  value.className = "theme-toggle-value";
  button.append(label, value);
  document.body.appendChild(button);

  return { button, value };
};

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem(themeStorageKey);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return systemTheme.matches ? "dark" : "light";
};

const { button: themeToggle, value: themeToggleValue } = createThemeToggle();

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  themeToggleValue.textContent = theme;

  if (themeMeta) {
    themeMeta.setAttribute("content", theme === "dark" ? "#081321" : "#edf3fb");
  }
};

let currentTheme = getInitialTheme();
applyTheme(currentTheme);

themeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(themeStorageKey, currentTheme);
  applyTheme(currentTheme);
});

systemTheme.addEventListener("change", (event) => {
  if (localStorage.getItem(themeStorageKey)) {
    return;
  }

  currentTheme = event.matches ? "dark" : "light";
  applyTheme(currentTheme);
});

const applyStaggerText = (node) => {
  const text = node.textContent ?? "";

  if (!text.trim()) {
    return;
  }

  const fragment = document.createDocumentFragment();
  node.textContent = "";
  node.classList.add("stagger-text");

  Array.from(text).forEach((char, index) => {
    const span = document.createElement("span");

    span.className = char === " " ? "stagger-char is-space" : "stagger-char";
    span.style.setProperty("--i", index.toString());
    span.textContent = char === " " ? "\u00a0" : char;
    fragment.appendChild(span);
  });

  node.appendChild(fragment);
};

staggerTargets.forEach((node) => applyStaggerText(node));

if (!prefersReducedMotion.matches) {
  interactiveCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 8;
      const rotateX = (0.5 - py) * 8;

      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });

  interactiveElements.forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const moveX = (px - 0.5) * 8;
      const moveY = (py - 0.5) * 6;

      element.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });

    element.addEventListener("pointerleave", () => {
      element.style.transform = "";
    });
  });

  themeToggle.addEventListener("pointermove", (event) => {
    const rect = themeToggle.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const moveX = (px - 0.5) * 6;
    const moveY = (py - 0.5) * 4;

    themeToggle.style.transform = `translate(${moveX}px, ${moveY}px)`;
  });

  themeToggle.addEventListener("pointerleave", () => {
    themeToggle.style.transform = "";
  });
}
