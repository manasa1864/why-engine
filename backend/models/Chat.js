const supabase = require('../db/supabase');

function fmt(row) {
  if (!row) return null;
  return { ...row, _id: row.id, user: row.user_id, project: row.project_id };
}

async function findOne({ id, user_id }) {
  const { data } = await supabase
    .from('chats')
    .select('*')
    .eq('id', id)
    .eq('user_id', user_id)
    .maybeSingle();
  return fmt(data);
}

async function find({ user_id, project_id } = {}) {
  let query = supabase.from('chats').select('*').eq('user_id', user_id);
  if (project_id) query = query.eq('project_id', project_id);
  const { data } = await query.order('updated_at', { ascending: false });
  return (data || []).map(fmt);
}

async function findSummary({ user_id, project_id } = {}) {
  let query = supabase
    .from('chats')
    .select('id, title, status, total_attempts, created_at, updated_at, project_id')
    .eq('user_id', user_id);
  if (project_id) query = query.eq('project_id', project_id);
  const { data } = await query.order('updated_at', { ascending: false });
  return (data || []).map(fmt);
}

async function create({ user_id, project_id, title }) {
  const { data, error } = await supabase
    .from('chats')
    .insert({ user_id, project_id, title: title || 'Untitled Analysis', entries: [] })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fmt(data);
}

async function pushEntry({ id, user_id, entry }) {
  // Fetch current entries, append new one, save back
  const { data: current } = await supabase
    .from('chats')
    .select('entries')
    .eq('id', id)
    .eq('user_id', user_id)
    .single();
  if (!current) throw new Error('Chat not found');
  const entries = [...(current.entries || []), entry];
  const { data, error } = await supabase
    .from('chats')
    .update({ entries, total_attempts: entries.length, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user_id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fmt(data);
}

async function update({ id, user_id, updates }) {
  const { data, error } = await supabase
    .from('chats')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user_id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fmt(data);
}

async function findOneAndDelete({ id, user_id }) {
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', id)
    .eq('user_id', user_id);
  if (error) throw new Error(error.message);
}

async function deleteMany({ project_id, user_id }) {
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('project_id', project_id)
    .eq('user_id', user_id);
  if (error) throw new Error(error.message);
}

async function count({ user_id, status } = {}) {
  let query = supabase.from('chats').select('id', { count: 'exact', head: true }).eq('user_id', user_id);
  if (status) query = query.eq('status', status);
  const { count: total } = await query;
  return total || 0;
}

async function findHistory({ user_id, limit = 20, offset = 0 }) {
  const { data } = await supabase
    .from('chats')
    .select('id, title, project_id, status, total_attempts, created_at, updated_at')
    .eq('user_id', user_id)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return (data || []).map(fmt);
}

module.exports = { findOne, find, findSummary, create, pushEntry, update, findOneAndDelete, deleteMany, count, findHistory };
