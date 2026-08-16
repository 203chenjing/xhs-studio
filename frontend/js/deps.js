(function (global) {
  "use strict";

  function loadScript(urls) {
    const list = Array.isArray(urls) ? urls : [urls];
    return new Promise((resolve, reject) => {
      let i = 0;
      function tryNext() {
        if (i >= list.length) {
          reject(new Error("脚本加载失败"));
          return;
        }
        const src = list[i++];
        const s = document.createElement("script");
        s.src = src;
        s.async = false;
        s.onload = () => resolve(src);
        s.onerror = () => tryNext();
        document.head.appendChild(s);
      }
      tryNext();
    });
  }

  async function loadExportDeps() {
    if (global.htmlToImage && global.JSZip) {
      global.__XHS_DEPS__ = { htmlToImage: true, JSZip: true };
      return global.__XHS_DEPS__;
    }
    await loadScript([
      "/static/vendor/html-to-image.min.js",
      "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js",
    ]);
    await loadScript([
      "/static/vendor/jszip.min.js",
      "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    ]);
    global.__XHS_DEPS__ = {
      htmlToImage: !!(global.htmlToImage && global.htmlToImage.toPng),
      JSZip: !!global.JSZip,
    };
    if (!global.__XHS_DEPS__.htmlToImage || !global.__XHS_DEPS__.JSZip) {
      throw new Error("导出组件未加载，请检查网络或使用离线包");
    }
    return global.__XHS_DEPS__;
  }

  global.XHSDeps = { loadScript, loadExportDeps };
})(typeof window !== "undefined" ? window : globalThis);
