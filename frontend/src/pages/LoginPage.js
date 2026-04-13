import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function LoginPage() {
  const [email,setEmail]=useState('');const [pw,setPw]=useState('');const [err,setErr]=useState('');const [ld,setLd]=useState(false);
  const {login}=useAuth();const nav=useNavigate();
  const go=async e=>{e.preventDefault();setErr('');setLd(true);try{await login(email,pw);nav('/');}catch(e){setErr(e.response?.data?.error||'Login failed');}finally{setLd(false);}};
  return(<div className="auth"><div className="auth-c"><div style={{textAlign:'center',marginBottom:22}}><div className="logo" style={{width:48,height:48,fontSize:22,margin:'0 auto 12px',borderRadius:14}}>W</div><h2>Welcome back</h2><p className="auth-sub">Sign in to WHY Engine</p></div>
  {err&&<div className="err-msg">{err}</div>}
  <form onSubmit={go}><div className="fld"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@email.com"/></div><div className="fld"><label>Password</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} required placeholder="••••••••"/></div><button className="btn btn-p sub-btn" disabled={ld}>{ld?<><div className="spinner"/>Signing in...</>:'Sign In'}</button></form>
  <div className="sw">Don't have an account? <Link to="/register">Sign Up</Link></div></div></div>);
}
