import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function RegisterPage() {
  const [un,setUn]=useState('');const [em,setEm]=useState('');const [pw,setPw]=useState('');const [err,setErr]=useState('');const [ld,setLd]=useState(false);
  const {register}=useAuth();const nav=useNavigate();
  const go=async e=>{e.preventDefault();setErr('');setLd(true);try{await register(un,em,pw);nav('/');}catch(e){setErr(e.response?.data?.error||'Registration failed');}finally{setLd(false);}};
  return(<div className="auth"><div className="auth-c"><div style={{textAlign:'center',marginBottom:22}}><div className="logo" style={{width:48,height:48,fontSize:22,margin:'0 auto 12px',borderRadius:14}}>W</div><h2>Create Account</h2><p className="auth-sub">Start improving your coding mind</p></div>
  {err&&<div className="err-msg">{err}</div>}
  <form onSubmit={go}><div className="fld"><label>Username</label><input value={un} onChange={e=>setUn(e.target.value)} required placeholder="coder42" minLength={3}/></div><div className="fld"><label>Email</label><input type="email" value={em} onChange={e=>setEm(e.target.value)} required placeholder="you@email.com"/></div><div className="fld"><label>Password</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} required placeholder="••••••••" minLength={6}/></div><button className="btn btn-p sub-btn" disabled={ld}>{ld?<><div className="spinner"/>Creating...</>:'Create Account'}</button></form>
  <div className="sw">Already have an account? <Link to="/login">Sign In</Link></div></div></div>);
}
