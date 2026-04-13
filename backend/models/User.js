const supabase = require('../db/supabase');
const bcrypt = require('bcryptjs');

// Map Supabase row → public-safe object with _id for frontend compatibility
function toPublic(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return { ...rest, _id: rest.id };
}

async function findById(id) {
  const { data } = await supabase.from('users').select('*').eq('id', id).single();
  return data;
}

async function findOne({ email, username } = {}) {
  let query = supabase.from('users').select('*');
  if (email && username) query = query.or(`email.eq.${email},username.eq.${username}`);
  else if (email)    query = query.eq('email', email);
  else if (username) query = query.eq('username', username);
  const { data } = await query.maybeSingle();
  return data;
}

async function create({ username, email, password }) {
  const hashed = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from('users')
    .insert({ username, email, password: hashed })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function findByIdAndUpdate(id, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function comparePassword(plainPw, hashedPw) {
  return bcrypt.compare(plainPw, hashedPw);
}

module.exports = { findById, findOne, create, findByIdAndUpdate, comparePassword, toPublic };
