import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, recentContacts: [] as any[] });

  useEffect(() => {
    api.contacts.list(1, 5).then(res => {
      setStats({ total: res.data?.length || 0, recentContacts: res.data || [] });
    }).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <div className="flex gap-1">
          <Link to="/scan" className="btn btn-primary">Scan Card</Link>
          <Link to="/voice" className="btn btn-primary">Voice Entry</Link>
          <Link to="/contacts/new" className="btn">+ New Contact</Link>
        </div>
      </div>

      <div className="grid-3 mb-2">
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2rem', color: 'var(--primary)' }}>{stats.total}</h3>
          <p className="text-sm text-gray">Total Contacts</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2rem', color: 'var(--success)' }}>
            {stats.recentContacts.length}
          </h3>
          <p className="text-sm text-gray">Recent Additions</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Link to="/groups" style={{ fontSize: '2rem', color: 'var(--warning)', display: 'block' }}>
            Groups
          </Link>
          <p className="text-sm text-gray">Manage Groups</p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-1">Quick Actions</h3>
        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
          <Link to="/scan" className="btn"> Upload Business Card</Link>
          <Link to="/voice" className="btn"> Voice Entry</Link>
          <Link to="/contacts/new" className="btn"> Manual Entry</Link>
          <Link to="/contacts" className="btn"> View All Contacts</Link>
        </div>
      </div>

      {stats.recentContacts.length > 0 && (
        <div className="card">
          <h3 className="mb-1">Recent Contacts</h3>
          {stats.recentContacts.map((c: any) => (
            <Link key={c.id} to={`/contacts/${c.id}/edit`} className="contact-card" style={{ display: 'flex', textDecoration: 'none', color: 'inherit' }}>
              <div className="info">
                <h3>{c.fullName}</h3>
                <p>{c.jobTitle}{c.company ? ` at ${c.company}` : ''}</p>
              </div>
              {c.businessRelationship && (
                <span className="badge badge-blue">{c.businessRelationship}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
