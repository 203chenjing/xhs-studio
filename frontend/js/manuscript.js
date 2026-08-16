/**
 * Manuscript view — extract readable text from page DATA for full-text scan.
 */
(function (global) {
  "use strict";

  function pushBlock(blocks, label, text, path) {
    const t = String(text ?? "")
      .replace(/\r\n/g, "\n")
      .trim();
    if (!t) return;
    blocks.push({ label: label || "正文", text: t, path: path || null });
  }

  function formatTag(t) {
    const s = String(t || "").trim();
    if (!s) return "";
    return s.startsWith("#") ? s : "#" + s;
  }

  function pushStringList(blocks, prefix, items, listKey) {
    (items || []).forEach((it, i) => {
      if (typeof it === "string") pushBlock(blocks, `${prefix}${i + 1}`, it, `${listKey}[${i}]`);
    });
  }

  function pushObjectList(blocks, prefix, items, listKey) {
    (items || []).forEach((it, i) => {
      if (!it || typeof it !== "object") return;
      const head = it.head || it.label || it.title || it.time || "";
      const body = it.body || it.text || it.value || "";
      if (head && body) {
        pushBlock(blocks, `${prefix}${i + 1}`, `${head}\n${body}`, `${listKey}[${i}]`);
      } else if (head) {
        pushBlock(blocks, `${prefix}${i + 1}`, head, `${listKey}[${i}].head`);
      } else if (body) {
        pushBlock(blocks, `${prefix}${i + 1}`, body, `${listKey}[${i}].body`);
      }
    });
  }

  function extractCompareRows(blocks, page, basePath) {
    const rowBase = basePath ? `${basePath}.rows` : "rows";
    const rows = page.rows || [];
    rows.forEach((r, i) => {
      if (!r || typeof r !== "object") return;
      const label = r.label || r.head || r.item || r.dim || `对比${i + 1}`;
      pushBlock(blocks, `行${i + 1}·维度`, label, `${rowBase}[${i}].label`);
      const vals = Array.isArray(r.values) ? r.values : [];
      vals.forEach((v, j) => {
        if (v != null && String(v).trim()) {
          pushBlock(blocks, `行${i + 1}·列${j + 1}`, String(v), `${rowBase}[${i}].values[${j}]`);
        }
      });
    });
  }

  function extractBlockContent(block, blocks, prefix, blockIndex) {
    if (!block || typeof block !== "object") return;
    const bt = block.type || "card";
    const p = prefix ? `${prefix} · ` : "";
    const bp = blockIndex != null ? `blocks[${blockIndex}]` : "";
    const fieldPath = (rel) => (bp ? `${bp}.${rel}` : rel);
    const listPath = (rel) => (bp ? `${bp}.${rel}` : rel);
    if (block.title) pushBlock(blocks, `${p}标题`, block.title, fieldPath("title"));
    if (block.intro) pushBlock(blocks, `${p}导语`, block.intro, fieldPath("intro"));
    if (block.body) pushBlock(blocks, `${p}正文`, block.body, fieldPath("body"));
    if (block.text) pushBlock(blocks, `${p}金句`, block.text, fieldPath("text"));
    if (block.label) pushBlock(blocks, `${p}标签`, block.label, fieldPath("label"));
    if (bt === "points") pushObjectList(blocks, `${p}要点`, block.items, listPath("items"));
    if (bt === "timeline") pushObjectList(blocks, `${p}步骤`, block.steps, listPath("steps"));
    if (bt === "compare") extractCompareRows(blocks, block, bp || null);
    if (bt === "summary") pushStringList(blocks, `${p}总结`, block.items, listPath("items"));
    if (bt === "free") {
      pushStringList(blocks, `${p}段落`, block.paragraphs, listPath("paragraphs"));
      pushStringList(blocks, `${p}要点`, block.bullets, listPath("bullets"));
    }
  }

  /**
   * @param {object} page
   * @param {number} index 0-based
   * @param {Record<string,string>} [typeLabels]
   * @returns {{ index: number, pageLabel: string, type: string, blocks: Array<{label:string,text:string,path:string|null}> }}
   */
  function extractPageText(page, index, typeLabels) {
    const labels = typeLabels || {};
    const t = (page && page.type) || "card";
    const typeZh = labels[t] || t;
    const role = page && page.role;
    const pageLabel = role ? `P${index + 1}·${role}` : `P${index + 1}·${typeZh}`;
    const blocks = [];

    if (!page) return { index, pageLabel, type: t, blocks };

    if (page.bridge) pushBlock(blocks, "衔接", page.bridge, "bridge");

    if (
      Array.isArray(page.blocks) &&
      page.blocks.length &&
      t !== "cover" &&
      t !== "ending" &&
      t !== "composite"
    ) {
      pushBlock(blocks, "标题", page.title, "title");
      page.blocks.forEach((b, bi) => {
        extractBlockContent(b, blocks, `模块${bi + 1}`, bi);
      });
    } else switch (t) {
      case "cover":
        pushBlock(blocks, "角标", page.kicker, "kicker");
        pushBlock(blocks, "标题", page.title, "title");
        pushBlock(blocks, "副标题", page.subtitle, "subtitle");
        if (page.tags && page.tags.length) {
          pushBlock(blocks, "话题", page.tags.map(formatTag).join("  "));
        }
        break;
      case "chapter":
        pushBlock(blocks, "章节号", page.no, "no");
        pushBlock(blocks, "标题", page.title, "title");
        pushBlock(blocks, "说明", page.desc, "desc");
        break;
      case "points":
        pushBlock(blocks, "标题", page.title, "title");
        pushBlock(blocks, "导语", page.intro, "intro");
        pushObjectList(blocks, "要点", page.items, "items");
        break;
      case "timeline":
        pushBlock(blocks, "标题", page.title, "title");
        pushObjectList(blocks, "步骤", page.steps, "steps");
        break;
      case "card":
        pushBlock(blocks, "标签", page.label, "label");
        pushBlock(blocks, "标题", page.title, "title");
        pushBlock(blocks, "正文", page.body, "body");
        pushStringList(blocks, "提示", page.tips, "tips");
        break;
      case "quote":
        pushBlock(blocks, "金句", page.text, "text");
        pushBlock(blocks, "出处", page.from, "from");
        break;
      case "compare":
        pushBlock(blocks, "标题", page.title, "title");
        extractCompareRows(blocks, page);
        break;
      case "summary":
        pushBlock(blocks, "标题", page.title, "title");
        pushStringList(blocks, "总结", page.items, "items");
        if (page.metrics && page.metrics.length) {
          const mtext = page.metrics
            .map((m) => `${m.num || ""}${m.unit || ""}`.trim())
            .filter(Boolean)
            .join(" · ");
          pushBlock(blocks, "数据", mtext);
        }
        break;
      case "ending":
        pushBlock(blocks, "标题", page.title, "title");
        pushBlock(blocks, "说明", page.desc, "desc");
        pushStringList(blocks, "行动", page.cta, "cta");
        pushBlock(blocks, "联系", page.contact, "contact");
        if (page.tags && page.tags.length) {
          pushBlock(blocks, "话题", page.tags.map(formatTag).join("  "));
        }
        break;
      case "photo":
        pushBlock(blocks, "标题", page.title, "title");
        pushBlock(blocks, "配文", page.body, "body");
        if (page.image) pushBlock(blocks, "配图", "（已设配图）");
        break;
      case "gallery":
        pushBlock(blocks, "标题", page.title, "title");
        pushBlock(blocks, "说明", page.caption, "caption");
        {
          const n = (page.images || []).filter(Boolean).length || (page.image ? 1 : 0);
          if (n) pushBlock(blocks, "图片", `${n} 张`);
        }
        break;
      case "free":
        pushBlock(blocks, "角标", page.kicker, "kicker");
        pushBlock(blocks, "标题", page.title, "title");
        pushStringList(blocks, "段落", page.paragraphs, "paragraphs");
        pushStringList(blocks, "要点", page.bullets, "bullets");
        if (!page.paragraphs?.length && !page.bullets?.length) {
          pushBlock(blocks, "正文", page.body || page.text, "body");
        }
        break;
      case "composite":
        pushBlock(blocks, "标题", page.title, "title");
        (page.blocks || []).forEach((b, bi) => {
          extractBlockContent(b, blocks, `模块${bi + 1}`, bi);
        });
        break;
      default:
        pushBlock(blocks, "标题", page.title, "title");
        pushBlock(blocks, "正文", page.body || page.text, "body");
        break;
    }

    if (!blocks.length) {
      pushBlock(blocks, "（无文案）", "此页主要为图片或留白");
    }

    return { index, pageLabel, type: t, blocks };
  }

  function extractAll(pages, typeLabels) {
    return (pages || []).map((p, i) => extractPageText(p, i, typeLabels));
  }

  global.XHSManuscript = {
    extractPageText,
    extractAll,
  };
})(typeof window !== "undefined" ? window : globalThis);
