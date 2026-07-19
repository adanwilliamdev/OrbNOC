const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { pool } = require('../config/database');
const { JWT_SECRET } = require('../config/env');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}

function toPublicUser(user) {
  return { id: user.id, username: user.username, email: user.email, role: user.role };
}

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, role',
      [username, email, hashedPassword]
    );
    const user = result.rows[0];
    const token = issueToken(user);
    await pool.query('INSERT INTO access_logs (user_id, action, ip_address) VALUES ($1, $2, $3)', [user.id, 'register', req.ip]);
    res.json({ success: true, token, user: toPublicUser(user) });
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Usuário ou email já existe' });
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno ao criar usuário' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Credenciais inválidas' });
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    await pool.query('INSERT INTO access_logs (user_id, action, ip_address) VALUES ($1, $2, $3)', [user.id, 'login', req.ip]);
    const token = issueToken(user);
    res.json({ success: true, token, user: toPublicUser(user) });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await pool.query('INSERT INTO access_logs (user_id, action, ip_address) VALUES ($1, $2, $3)', [req.user.id, 'logout', req.ip]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});

module.exports = router;
