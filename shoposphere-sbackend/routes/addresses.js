import express from "express";
import prisma from "../prisma.js";
import { requireCustomerAuth } from "../utils/auth.js";

const router = express.Router();

function validateAddressBody(body) {
  const err = {};
  if (!body.fullName?.trim()) err.fullName = "Full name is required";
  if (!body.phone?.trim()) err.phone = "Phone is required";
  else if (body.phone.replace(/\D/g, "").length < 10) err.phone = "Valid 10-digit phone required";
  if (!body.addressLine?.trim()) err.addressLine = "Address line is required";
  if (!body.city?.trim()) err.city = "City is required";
  if (!body.state?.trim()) err.state = "State is required";
  if (!body.pincode?.trim()) err.pincode = "Pincode is required";
  else if (!/^\d{6}$/.test(body.pincode.trim())) err.pincode = "Pincode must be 6 digits";
  return Object.keys(err).length ? err : null;
}

async function unsetDefault(userId) {
  await prisma.address.updateMany({
    where: { userId },
    data: { isDefault: false },
  });
}

// GET /addresses — all addresses for logged-in user
router.get("/", requireCustomerAuth, async (req, res) => {
  try {
    const list = await prisma.address.findMany({
      where: { userId: req.customerUserId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /addresses/add
router.post("/add", requireCustomerAuth, async (req, res) => {
  try {
    const err = validateAddressBody(req.body);
    if (err) return res.status(400).json({ error: Object.values(err)[0], fields: err });

    const { fullName, phone, addressLine, city, state, pincode, isDefault, latitude, longitude } = req.body;
    const userId = req.customerUserId;

    if (isDefault) await unsetDefault(userId);

    const address = await prisma.address.create({
      data: {
        userId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        addressLine: addressLine.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim().replace(/\D/g, "").slice(0, 6),
        latitude: latitude != null && Number.isFinite(Number(latitude)) ? Number(latitude) : null,
        longitude: longitude != null && Number.isFinite(Number(longitude)) ? Number(longitude) : null,
        isDefault: !!isDefault,
      },
    });
    res.status(201).json(address);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /addresses/update/:id
router.put("/update/:id", requireCustomerAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const err = validateAddressBody(req.body);
    if (err) return res.status(400).json({ error: Object.values(err)[0], fields: err });

    const existing = await prisma.address.findFirst({
      where: { id, userId: req.customerUserId },
    });
    if (!existing) return res.status(404).json({ error: "Address not found" });

    const { fullName, phone, addressLine, city, state, pincode, isDefault, latitude, longitude } = req.body;
    if (isDefault && !existing.isDefault) await unsetDefault(req.customerUserId);

    const address = await prisma.address.update({
      where: { id },
      data: {
        fullName: fullName.trim(),
        phone: phone.trim(),
        addressLine: addressLine.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim().replace(/\D/g, "").slice(0, 6),
        latitude: latitude != null && Number.isFinite(Number(latitude)) ? Number(latitude) : null,
        longitude: longitude != null && Number.isFinite(Number(longitude)) ? Number(longitude) : null,
        isDefault: !!isDefault,
      },
    });
    res.json(address);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /addresses/delete/:id
router.delete("/delete/:id", requireCustomerAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.address.findFirst({
      where: { id, userId: req.customerUserId },
    });
    if (!existing) return res.status(404).json({ error: "Address not found" });

    await prisma.address.delete({ where: { id } });

    if (existing.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId: req.customerUserId },
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /addresses/set-default/:id
router.put("/set-default/:id", requireCustomerAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.address.findFirst({
      where: { id, userId: req.customerUserId },
    });
    if (!existing) return res.status(404).json({ error: "Address not found" });

    await unsetDefault(req.customerUserId);
    const updated = await prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
