import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ContactList() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await api.contacts.list(page, 20, search || undefined);
      setContacts(res.data || []);
    } catch {
      setContacts([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadContacts(); }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadContacts();
  };

  const deleteContact = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    await api.contacts.delete(id);
    loadContacts();
  };

  return (
    <div>
      <div className="page-header">
        <h2>Contacts</h2>
        <Link to="/contacts/new" className="btn btn-primary">+ New Contact</Link>
      </div>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          placeholder="Search by name, company, or title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {loading ? (
        <p className="text-gray">Loading...</p>
      ) : contacts.length === 0 ? (
        <div className="empty-state">
          <h3>No contacts found</h3>
          <p>Add your first contact to get started.</p>
          <Link to="/contacts/new" className="btn btn-primary mt-2">+ Add Contact</Link>
        </div>
      ) : (
        <>
          {contacts.map((c: any) => (
            <div key={c.id} className="contact-card">
              <Link to={`/contacts/${c.id}/edit`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                <div className="info">
                  <h3>{c.fullName}</h3>
                  <p>
                    {c.jobTitle && <span>{c.jobTitle}</span>}
                    {c.company && <span>{c.jobTitle ? ' at ' : ''}{c.company}</span>}
                  </p>
                  <div className="flex gap-1 mt-1" style={{ flexWrap: 'wrap' }}>
                    {c.emails?.map((e: any, i: number) => (
                      <span key={i} className="tag">{e.email}</span>
                    ))}
                    {c.phones?.map((p: any, i: number) => (
                      <span key={i} className="tag">{p.phone} ({p.type})</span>
                    ))}
                  </div>
                </div>
              </Link>
              <div className="flex gap-1">
                {c.businessRelationship && (
                  <span className="badge badge-blue">{c.businessRelationship}</span>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => deleteContact(c.id)}>Del</button>
              </div>
            </div>
          ))}
          <div className="flex gap-1 items-center mt-2">
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span className="text-sm">Page {page}</span>
            <button className="btn btn-sm" onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}
