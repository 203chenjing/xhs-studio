/* QR hand-off page: encodes the workspace URL in the browser, no external API */
(function () {
  "use strict";

  var host = document.getElementById("qr-host");
  var urlText = document.getElementById("qr-url");
  var input = document.getElementById("qr-input");
  var note = document.getElementById("qr-note");
  var toast = document.getElementById("qr-toast");
  var direct = document.getElementById("qr-direct");
  var STORAGE_KEY = "xhs-demo-qr-url";

  var base = new URL(".", window.location.href).href;
  var current = base;

  function isHttp(url) {
    try {
      var u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function isLocalHost(url) {
    try {
      var h = new URL(url).hostname;
      return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "[::1]" || h === "::1";
    } catch (e) {
      return false;
    }
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.hidden = true; }, 1600);
  }

  function renderQr(url) {
    host.innerHTML = "";
    if (typeof window.QRCode !== "function") {
      note.textContent = "二维码组件未加载，请刷新重试。";
      note.className = "qr-note warn";
      return;
    }
    try {
      var tmp = document.createElement("div");
      new window.QRCode(tmp, {
        text: url,
        width: 512,
        height: 512,
        colorDark: "#1d1a16",
        colorLight: "#fffdf9",
        correctLevel: window.QRCode.CorrectLevel.M
      });
      var src = tmp.querySelector("canvas");
      if (!src) throw new Error("qr canvas missing");
      // 合成一张带 4 模块静区的图，屏幕显示与下载 PNG 都满足扫码要求
      var pad = 64;
      var out = document.createElement("canvas");
      out.width = 512 + pad * 2;
      out.height = 512 + pad * 2;
      var ctx = out.getContext("2d");
      ctx.fillStyle = "#fffdf9";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, pad, pad, 512, 512);
      host.appendChild(out);
    } catch (err) {
      note.textContent = "这个地址生成了过长的二维码，请换一个短一点的链接。";
      note.className = "qr-note warn";
      return;
    }
    urlText.textContent = url;
    if (direct) direct.href = base;
  }

  function setNote(url) {
    note.className = "qr-note";
    if (isLocalHost(url)) {
      note.className = "qr-note warn";
      note.textContent = "当前是本地地址，手机扫码访问不到。部署到云端后会自动使用公网地址；也可以先粘贴线上地址预览。";
    } else {
      note.textContent = "二维码在浏览器本地生成，不经过任何第三方服务。";
    }
  }

  function apply(value, save) {
    var url = String(value || "").trim();
    if (!isHttp(url)) {
      note.className = "qr-note warn";
      note.textContent = "请输入完整的 http(s) 地址，例如 https://example.com/xhs/";
      return;
    }
    current = url;
    input.value = url;
    renderQr(url);
    setNote(url);
    if (save) {
      try { localStorage.setItem(STORAGE_KEY, url); } catch (e) { /* private mode */ }
    }
  }

  var saved = "";
  try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch (e) { saved = ""; }
  apply(saved && isHttp(saved) ? saved : base, false);

  var timer = null;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { apply(input.value, true); }, 320);
  });

  document.getElementById("qr-reset").addEventListener("click", function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    apply(base, false);
    showToast("已恢复当前地址");
  });

  document.getElementById("copy-link").addEventListener("click", function () {
    var done = function () { showToast("链接已复制"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(current).then(done, function () { fallbackCopy(current); done(); });
    } else {
      fallbackCopy(current);
      done();
    }
  });

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  document.getElementById("download-qr").addEventListener("click", function () {
    var canvas = host.querySelector("canvas");
    var img = host.querySelector("img");
    var href = canvas ? canvas.toDataURL("image/png") : img ? img.src : "";
    if (!href) {
      showToast("二维码还在生成，请稍后再试");
      return;
    }
    var a = document.createElement("a");
    a.href = href;
    a.download = "xhs-studio-qr.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("二维码已下载");
  });

  // 手机端直接给一个入口
  if (direct && window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
    direct.hidden = false;
    var h1 = document.querySelector(".qr-copy h1");
    if (h1) h1.innerHTML = "在手机上<br>打开工作台";
    document.title = "工作台 · 小红书一键成图";
  }
})();
