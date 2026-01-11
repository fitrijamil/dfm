// DFI System - Branch Routes
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /branches/:code - Lookup branch by code
router.get('/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const { data: branch, error } = await supabase
            .from('branch_master')
            .select('branch_code, branch_name, region, state')
            .eq('branch_code', code)
            .single();

        if (error || !branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        res.json({ branch });
    } catch (error) {
        console.error('Get branch error:', error);
        res.status(500).json({ error: 'Failed to get branch' });
    }
});

// GET /branches - List all branches
router.get('/', async (req, res) => {
    try {
        const { data: branches, error } = await supabase
            .from('branch_master')
            .select('branch_code, branch_name, region, state')
            .order('branch_code');

        if (error) throw error;

        res.json({ branches });
    } catch (error) {
        console.error('Get branches error:', error);
        res.status(500).json({ error: 'Failed to get branches' });
    }
});

module.exports = router;
