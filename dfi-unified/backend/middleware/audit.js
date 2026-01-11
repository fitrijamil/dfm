// DFI System - Audit Logging Middleware
const supabase = require('../db/supabase');

const auditLog = async (userId, action, resourceType, resourceId, details = {}) => {
    try {
        await supabase.from('audit_logs').insert({
            user_id: userId,
            action: action,
            resource_type: resourceType,
            resource_id: resourceId,
            details: details,
            ip_address: null,
            created_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Audit log error:', error);
    }
};

const auditMiddleware = (action, resourceType) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        res.send = function(body) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const resourceId = req.params.id || (typeof body === 'string' ? JSON.parse(body)?.id : body?.id);
                auditLog(
                    req.user?.id,
                    action,
                    resourceType,
                    resourceId,
                    { method: req.method, path: req.path, body: req.body }
                );
            }
            return originalSend.call(this, body);
        };
        next();
    };
};

module.exports = { auditLog, auditMiddleware };
