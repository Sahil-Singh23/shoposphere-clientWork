import express from "express";
// import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import prisma from "../prisma.js";

const router = express.Router();

const GIFT_BUDDY_SYSTEM_PROMPT = `You are Gift Buddy 🤝🎁, a friendly and helpful Gift Shopping Assistant for an online gift shop.

Your job: help customers find the perfect gift (occasion, recipient, budget, quantity). Be like a real, friendly advisor—not a robot.

LANGUAGE & TONE (IMPORTANT):
- Reply ONLY in Hinglish (natural mix of Hindi + English). Example: "Achha choice hai! Ye gifts dekh lo 🎁" or "Budget ke hisaab se ye options best hain."
- Keep your "message" SHORT: 1–3 sentences max. No long paragraphs. Friendly, warm, casual.
- Use emojis sparingly (🎁 😊 👍). Never sound robotic or salesy.

GIFT SUGGESTION RULES (CRITICAL):
- Suggest ONLY 2–4 products. Use ONLY products from LIVE_PRODUCT_DATA. Never invent products or prices.
- Every suggestion: gift name, why it's good, price range. Match occasion/budget from the user.
- If out of stock: "Ye abhi out of stock hai 😕 Par similar options dikhata hoon."

LINKS (IMPORTANT): Product cards with clickable "View" / "Add" links are shown BELOW your message automatically. So:
- NEVER say "main direct link nahi de sakta", "search karo", "product IDs de raha hoon website par search karo", or "link nahi de sakta". That is wrong—links are already there in the cards below.
- Instead say: "Neeche in gifts pe click karke dekh lo! 😊" or "In options pe View/Add pe click karo." so user knows the cards below are clickable. Do NOT mention product IDs or "search" in your reply.

BUDGET: Respect user budget. No exact match? Suggest nearby options in 1 short line.

RESPONSE FORMAT (JSON only): Reply with exactly this JSON, nothing else:
{"message": "Your short Hinglish reply here", "productIds": [id1, id2, ...]}

- "message": Short, friendly reply in Hinglish (1–3 sentences).
- "productIds": Product IDs from LIVE_PRODUCT_DATA only. Max 2–4. Empty [] if no products.
- Be honest, helpful, and keep it brief.`;

