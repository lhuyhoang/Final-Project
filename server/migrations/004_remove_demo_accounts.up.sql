DELETE FROM orders
WHERE user_id = 'usr-demo';

DELETE FROM users
WHERE id = 'usr-demo'
   OR email = 'demo@quadpro.vn';
