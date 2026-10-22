/**
 * Guards the routes that only an administrator of the panel may use.
 *
 * It must be mounted AFTER the `auth` middleware, because it reads the
 * decoded token that `auth` puts on `req.admin`.
 *
 * Tokens issued before the role was added to the payload carry no role.
 * Those are still admin tokens (the login endpoint only ever signs in
 * administrators), so a missing role is treated as the default `admin`
 * role. A token that explicitly carries a different role is rejected.
 */
function adminOnly(req, res, next) {
  const admin = req.admin;

  if (!admin) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const role = admin.role || 'admin';

  if (role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  req.adminRole = role;
  return next();
}

module.exports = adminOnly;