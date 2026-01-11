// DFI System - Auth Routes (BRD Compliant)
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, generateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, password_hash, role, is_active')
            .eq('username', username.toLowerCase())
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'Account is disabled' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last_login in profile if exists
        await supabase
            .from('user_profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('user_id', user.id);

        const token = generateToken(user);

        await auditLog(user.id, 'LOGIN', 'user', user.id, { username });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /auth/me - Validate token and get current user
router.get('/me', requireAuth, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, role, is_active')
            .eq('id', req.user.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'Account is disabled' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

module.exports = router;
