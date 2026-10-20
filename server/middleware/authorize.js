export default function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.role === 'Admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ message: 'Access denied' });
  };
}
