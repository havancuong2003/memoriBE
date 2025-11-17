const { verifyToken } = require('../utils/jwt');

const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ message: 'Không có token xác thực' });
      return;
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: error.message || 'Token không hợp lệ' });
  }
};

// Optional authenticate - không bắt buộc token, nhưng nếu có thì parse
const optionalAuthenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = verifyToken(token);
        req.user = decoded;
      } catch (error) {
        // Token không hợp lệ nhưng không block request
        req.user = null;
      }
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Helper function để check user có quyền admin (admin, Cường, Linh)
const hasAdminAccess = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  // Cường và Linh có quyền như admin
  const specialEmails = ['cuong@123.com', 'linh@123.com'];
  return specialEmails.includes(user.email?.toLowerCase());
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ message: 'Cần đăng nhập' });
    return;
  }

  if (!hasAdminAccess(req.user)) {
    res.status(403).json({ message: 'Chỉ admin, Cường, Linh mới có quyền thực hiện hành động này' });
    return;
  }

  next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
};


