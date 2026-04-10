const PAGE_DATA_SELECTOR = "#page-data";
const APP_ROOT_SELECTOR = "#app";
const APP_SCRIPT_SELECTOR = "script[data-site-app]";

export const readPageData = () => {
  const node = document.querySelector(PAGE_DATA_SELECTOR);

  if (!node) {
    return {};
  }

  try {
    return JSON.parse(node.textContent || "{}");
  } catch (error) {
    console.error("Failed to parse page data.", error);
    return {};
  }
};

export const getAppRoot = () => document.querySelector(APP_ROOT_SELECTOR);

export const getPageType = () => getAppRoot()?.dataset.page || "";

export const getAppScriptUrl = () => {
  const script = document.querySelector(APP_SCRIPT_SELECTOR);

  if (script?.src) {
    return script.src;
  }

  if (typeof import.meta !== "undefined" && import.meta.url) {
    return import.meta.url;
  }

  return window.location.href;
};

export const resolveRuntimeUrl = (relativePath) => {
  const resolved = new URL(relativePath, getAppScriptUrl());
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
};