function buildProductContext(products, categories, occasions) {
  const items = products.map((p) => {
    const cats = (p.categories || []).map((c) => c.name || c).join(", ");
    const occs = (p.occasions || []).map((o) => o.name || o).join(", ");
    let priceStr = "";
    if (p.sizes && p.sizes.length > 0) {
      const prices = p.sizes.map((s) => s.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      priceStr = min === max ? `₹${min}` : `₹${min} - ₹${max}`;
    }
    return {
      id: p.id,
      name: p.name,
      description: (p.description || "").slice(0, 200),
      price: priceStr,
      categories: cats,
      occasions: occs,
      isTrending: !!p.isTrending,
      isNew: !!p.isNew,
      isFestival: !!p.isFestival,
      inStock: true,
    };
  });
  return JSON.stringify(items, null, 2);
}

function buildWelcomeContext(categories, occasions) {
  const catNames = (categories || []).map((c) => c.name).filter(Boolean);
  const occNames = (occasions || []).map((o) => o.name).filter(Boolean);
  return { categories: catNames, occasions: occNames };
}

router.post("/", async (req, res) => {
  try {
    const { messages = [] } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const [productsRaw, categories, occasions] = await Promise.all([
      prisma.product.findMany({
        where: {},
        include: {
          sizes: true,
          categories: { include: { category: true } },
          occasions: { include: { occasion: true } },
        },
        orderBy: [{ order: "asc" }, { isTrending: "desc" }, { isNew: "desc" }, { createdAt: "desc" }],
      }),
      prisma.category.findMany({ orderBy: { order: "asc" } }),
      prisma.occasion.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
    ]);

    const products = productsRaw.map((p) => {
      let imgs = [];
      try {
        const parsed = JSON.parse(p.images || "[]");
        imgs = Array.isArray(parsed) ? parsed : [];
      } catch (_) {}
      return {
        ...p,
        images: imgs,
        categories: (p.categories || []).map((pc) => pc.category),
        occasions: (p.occasions || []).map((po) => po.occasion),
      };
    });

    const productContext = buildProductContext(products, categories, occasions);
    const welcomeContext = buildWelcomeContext(categories, occasions);

    const systemContent = `${GIFT_BUDDY_SYSTEM_PROMPT}

LIVE_PRODUCT_DATA (use these IDs when suggesting products):
${productContext}

AVAILABLE_CATEGORIES: ${JSON.stringify(welcomeContext.categories)}
AVAILABLE_OCCASIONS: ${JSON.stringify(welcomeContext.occasions)}
`;

    // --- Gemini / Gemma (Gemma does not support systemInstruction; pass as first user message, then full history) ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim() !== "") {
      const ai = new GoogleGenAI({ apiKey });
      const history = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content || "") }],
      }));
      const contents = [
        { role: "user", parts: [{ text: `${systemContent}\n\n---\n\nYou must reply with ONLY valid JSON: {"message": "your reply", "productIds": [id1, id2, ...]}. No other text. Now here is the conversation:\n\n(Continue below.)` }] },
        { role: "model", parts: [{ text: '{"message": "Ready!", "productIds": []}' }] },
        ...history,
      ];
      const response = await ai.models.generateContent({
        model: "gemma-3-12b-it",
        contents,
        config: {
          maxOutputTokens: 400,
          temperature: 0.7,
        },
      });
      const raw = response.text?.trim();
      if (!raw) {
        return res.status(502).json({ error: "No response from assistant." });
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.json({ message: raw, products: [] });
      }
      const productIds = Array.isArray(parsed.productIds) ? parsed.productIds : [];
      const suggested = products.filter((p) => productIds.includes(p.id)).slice(0, 4);
      const productPayload = suggested.map((p) => ({
        id: p.id,
        name: p.name,
        description: (p.description || "").slice(0, 200),
        images: p.images || [],
        originalPrice: p.originalPrice,
        sizes: (p.sizes || []).map((s) => ({ id: s.id, label: s.label, price: s.price, originalPrice: s.originalPrice })),
        categories: (p.categories || []).map((c) => ({ id: c?.id, name: c?.name })),
        occasions: (p.occasions || []).map((o) => ({ id: o?.id, name: o?.name })),
        badge: p.badge,
        isTrending: p.isTrending,
        isNew: p.isNew,
      }));
      return res.json({
        message: parsed.message || raw,
        products: productPayload,
      });
    }

    // --- OpenAI (commented out – uncomment and set OPENAI_API_KEY to use) ---
    // const openaiKey = process.env.OPENAI_API_KEY;
    // if (openaiKey && openaiKey.trim() !== "") {
    //   const openai = new OpenAI({ apiKey: openaiKey });
    //   const apiMessages = [
    //     { role: "system", content: systemContent },
    //     ...messages.map((m) => ({
    //       role: m.role === "user" || m.role === "assistant" ? m.role : "user",
    //       content: String(m.content || ""),
    //     })),
    //   ];
    //   const completion = await openai.chat.completions.create({
    //     model: "gpt-4o-mini",
    //     messages: apiMessages,
    //     max_tokens: 600,
    //     temperature: 0.7,
    //     response_format: { type: "json_object" },
    //   });
    //   const raw = completion.choices[0]?.message?.content?.trim();
    //   if (!raw) {
    //     return res.status(502).json({ error: "No response from assistant." });
    //   }
    //   let parsed;
    //   try {
    //     parsed = JSON.parse(raw);
    //   } catch {
    //     return res.json({ message: raw, products: [] });
    //   }
    //   const productIds = Array.isArray(parsed.productIds) ? parsed.productIds : [];
    //   const suggested = products.filter((p) => productIds.includes(p.id)).slice(0, 4);
    //   const productPayload = suggested.map((p) => ({
    //     id: p.id,
    //     name: p.name,
    //     description: (p.description || "").slice(0, 200),
    //     images: p.images || [],
    //     originalPrice: p.originalPrice,
    //     sizes: (p.sizes || []).map((s) => ({ id: s.id, label: s.label, price: s.price, originalPrice: s.originalPrice })),
    //     categories: (p.categories || []).map((c) => ({ id: c?.id, name: c?.name })),
    //     occasions: (p.occasions || []).map((o) => ({ id: o?.id, name: o?.name })),
    //     badge: p.badge,
    //     isTrending: p.isTrending,
    //     isNew: p.isNew,
    //   }));
    //   return res.json({
    //     message: parsed.message || raw,
    //     products: productPayload,
    //   });
    // }

    return res.status(400).json({
      error: "GEMINI_API_KEY is not configured. Add it in your server environment variables (or use OPENAI_API_KEY by uncommenting the OpenAI block).",
    });
  } catch (err) {
    console.error("Chat error:", err);
    const status = err.status === 401 ? 401 : err.status === 429 ? 429 : 500;
    const message = err.message || err.error?.message || "Chat failed.";
    return res.status(status).json({ error: message });
  }
});

export default router;
