// DFI System - EXEC Routes
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

router.use(requireAuth, requireRole(['exec', 'superadmin']));

// GET /exec/cases - Get cases (default: PIC = logged-in user, or all if search mode)
router.get('/cases', async (req, res) => {
    try {
        const { search, all } = req.query;
        
        let query = supabase
            .from('exec_cases')
            .select(`
                *,
                pic_user:users!exec_cases_pic_fkey(id, full_name, username)
            `)
            .order('created_at', { ascending: false });

        // Default: only show cases where PIC = logged-in user
        // If search mode (all=true), show all cases
        if (!all || all !== 'true') {
            query = query.eq('pic', req.user.id);
        }

        // Search by case_id
        if (search) {
            query = query.ilike('case_id', `%${search}%`);
        }

        const { data: cases, error } = await query;

        if (error) throw error;

        // Map PIC name
        const mappedCases = cases.map(c => ({
            ...c,
            pic_name: c.pic_user?.full_name || c.pic_user?.username || 'Unknown'
        }));

        res.json({ cases: mappedCases });
    } catch (error) {
        console.error('Get cases error:', error);
        res.status(500).json({ error: 'Failed to get cases' });
    }
});

// GET /exec/cases/:id - Get single case
router.get('/cases/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: caseData, error } = await supabase
            .from('exec_cases')
            .select(`
                *,
                pic_user:users!exec_cases_pic_fkey(id, full_name, username)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!caseData) return res.status(404).json({ error: 'Case not found' });

        caseData.pic_name = caseData.pic_user?.full_name || caseData.pic_user?.username;

        res.json({ case: caseData });
    } catch (error) {
        console.error('Get case error:', error);
        res.status(500).json({ error: 'Failed to get case' });
    }
});

// POST /exec/cases - Create new case
router.post('/cases', async (req, res) => {
    try {
        const {
            case_id, ic_number, customer_name, classification,
            case_type, mo, branch_code, branch_name,
            date_escalated, amount_involved, remarks, pic
        } = req.body;

        // Validation
        if (!case_id || !ic_number || !customer_name || !classification || !case_type || !mo || !branch_code || !date_escalated || !pic) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if case_id already exists
        const { data: existing } = await supabase
            .from('exec_cases')
            .select('id')
            .eq('case_id', case_id)
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Case ID already exists' });
        }

        const { data: newCase, error } = await supabase
            .from('exec_cases')
            .insert({
                case_id,
                ic_number,
                customer_name,
                classification,
                case_type,
                mo,
                branch_code,
                branch_name,
                date_escalated,
                amount_involved: amount_involved || 0,
                remarks,
                pic,
                status: 'WIP',
                created_by: req.user.id
            })
            .select()
            .single();

        if (error) throw error;

        await auditLog(req.user.id, 'CREATE_CASE', 'exec_case', newCase.id, { case_id });

        res.status(201).json({ case: newCase });
    } catch (error) {
        console.error('Create case error:', error);
        res.status(500).json({ error: 'Failed to create case' });
    }
});

// PUT /exec/cases/:id - Update case
router.put('/cases/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body, updated_at: new Date().toISOString() };
        delete updates.id;
        delete updates.created_at;
        delete updates.created_by;

        const { data: updatedCase, error } = await supabase
            .from('exec_cases')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        if (!updatedCase) return res.status(404).json({ error: 'Case not found' });

        await auditLog(req.user.id, 'UPDATE_CASE', 'exec_case', id, updates);

        res.json({ case: updatedCase });
    } catch (error) {
        console.error('Update case error:', error);
        res.status(500).json({ error: 'Failed to update case' });
    }
});

// PATCH /exec/cases/:id/close - Direct close (only if PIC = user)
router.patch('/cases/:id/close', async (req, res) => {
    try {
        const { id } = req.params;
        const { remarks, resolution } = req.body;

        // Get case to verify PIC
        const { data: caseData, error: fetchError } = await supabase
            .from('exec_cases')
            .select('pic')
            .eq('id', id)
            .single();

        if (fetchError || !caseData) {
            return res.status(404).json({ error: 'Case not found' });
        }

        if (caseData.pic !== req.user.id) {
            return res.status(403).json({ error: 'Only the PIC can directly close this case' });
        }

        const { data: updatedCase, error } = await supabase
            .from('exec_cases')
            .update({
                status: 'Closed',
                closing_remarks: remarks,
                resolution,
                date_closed: new Date().toISOString(),
                closed_by: req.user.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await auditLog(req.user.id, 'CLOSE_CASE', 'exec_case', id, { resolution });

        res.json({ case: updatedCase });
    } catch (error) {
        console.error('Close case error:', error);
        res.status(500).json({ error: 'Failed to close case' });
    }
});

// POST /exec/close-requests - Create close request (when PIC != user)
router.post('/close-requests', async (req, res) => {
    try {
        const { case_id, remarks, resolution } = req.body;

        // Get case details
        const { data: caseData, error: fetchError } = await supabase
            .from('exec_cases')
            .select('id, case_id, customer_name, classification, pic')
            .eq('id', case_id)
            .single();

        if (fetchError || !caseData) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const { data: request, error } = await supabase
            .from('close_case_requests')
            .insert({
                exec_case_id: case_id,
                case_id_ref: caseData.case_id,
                customer_name: caseData.customer_name,
                classification: caseData.classification,
                requested_by: req.user.id,
                remarks,
                resolution,
                status: 'Pending'
            })
            .select()
            .single();

        if (error) throw error;

        await auditLog(req.user.id, 'CREATE_CLOSE_REQUEST', 'close_request', request.id, { case_id });

        res.status(201).json({ request });
    } catch (error) {
        console.error('Create close request error:', error);
        res.status(500).json({ error: 'Failed to create close request' });
    }
});

// GET /exec/close-requests - Get user's close requests
router.get('/close-requests', async (req, res) => {
    try {
        const { status } = req.query;

        let query = supabase
            .from('close_case_requests')
            .select('*')
            .eq('requested_by', req.user.id)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data: requests, error } = await query;

        if (error) throw error;

        res.json({ requests });
    } catch (error) {
        console.error('Get close requests error:', error);
        res.status(500).json({ error: 'Failed to get close requests' });
    }
});

// GET /exec/users - Get EXEC users for PIC dropdown
router.get('/users', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, full_name')
            .in('role', ['exec', 'superadmin'])
            .eq('is_active', true)
            .order('full_name');

        if (error) throw error;

        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

module.exports = router;
