import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { BUSINESS_RELATIONSHIPS, PHONE_TYPES, EMAIL_TYPES } from '../types';
import DuplicateDialog from '../components/DuplicateDialog';
import RelationshipPanel from '../components/RelationshipPanel';

export default function ContactForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;

  const [form, setForm] = useState({
    fullName: '',
    jobTitle: '',
    company: '',
    website: '',
    address: '',
    businessRelationship: '',
    notes: '',
  });
  const [emails, setEmails] = useState<{ email: string; type: string }[]>([]);
  const [phones, setPhones] = useState<{ phone: string; type: string }[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.contacts.list(1, 200).then(res => setAllContacts(res.data || [])).catch(() => {});

    if (isEdit && id) {
      api.contacts.get(id).then(c => {
        setForm({
          fullName: c.fullName || '',
          jobTitle: c.jobTitle || '',
          company: c.company || '',
          website: c.website || '',
          address: c.address || '',
          businessRelationship: c.businessRelationship || '',
          notes: c.notes || '',
        });
        setEmails(c.emails?.map((e: any) => ({ email: e.email, type: e.type || 'other' })) || []);
        setPhones(c.phones?.map((p: any) => ({ phone: p.phone, type: p.type || 'other' })) || []);
      }).catch(() => navigate('/contacts'));
    } else if (location.state?.scanResult) {
      const scanData = location.state.scanResult;
      setForm({
        fullName: scanData.fullName || '',
        jobTitle: scanData.jobTitle || '',
        company: scanData.company || '',
        website: scanData.website || '',
        address: scanData.address || '',
        businessRelationship: scanData.businessRelationship || '',
        notes: '',
      });
      setEmails(scanData.emails?.map((e: any) => ({ email: e.email, type: e.type || 'work' })) || []);
      setPhones(scanData.phones?.map((p: any) => ({ phone: p.phone, type: p.type || 'mobile' })) || []);
      setAllContacts([]);
    }
  }, [id, location.state]);

  const setField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const addEmail = () => setEmails(prev => [...prev, { email: '', type: 'work' }]);
  const updateEmail = (i: number, field: string, value: string) => {
    setEmails(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  };
  const removeEmail = (i: number) => setEmails(prev => prev.filter((_, idx) => idx !== i));

  const addPhone = () => setPhones(prev => [...prev, { phone: '', type: 'mobile' }]);
  const updatePhone = (i: number, field: string, value: string) => {
    setPhones(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };
  const removePhone = (i: number) => setPhones(prev => prev.filter((_, idx) => idx !== i));

  const checkDuplicates = async () => {
    const checkData: any = {};
    if (form.fullName) checkData.fullName = form.fullName;
    const firstEmail = emails.find(e => e.email);
    if (firstEmail) checkData.email = firstEmail.email;
    const firstPhone = phones.find(p => p.phone);
    if (firstPhone) checkData.phone = firstPhone.phone;

    if (!isEdit && Object.keys(checkData).length > 0) {
      try {
        const result = await api.duplicates.check(checkData);
        if (result?.length > 0) {
          setDuplicates(result);
          setShowDupDialog(true);
          return true;
        }
      } catch {}
    }
    return false;
  };

  const save = async (force = false) => {
    if (!force && !isEdit) {
      const hasDups = await checkDuplicates();
      if (hasDups) return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        emails: emails.filter(e => e.email),
        phones: phones.filter(p => p.phone),
      };

      if (isEdit && id) {
        await api.contacts.update(id, payload);
      } else {
        await api.contacts.create(payload);
      }
      navigate('/contacts');
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <h2>{isEdit ? 'Edit Contact' : 'Create Contact'}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <div className="card">
            <div className="form-group">
              <label>Full Name *</label>
              <input value={form.fullName} onChange={e => setField('fullName', e.target.value)} placeholder="John Smith" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Job Title</label>
                <input value={form.jobTitle} onChange={e => setField('jobTitle', e.target.value)} placeholder="Sales Manager" />
              </div>
              <div className="form-group">
                <label>Company</label>
                <input value={form.company} onChange={e => setField('company', e.target.value)} placeholder="ABC Realty" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Website</label>
                <input value={form.website} onChange={e => setField('website', e.target.value)} placeholder="https://abc.com" />
              </div>
              <div className="form-group">
                <label>Business Relationship</label>
                <select value={form.businessRelationship} onChange={e => setField('businessRelationship', e.target.value)}>
                  <option value="">Select...</option>
                  {BUSINESS_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Address</label>
              <input value={form.address} onChange={e => setField('address', e.target.value)} placeholder="123 Main St, City, State" />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Additional notes..." />
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-1">
              <h4>Email Addresses</h4>
              <button className="btn btn-sm" onClick={addEmail}>+ Add</button>
            </div>
            {emails.map((e, i) => (
              <div key={i} className="grid-3 mb-1">
                <input value={e.email} onChange={el => updateEmail(i, 'email', el.target.value)} placeholder="email@example.com" />
                <select value={e.type} onChange={el => updateEmail(i, 'type', el.target.value)}>
                  {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn btn-sm btn-danger" onClick={() => removeEmail(i)}>Remove</button>
              </div>
            ))}
            {emails.length === 0 && (
              <p className="text-sm text-gray">No emails. Add at least one email for the contact.</p>
            )}
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-1">
              <h4>Phone Numbers</h4>
              <button className="btn btn-sm" onClick={addPhone}>+ Add</button>
            </div>
            {phones.map((p, i) => (
              <div key={i} className="grid-3 mb-1">
                <input value={p.phone} onChange={el => updatePhone(i, 'phone', el.target.value)} placeholder="518-555-1111" />
                <select value={p.type} onChange={el => updatePhone(i, 'type', el.target.value)}>
                  {PHONE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn btn-sm btn-danger" onClick={() => removePhone(i)}>Remove</button>
              </div>
            ))}
            {phones.length === 0 && (
              <p className="text-sm text-gray">No phones. Add at least one phone number.</p>
            )}
          </div>

          <div className="flex gap-1 mt-2">
            <button className="btn btn-primary" onClick={() => save(false)} disabled={saving || !form.fullName}>
              {saving ? 'Saving...' : isEdit ? 'Update Contact' : 'Create Contact'}
            </button>
            <button className="btn" onClick={() => navigate('/contacts')}>Cancel</button>
          </div>
        </div>

        {isEdit && id && (
          <div>
            <RelationshipPanel contactId={id} contacts={allContacts} />
          </div>
        )}
      </div>

      {showDupDialog && (
        <DuplicateDialog
          duplicates={duplicates}
          onUseExisting={(existingId) => navigate(`/contacts/${existingId}/edit`)}
          onMerge={(sourceId) => {
            if (id) navigate(`/contacts/${sourceId}/edit`);
            else setShowDupDialog(false);
          }}
          onCreateNew={() => { setShowDupDialog(false); save(true); }}
          onClose={() => setShowDupDialog(false)}
        />
      )}
    </div>
  );
}