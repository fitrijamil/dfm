// DFI System - Officer Routes (RPP Incoming) - BRD FR-40/41/42 Compliant
const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

router.use(requireAuth, requireRole(['officer', 'superadmin']));

// GET /officer/rpp-cases
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

// GET /officer/rpp-cases/:id
router.get('/rpp-cases/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: caseData, error } = await supabase
            .from('rpp_cases')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!caseData) return res.status(404).json({ error: 'RPP case not found' });

        res.json({ case: caseData });
    } catch (error) {
        console.error('Get RPP case error:', error);
        res.status(500).json({ error: 'Failed to get RPP case' });
    }
});

// POST /officer/rpp-cases - Create with FR-42 duplicate checking
router.post('/rpp-cases', async (req, res) => {
    try {
        const {
            bmid, rpp_id, source_type, date_received, month_received,
            email, rpp_portal, complainant_name, complainant_ic, complainant_phone,
            bank_name, account_number, amount, fraud_type,
            icbs_tag, action_taken_icbs, fund_result, fund_pr_status, fund_memo_type,
            status, remarks
        } = req.body;

        // Validation
        if (!bmid || !source_type) {
            return res.status(400).json({ error: 'BMID and Source Type are required' });
        }

        // FR-42: Duplicate check - max 2 per BMID (one Email, one RPP Portal)
        const { data: existing, error: dupError } = await supabase
            .from('rpp_cases')
            .select('id, source_type')
            .eq('bmid', bmid);

        if (dupError) throw dupError;

        if (existing && existing.length >= 2) {
            return res.status(409).json({ 
                error: 'FR-42: Maximum 2 entries per BMID reached (one Email + one RPP Portal)' 
            });
        }

        if (existing && existing.some(e => e.source_type === source_type)) {
            return res.status(409).json({ 
                error: `FR-42: This BMID already has a "${source_type}" entry. Use different source type.` 
            });
        }

        // FR-41: Validate Fund fields
        if (fund_result && fund_result !== 'None') {
            if (!fund_pr_status || !fund_memo_type) {
                return res.status(400).json({ 
                    error: 'FR-41: Fund PR Status and Memo Type are required when Fund Result is not "None"' 
                });
            }
        }

        // FR-40: Auto-fill PIC from logged-in user
        const { data: newCase, error } = await supabase
            .from('rpp_cases')
            .insert({
                bmid,
                rpp_id,
                source_type,
                date_received: date_received || new Date().toISOString().split('T')[0],
                month_received: month_received || (date_received ? date_received.substring(0, 7) : new Date().toISOString().substring(0, 7)),
                email: source_type === 'Email' ? email : null,
                rpp_portal: source_type === 'RPP Portal' ? rpp_portal : null,
                complainant_name,
                complainant_ic,
                complainant_phone,
                bank_name,
                account_number,
                amount: amount || 0,
                fraud_type,
                icbs_tag: icbs_tag || null,
                action_taken_icbs,
                fund_result,
                fund_pr_status: fund_result === 'None' ? 'Nil' : fund_pr_status,
                fund_memo_type: fund_result === 'None' ? 'No record found' : fund_memo_type,
                status: status || 'Pending',
                remarks,
                pic: req.user.id,
                created_by: req.user.id
            })
            .select()
            .single();

        if (error) throw error;

        await auditLog(req.user.id, 'CREATE_RPP_CASE', 'rpp_case', newCase.id, { bmid, source_type });

        res.status(201).json({ case: newCase });
    } catch (error) {
        console.error('Create RPP case error:', error);
        res.status(500).json({ error: error.message || 'Failed to create RPP case' });
    }
});

// PUT /officer/rpp-cases/:id - Update with FR-42 duplicate checking
router.put('/rpp-cases/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { bmid, source_type, fund_result, fund_pr_status, fund_memo_type } = req.body;

        // FR-42: Check duplicates if bmid or source_type changed
        if (bmid && source_type) {
            const { data: existing } = await supabase
                .from('rpp_cases')
                .select('id, source_type')
                .eq('bmid', bmid)
                .neq('id', id);

            if (existing && existing.length >= 2) {
                return res.status(409).json({ 
                    error: 'FR-42: Maximum 2 entries per BMID reached' 
                });
            }

            if (existing && existing.some(e => e.source_type === source_type)) {
                return res.status(409).json({ 
                    error: `FR-42: This BMID already has a "${source_type}" entry` 
                });
            }
        }

        // FR-41: Validate Fund fields
        if (fund_result && fund_result !== 'None') {
            if (!fund_pr_status || !fund_memo_type) {
                return res.status(400).json({ 
                    error: 'FR-41: Fund PR Status and Memo Type are required when Fund Result is not "None"' 
                });
            }
        }

        const updates = { ...req.body, updated_at: new Date().toISOString() };
        delete updates.id;
        delete updates.created_at;
        delete updates.created_by;

        // FR-41: Auto-fill if fund_result is None
        if (updates.fund_result === 'None') {
            updates.fund_pr_status = 'Nil';
            updates.fund_memo_type = 'No record found';
        }

        const { data: updatedCase, error } = await supabase
            .from('rpp_cases')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        if (!updatedCase) return res.status(404).json({ error: 'RPP case not found' });

        await auditLog(req.user.id, 'UPDATE_RPP_CASE', 'rpp_case', id, { bmid });

        res.json({ case: updatedCase });
    } catch (error) {
        console.error('Update RPP case error:', error);
        res.status(500).json({ error: error.message || 'Failed to update RPP case' });
    }
});

module.exports = router;
