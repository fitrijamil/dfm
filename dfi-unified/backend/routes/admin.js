// DFI System - Admin Routes (Superadmin only) - BRD Compliant
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

router.use(requireAuth, requireRole('superadmin'));

// GET /admin/users - List all users with created_by info
router.get('/users', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, role, is_active, created_at, created_by')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get usernames for created_by
        const creatorIds = [...new Set(users.filter(u => u.created_by).map(u => u.created_by))];
        let creators = {};
        if (creatorIds.length > 0) {
            const { data: creatorData } = await supabase
                .from('users')
                .select('id, username')
                .in('id', creatorIds);
            creators = (creatorData || []).reduce((acc, c) => { acc[c.id] = c.username; return acc; }, {});
        }

        const result = users.map(u => ({
            ...u,
            created_by_username: u.created_by ? creators[u.created_by] || 'Unknown' : null
        }));

        res.json({ users: result });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// POST /admin/users - Create new user (BRD compliant - no full_name/email in users table)
router.post('/users', async (req, res) => {
    try {
        const { username, password, role, is_active } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ error: 'Username, password, and role are required' });
        }

        const validRoles = ['superadmin', 'senior', 'exec', 'officer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Check if username exists
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('username', username.toLowerCase())
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const password_hash = await bcrypt.hash(password, 12);

        const { data: user, error } = await supabase
            .from('users')
            .insert({
                username: username.toLowerCase(),
                password_hash,
                role,
                is_active: is_active !== false,
                created_by: req.user.id
            })
            .select('id, username, role, is_active, created_at')
            .single();

        if (error) throw error;

        await auditLog(req.user.id, 'CREATE_USER', 'user', user.id, { username, role });

        res.status(201).json({ user });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PATCH /admin/users/:id - Update user (toggle is_active or reset password)
router.patch('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { role, is_active, password } = req.body;

        const updates = {};
        if (role !== undefined) updates.role = role;
        if (is_active !== undefined) updates.is_active = is_active;
        if (password) updates.password_hash = await bcrypt.hash(password, 12);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select('id, username, role, is_active')
            .single();

        if (error) throw error;
        if (!user) return res.status(404).json({ error: 'User not found' });

        await auditLog(req.user.id, 'UPDATE_USER', 'user', id, { updates: Object.keys(updates) });

        res.json({ user });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

module.exports = router;
