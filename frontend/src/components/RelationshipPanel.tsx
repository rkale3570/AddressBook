import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Contact, RELATIONSHIP_TYPES } from '../types';

interface Props {
  contactId: string;
  contacts: Contact[];
}

export default function RelationshipPanel({ contactId, contacts }: Props) {
  const [relationships, setRelationships] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState('');
  const [relType, setRelType] = useState<string>(RELATIONSHIP_TYPES[0]);

  useEffect(() => {
    if (contactId) {
      api.relationships.getForContact(contactId).then(setRelationships).catch(() => {});
    }
  }, [contactId]);

  const addRelationship = async () => {
    if (!selectedContact) return;
    await api.relationships.create({
      contactId1: contactId,
      contactId2: selectedContact,
      relationshipType: relType,
    });
    const updated = await api.relationships.getForContact(contactId);
    setRelationships(updated);
    setShowForm(false);
    setSelectedContact('');
  };

  const removeRelationship = async (id: string) => {
    await api.relationships.delete(id);
    setRelationships(prev => prev.filter(r => r.id !== id));
  };

  const otherContacts = contacts.filter(c => c.id !== contactId);

  return (
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
  );
}
