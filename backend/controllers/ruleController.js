const Rule = require('../models/Rule');
const { isMongoConnected, getState, createSampleId } = require('../config/fallbackStore');

// ---- fallback store helpers ----
const getRulesStore = () => {
  const state = getState();
  if (!state.rules) state.rules = [];
  return state.rules;
};

const createRuleStore = (payload) => {
  const rule = { _id: createSampleId('rule'), ...payload };
  getRulesStore().unshift(rule);
  return rule;
};

const updateRuleStore = (id, payload) => {
  const rules = getRulesStore();
  const index = rules.findIndex((rule) => String(rule._id) === String(id));
  if (index === -1) return null;
  rules[index] = { ...rules[index], ...payload };
  return rules[index];
};

const deleteRuleStore = (id) => {
  const rules = getRulesStore();
  const index = rules.findIndex((rule) => String(rule._id) === String(id));
  if (index === -1) return false;
  rules.splice(index, 1);
  return true;
};

// PUBLIC: only active rules, ordered
exports.getRules = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      const rules = getRulesStore()
        .filter((rule) => rule.isActive !== false)
        .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
      return res.json(rules);
    }
    const start = process.hrtime.bigint();
    const rules = await Rule.find({ isActive: true }).sort({ displayOrder: 1, createdAt: -1 });
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[api-timing] GET /rules: ${durationMs.toFixed(0)}ms`);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch rules', error: error.message });
  }
};

// ADMIN: all rules including inactive
exports.getAllRules = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.json([...getRulesStore()].sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0)));
    }
    const start = process.hrtime.bigint();
    const rules = await Rule.find().sort({ displayOrder: 1, createdAt: -1 });
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[api-timing] GET /rules/all: ${durationMs.toFixed(0)}ms`);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch rules', error: error.message });
  }
};

exports.createRule = async (req, res) => {
  try {
    const { title, description, category, isActive, displayOrder } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }
    const payload = {
      title: String(title).trim(),
      description: String(description).trim(),
      category: (category || 'General').trim(),
      isActive: isActive === undefined ? true : isActive === true || isActive === 'true',
      displayOrder: Number(displayOrder) || 0
    };
    if (!isMongoConnected()) {
      return res.status(201).json(createRuleStore(payload));
    }
    const rule = await Rule.create(payload);
    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create rule', error: error.message });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const updateData = {};
    if (req.body.title !== undefined) updateData.title = String(req.body.title).trim();
    if (req.body.description !== undefined) updateData.description = String(req.body.description).trim();
    if (req.body.category !== undefined) updateData.category = String(req.body.category).trim();
    if (req.body.isActive !== undefined) {
      updateData.isActive = req.body.isActive === true || req.body.isActive === 'true';
    }
    if (req.body.displayOrder !== undefined) updateData.displayOrder = Number(req.body.displayOrder) || 0;

    if (!isMongoConnected()) {
      const rule = updateRuleStore(req.params.id, updateData);
      if (!rule) return res.status(404).json({ message: 'Rule not found' });
      return res.json(rule);
    }
    const rule = await Rule.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update rule', error: error.message });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      if (!deleteRuleStore(req.params.id)) return res.status(404).json({ message: 'Rule not found' });
      return res.json({ message: 'Rule deleted' });
    }
    const rule = await Rule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({ message: 'Rule deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete rule', error: error.message });
  }
};
