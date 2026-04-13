const supabase = require('../db/supabase');

function fmt(row) {
  if (!row) return null;
  return { ...row, _id: row.id, user: row.user_id };
}

async function find({ user_id }) {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user_id)
    .order('updated_at', { ascending: false });
  return (data || []).map(fmt);
}

async function findOne({ id, user_id }) {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user_id)
    .maybeSingle();
  return fmt(data);
}

async function create({ user_id, name, description, language }) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id, name, description: description || '', language: language || 'python' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fmt(data);
}

async function findByIdAndDelete({ id, user_id }) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user_id);
  if (error) throw new Error(error.message);
}

async function findByIdAndUpdate(id, updates) {
  const { data, error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fmt(data);
}

module.exports = { find, findOne, create, findByIdAndDelete, findByIdAndUpdate };
