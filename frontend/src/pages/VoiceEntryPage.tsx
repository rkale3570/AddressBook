import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { BUSINESS_RELATIONSHIPS, PHONE_TYPES, EMAIL_TYPES } from '../types';
import { createWavRecorder } from '../services/wavRecorder';

export default function VoiceEntryPage() {
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [emails, setEmails] = useState<{ email: string; type: string }[]>([]);
  const [phones, setPhones] = useState<{ phone: string; type: string }[]>([]);
  const recorderRef = useRef<ReturnType<typeof createWavRecorder> | null>(null);

  const startListening = async () => {
    setError('');
    setTranscript('');
    setParsed(null);
    setForm(null);

    try {
      const recorder = createWavRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      setListening(true);
    } catch {
      setError('Microphone access denied. Allow permissions or type the transcript below.');
    }
  };

  const stopListening = async () => {
    setListening(false);
    setProcessing(true);
    try {
      const wavBlob = await recorderRef.current!.stop();
      const file = new File([wavBlob], 'recording.wav', { type: 'audio/wav' });
      const result = await api.voice.transcribeAudio(file);
      if (result?.fullName || result?.emails?.length || result?.phones?.length) {
        applyParsed(result);
      } else {
        setError('Could not parse the recording. Try speaking more clearly or type below.');
      }
    } catch {
      setError('Transcription failed. Type the transcript below.');
    }
    setProcessing(false);
  };

  const applyParsed = (result: any) => {
    setParsed(result);
    setForm({
      fullName: result.fullName || '',
      jobTitle: result.jobTitle || '',
      company: result.company || '',
      website: result.website || '',
      address: result.address || '',
      businessRelationship: result.businessRelationship || '',
      notes: '',
    });
    setEmails((result.emails || []).length > 0 ? result.emails : [{ email: '', type: 'work' }]);
    setPhones((result.phones || []).length > 0 ? result.phones : [{ phone: '', type: 'mobile' }]);
  };

  const handleManualTranscript = async () => {
    if (!transcript.trim()) return;
    setError('');
    setProcessing(true);
    try {
      const result = await api.voice.transcribe(transcript);
      applyParsed(result);
    } catch {
      setError('Failed to parse transcript');
    }
    setProcessing(false);
  };

  const saveAsContact = () => {
    if (!form?.fullName) return alert('Full name is required');
    navigate('/contacts/new', {
      state: {
        scanResult: {
          ...form,
          emails: emails.filter(e => e.email),
          phones: phones.filter(p => p.phone),
        },
      },
    });
  };

  const reset = () => {
    setTranscript('');
    setParsed(null);
    setForm(null);
    setEmails([]);
    setPhones([]);
    setError('');
  };

  return (
    <div>
      <div className="page-header">
        <h2>Voice Entry</h2>
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <h3 className="mb-1">Record Contact Details</h3>
        <p className="text-sm text-gray mb-2">
          Click the mic, speak clearly, click stop. Audio is transcribed locally on the server.
        </p>
        <p className="text-sm text-gray mb-2">
          Example: "John Smith, Sales Manager at ABC Realty. Email john@abc.com. Mobile 518-555-1111. Vendor."
        </p>

        <button
          className={`voice-btn ${listening ? 'listening' : ''}`}
          onClick={listening ? stopListening : startListening}
          disabled={processing}
        >
          {listening ? '⏹' : '🎤'}
        </button>
        <div className="mt-1">
          <button
            className="btn btn-primary"
            onClick={listening ? stopListening : startListening}
            disabled={processing}
          >
            {listening ? 'Stop' : 'Start Speaking'}
          </button>
        </div>
        {listening && <p className="text-sm" style={{ color: 'var(--danger)' }}>Recording... click stop when done</p>}
        {processing && <p className="text-sm" style={{ color: 'var(--primary)' }}>Processing audio locally...</p>}

        {error && (
          <p className="text-sm mt-1" style={{ color: '#92400e', background: '#fef3c7', padding: '0.5rem', borderRadius: 'var(--radius)' }}>
            {error}
          </p>
        )}
      </div>

      <div className="card">
        <h4 className="mb-1">Transcript (Manual Entry)</h4>
        <p className="text-sm text-gray mb-1">Type or paste what was spoken, then click Parse.</p>
        <textarea
          rows={3}
          className="w-full"
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder="John Smith, Sales Manager at ABC Realty. Email john@abc.com. Mobile 518-555-1111. Vendor."
        />
        <div className="flex gap-1 mt-1">
          <button className="btn btn-primary" onClick={handleManualTranscript} disabled={!transcript.trim() || processing}>
            {processing ? 'Processing...' : 'Parse Transcript'}
          </button>
          {transcript && (
            <button className="btn btn-sm" onClick={() => setTranscript('')}>Clear</button>
          )}
        </div>
      </div>

      {form && (
        <div>
          {parsed && (
            <div className="card">
              <h4 className="mb-1">Parsed Fields</h4>
              <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                {parsed.fullName && <span className="badge badge-blue">Name: {parsed.fullName}</span>}
                {parsed.jobTitle && <span className="badge badge-green">Title: {parsed.jobTitle}</span>}
                {parsed.company && <span className="badge badge-yellow">Company: {parsed.company}</span>}
                {parsed.website && <span className="badge badge-gray">Web: {parsed.website}</span>}
                {parsed.businessRelationship && <span className="badge badge-blue">Rel: {parsed.businessRelationship}</span>}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="mb-1">Contact Details</h3>
            <div className="form-group">
              <label>Full Name *</label>
              <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Job Title</label>
                <input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Company</label>
                <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Website</label>
                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Business Relationship</label>
                <select value={form.businessRelationship} onChange={e => setForm({ ...form, businessRelationship: e.target.value })}>
                  <option value="">Select...</option>
                  {BUSINESS_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>

          <div className="card">
            <h4 className="mb-1">Emails</h4>
            {emails.map((e, i) => (
              <div key={i} className="grid-3 mb-1">
                <input value={e.email} onChange={el => {
                  const upd = [...emails]; upd[i] = { ...upd[i], email: el.target.value }; setEmails(upd);
                }} />
                <select value={e.type} onChange={el => {
                  const upd = [...emails]; upd[i] = { ...upd[i], type: el.target.value }; setEmails(upd);
                }}>
                  {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn btn-sm btn-danger" onClick={() => setEmails(emails.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => setEmails([...emails, { email: '', type: 'work' }])}>+ Add Email</button>
          </div>

          <div className="card">
            <h4 className="mb-1">Phones</h4>
            {phones.map((p, i) => (
              <div key={i} className="grid-3 mb-1">
                <input value={p.phone} onChange={el => {
                  const upd = [...phones]; upd[i] = { ...upd[i], phone: el.target.value }; setPhones(upd);
                }} />
                <select value={p.type} onChange={el => {
                  const upd = [...phones]; upd[i] = { ...upd[i], type: el.target.value }; setPhones(upd);
                }}>
                  {PHONE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn btn-sm btn-danger" onClick={() => setPhones(phones.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => setPhones([...phones, { phone: '', type: 'mobile' }])}>+ Add Phone</button>
          </div>

          <div className="flex gap-1 mt-2">
            <button className="btn btn-primary" onClick={saveAsContact}>Save as Contact</button>
            <button className="btn" onClick={reset}>Start Over</button>
          </div>
        </div>
      )}
    </div>
  );
}
