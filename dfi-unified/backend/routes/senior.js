// DFI System - Senior Routes - BRD Compliant
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

router.use(requireAuth, requireRole(['senior', 'superadmin']));

// GET /senior/statistics
router.get('/statistics', async (req, res) => {
    try {
        const { data: execCases } = await supabase
            .from('exec_cases')
            .select('id, classification, mo, status, date_escalated, date_closed');

        const { data: rppCases } = await supabase
            .from('rpp_cases')
            .select('id, bank_name, date_received, month_received, status');

        const { data: closeRequests } = await supabase
            .from('close_case_requests')
            .select('id')
            .eq('status', 'Pending');

        // TAT breach calculation (>14 days)
        const today = new Date();
        const tatBreach = (execCases || []).filter(c => {
            if (!c.date_escalated) return false;
            const start = new Date(c.date_escalated);
            const end = c.status === 'Closed' && c.date_closed ? new Date(c.date_closed) : today;
            return Math.floor((end - start) / (1000 * 60 * 60 * 24)) > 14;
        }).length;

        // Classification breakdown
        const classification = { Fraud: 0, Scam: 0, 'Non-Fraud': 0 };
        (execCases || []).forEach(c => { if (c.classification) classification[c.classification]++; });

        // MO breakdown
        const moBreakdown = {};
        (execCases || []).forEach(c => { if (c.mo) moBreakdown[c.mo] = (moBreakdown[c.mo] || 0) + 1; });

        // Bank breakdown
        const bankBreakdown = {};
        (rppCases || []).forEach(c => { if (c.bank_name) bankBreakdown[c.bank_name] = (bankBreakdown[c.bank_name] || 0) + 1; });

        // RPP monthly
        const rppMonthly = {};
        (rppCases || []).forEach(c => { 
            const m = c.month_received || (c.date_received ? c.date_received.substring(0, 7) : null);
            if (m) rppMonthly[m] = (rppMonthly[m] || 0) + 1;
        });

        res.json({
            statistics: {
                totalExecCases: (execCases || []).length,
                totalRppCases: (rppCases || []).length,
                pendingCloseRequests: (closeRequests || []).length,
                tatBreach,
                classification,
                moBreakdown,
                bankBreakdown,
                rppMonthly
            }
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// GET /senior/exec-cases - Read-only view
router.get('/exec-cases', async (req, res) => {
    try {
        const { data: cases, error } = await supabase
            .from('exec_cases')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get PIC names
        const picIds = [...new Set((cases || []).filter(c => c.pic).map(c => c.pic))];
        let picNames = {};
        if (picIds.length > 0) {
            const { data: users } = await supabase.from('users').select('id, username').in('id', picIds);
            picNames = (users || []).reduce((acc, u) => { acc[u.id] = u.username; return acc; }, {});
        }

        const result = (cases || []).map(c => ({ ...c, pic_name: c.pic ? picNames[c.pic] || 'Unknown' : null }));

        res.json({ cases: result });
    } catch (error) {
        console.error('Get exec cases error:', error);
        res.status(500).json({ error: 'Failed to get exec cases' });
    }
});

// GET /senior/rpp-cases - Read-only view
router.get('/rpp-cases', async (req, res) => {
    try {
        const { data: cases, error } = await supabase
            .from('rpp_cases')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ cases });
    } catch (error) {
        console.error('Get RPP cases error:', error);
        res.status(500).json({ error: 'Failed to get RPP cases' });
    }
});

// GET /senior/close-requests
router.get('/close-requests', async (req, res) => {
    try {
        const { data: requests, error } = await supabase
            .from('close_case_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get requester names
        const reqIds = [...new Set((requests || []).filter(r => r.requested_by).map(r => r.requested_by))];
        let reqNames = {};
        if (reqIds.length > 0) {
            const { data: users } = await supabase.from('users').select('id, username').in('id', reqIds);
            reqNames = (users || []).reduce((acc, u) => { acc[u.id] = u.username; return acc; }, {});
        }

        const result = (requests || []).map(r => ({ ...r, requested_by_name: r.requested_by ? reqNames[r.requested_by] || 'Unknown' : null }));

        res.json({ requests: result });
    } catch (error) {
        console.error('Get close requests error:', error);
        res.status(500).json({ error: 'Failed to get close requests' });
    }
});

// PATCH /senior/close-requests/:id - Approve/Reject with MANDATORY remark
router.patch('/close-requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, senior_remark } = req.body;

        // Validate status
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Use "approved" or "rejected"' });
        }

        // MANDATORY: Senior remark
        if (!senior_remark || !senior_remark.trim()) {
            return res.status(400).json({ error: 'Senior remark is MANDATORY for approval/rejection' });
        }

        // Get request
        const { data: request, error: fetchErr } = await supabase
            .from('close_case_requests')
            .select('exec_case_id, resolution, remarks')
            .eq('id', id)
            .single();

        if (fetchErr || !request) {
            return res.status(404).json({ error: 'Close request not found' });
        }

        // Update request
        const { data: updated, error: updateErr } = await supabase
            .from('close_case_requests')
            .update({
                status: status.charAt(0).toUpperCase() + status.slice(1),
                senior_remark: senior_remark.trim(),
                reviewed_by: req.user.id,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateErr) throw updateErr;

        // If approved, close the case and set date_closed
        if (status === 'approved') {
            const { error: closeErr } = await supabase
                .from('exec_cases')
                .update({
                    status: 'Closed',
                    closing_remarks: request.remarks,
                    resolution: request.resolution,
                    date_closed: new Date().toISOString().split('T')[0],
                    closed_by: req.user.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', request.exec_case_id);

            if (closeErr) throw closeErr;

            await auditLog(req.user.id, 'APPROVE_CLOSE_REQUEST', 'close_request', id, { senior_remark });
            await auditLog(req.user.id, 'CLOSE_CASE', 'exec_case', request.exec_case_id, { via: 'senior_approval' });
        } else {
            await auditLog(req.user.id, 'REJECT_CLOSE_REQUEST', 'close_request', id, { senior_remark });
        }

        res.json({ request: updated });
    } catch (error) {
        console.error('Update close request error:', error);
        res.status(500).json({ error: 'Failed to process close request' });
    }
});

module.exports = router;
