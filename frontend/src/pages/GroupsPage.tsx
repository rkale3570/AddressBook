import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { RelationshipGroup } from '../types';

export default function GroupsPage() {
  const [groups, setGroups] = useState<RelationshipGroup[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [g, c] = await Promise.all([
        api.relationships.groups.list(),
        api.contacts.list(1, 200),
      ]);
      setGroups(g || []);
      setContacts(c.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const createGroup = async () => {
    if (!groupName.trim()) return;
    await api.relationships.groups.create({ name: groupName, contactIds: selectedContacts });
    setGroupName('');
    setSelectedContacts([]);
    setShowCreate(false);
    loadData();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Delete this group?')) return;
    await api.relationships.groups.delete(id);
    loadData();
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  if (loading) return <p className="text-gray">Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <h2>Contact Groups</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Group'}
        </button>
      </div>

      {showCreate && (
        <div className="card mb-2">
          <h3 className="mb-1">Create Group</h3>
          <div className="form-group">
            <label>Group Name</label>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Team Alpha, Family, etc." />
          </div>
          <div className="form-group">
            <label>Add Contacts</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '0.5rem' }}>
              {contacts.length === 0 && <p className="text-sm text-gray">No contacts available</p>}
              {contacts.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(c.id)}
                    onChange={() => toggleContact(c.id)}
                  />
                  <span className="text-sm">{c.fullName}</span>
                  {c.company && <span className="badge badge-gray text-sm">{c.company}</span>}
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={createGroup} disabled={!groupName.trim()}>
            Create Group
          </button>
        </div>
      )}

      {groups.length === 0 && !showCreate ? (
        <div className="empty-state">
          <h3>No groups yet</h3>
          <p>Create groups to organize your contacts.</p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.id} className="card">
            <div className="flex justify-between items-center mb-1">
              <h3>{group.name}</h3>
              <button className="btn btn-sm btn-danger" onClick={() => deleteGroup(group.id)}>Delete</button>
            </div>
            <p className="text-sm text-gray mb-1">{group.contactIds?.length || 0} members</p>
            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
              {group.contactIds?.map(cId => {
                const contact = contacts.find(c => c.id === cId);
                return contact ? (
                  <span key={cId} className="badge badge-blue">{contact.fullName}</span>
                ) : null;
              })}
              {(!group.contactIds || group.contactIds.length === 0) && (
                <span className="text-sm text-gray">No members</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
