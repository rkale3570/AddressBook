import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Contact, RELATIONSHIP_TYPES, RelationshipGroup } from '../types';

interface Props {
  contactId: string;
  contacts: Contact[];
}

export default function RelationshipPanel({ contactId, contacts }: Props) {
  const [relationships, setRelationships] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState('');
  const [relType, setRelType] = useState<string>(RELATIONSHIP_TYPES[0]);

  const [groups, setGroups] = useState<RelationshipGroup[]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const loadRelationships = () =>
    api.relationships.getForContact(contactId).then(setRelationships).catch(() => {});

  const loadGroups = () =>
    api.relationships.groups.list().then(setGroups).catch(() => {});

  useEffect(() => {
    if (!contactId) return;
    loadRelationships();
    loadGroups();
  }, [contactId]);

  const addRelationship = async () => {
    if (!selectedContact) return;
    await api.relationships.create({
      contactId1: contactId,
      contactId2: selectedContact,
      relationshipType: relType,
    });
    await loadRelationships();
    setShowForm(false);
    setSelectedContact('');
  };

  const removeRelationship = async (id: string) => {
    await api.relationships.delete(id);
    setRelationships(prev => prev.filter(r => r.id !== id));
  };

  const addToGroup = async () => {
    if (!selectedGroupId) return;
    await api.relationships.groups.addContacts(selectedGroupId, [contactId]);
    await loadGroups();
    setShowGroupPicker(false);
    setSelectedGroupId('');
  };

  const removeFromGroup = async (groupId: string) => {
    await api.relationships.groups.removeContact(groupId, contactId);
    await loadGroups();
  };

  const otherContacts = contacts.filter(c => c.id !== contactId);
  const memberGroups = groups.filter(g => g.contactIds?.includes(contactId));
  const availableGroups = groups.filter(g => !g.contactIds?.includes(contactId));

  return (
    <>
      <div className="card">
        <div className="flex justify-between items-center mb-1">
          <h4>Relationships</h4>
          <button className="btn btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {showForm && (
          <div className="form-row mb-1">
            <div className="form-group">
              <label>Contact</label>
              <select value={selectedContact} onChange={e => setSelectedContact(e.target.value)}>
                <option value="">Select...</option>
                {otherContacts.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Relationship</label>
              <select value={relType} onChange={e => setRelType(e.target.value)}>
                {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: '1.5rem' }} onClick={addRelationship}>
              Link
            </button>
          </div>
        )}

        {relationships.length === 0 && !showForm && (
          <p className="text-sm text-gray">No relationships defined.</p>
        )}

        {relationships.map(rel => {
          const related = rel.relatedContact;
          return (
            <div key={rel.id} className="flex justify-between items-center contact-card" style={{ padding: '0.5rem' }}>
              <div>
                <strong>{related?.fullName || 'Unknown'}</strong>
                <span className="badge badge-blue" style={{ marginLeft: '0.5rem' }}>{rel.relationshipType}</span>
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => removeRelationship(rel.id)}>Remove</button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-1">
          <h4>Groups</h4>
          <button
            className="btn btn-sm"
            onClick={() => setShowGroupPicker(!showGroupPicker)}
            disabled={availableGroups.length === 0}
          >
            {showGroupPicker ? 'Cancel' : '+ Add to Group'}
          </button>
        </div>

        {showGroupPicker && (
          <div className="form-row mb-1">
            <div className="form-group">
              <label>Group</label>
              <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                <option value="">Select...</option>
                {availableGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '1.5rem' }}
              onClick={addToGroup}
              disabled={!selectedGroupId}
            >
              Add
            </button>
          </div>
        )}

        {memberGroups.length === 0 ? (
          <p className="text-sm text-gray">
            {groups.length === 0
              ? 'No groups exist yet. Create one from the Groups page.'
              : 'Not a member of any group.'}
          </p>
        ) : (
          memberGroups.map(g => (
            <div key={g.id} className="flex justify-between items-center contact-card" style={{ padding: '0.5rem' }}>
              <div>
                <strong>{g.name}</strong>
                <span className="badge badge-gray" style={{ marginLeft: '0.5rem' }}>
                  {g.contactIds?.length || 0} members
                </span>
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => removeFromGroup(g.id)}>Remove</button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
