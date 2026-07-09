import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { BUSINESS_RELATIONSHIPS, PHONE_TYPES, EMAIL_TYPES } from '../types';

export default function ScanPage() {
  const navigate = useNavigate();
  const [imageData, setImageData] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteButtonRef = useRef<HTMLButtonElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageData(ev.target?.result as string);
      processScan(file);
    };
    reader.readAsDataURL(file);
  };

  const processScan = async (file: File) => {
    setScanning(true);
    setError('');

    try {
      const result = await api.scan.image(file);
      if (result?.error) {
        setError(`Server error: ${result.detail || result.error}`);
        return;
      }
      setScanResult(result);
    } catch (err: any) {
      setError(`OCR failed: ${err.message || 'Unknown error'}`);
    }
    setScanning(false);
  };

  const pasteFromClipboard = async () => {
    try {
      const clipboardItem = await navigator.clipboard.read();
      for (const item of clipboardItem) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], 'clipboard-image.png', {
              type,
              lastModified: Date.now(),
            });
            const reader = new FileReader();
            reader.onload = (ev) => {
              setImageData(ev.target?.result as string);
              processScan(file);
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      setError('No image found in clipboard');
    } catch {
      setError('Could not access clipboard. Make sure you have pasted an image first.');
    }
  };

  const goToEditForm = () => {
    if (!scanResult) return;
    const scanResultPayload = {
      ...scanResult,
      emails: scanResult.emails || [],
      phones: scanResult.phones || [],
    };
    navigate('/contacts/new', { state: { scanResult: scanResultPayload } });
  };

  const handlePaste = async (e: ClipboardEvent) => {
    try {
      const clipboardItem = e.clipboardData?.items[0];
      if (clipboardItem?.type.startsWith('image/')) {
        e.preventDefault();
        const blob = clipboardItem.getAsFile();
        if (blob) {
          const file = new File([blob], 'clipboard-image.png', {
            type: blob.type,
            lastModified: blob.lastModified,
          });
          const reader = new FileReader();
          reader.onload = (ev) => {
            setImageData(ev.target?.result as string);
            processScan(file);
          };
          reader.readAsDataURL(blob);
        }
      }
    } catch {
      setError('Pasting failed');
    }
  };

  const handlePasteWindow = (e: Event) => {
    if (e instanceof ClipboardEvent) {
      handlePaste(e);
    }
  };

  useEffect(() => {
    window.addEventListener('paste', handlePasteWindow);
    return () => window.removeEventListener('paste', handlePasteWindow);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Scan Business Card</h2>
        {scanResult && (
          <div className="flex gap-1">
            <button className="btn" onClick={() => setImageData(null)}>Scan Another</button>
            <button className="btn btn-primary" onClick={goToEditForm}>Fill Contact Form</button>
          </div>
        )}
      </div>

      <div className="scanner-container">
        {!imageData ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3 className="mb-1">Scan a Business Card</h3>
            <p className="text-sm text-gray mb-2">
              Upload or paste a screenshot of a business card
            </p>

            <div className="scanner-preview">
              {imageData ? (
                <img src={imageData} alt="Captured" style={{ maxWidth: '100%' }} />
              ) : (
                <div className="text-gray">
                  <div className="text-4xl mb-1">📷</div>
                  <p>or paste an image using Ctrl+V</p>
                </div>
              )}
            </div>

            <div className="flex gap-1" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Image
              </button>
              <button
                ref={pasteButtonRef}
                type="button"
                className="btn"
                onClick={pasteFromClipboard}
              >
                Paste Image
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileUpload} />
            </div>

            {error && <p className="text-sm mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
          </div>
        ) : (
          scanResult && (
            <div>
              <div className="card">
                <div className="flex justify-between items-center mb-1">
                  <h3>Scan Results</h3>
                  <span className="badge badge-success">✓ Extracted</span>
                </div>

                <div className="form-row mb-1">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      value={scanResult.fullName || ''}
                      onChange={e => setScanResult({ ...scanResult, fullName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Company</label>
                    <input
                      value={scanResult.company || ''}
                      onChange={e => setScanResult({ ...scanResult, company: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row mb-1">
                  <div className="form-group">
                    <label>Job Title</label>
                    <input
                      value={scanResult.jobTitle || ''}
                      onChange={e => setScanResult({ ...scanResult, jobTitle: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Business Relationship</label>
                    <select
                      value={scanResult.businessRelationship || ''}
                      onChange={e => setScanResult({ ...scanResult, businessRelationship: e.target.value })}
                    >
                      <option value="">Select...</option>
                      {BUSINESS_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group mb-1">
                  <label>Website</label>
                  <input
                    value={scanResult.website || ''}
                    onChange={e => setScanResult({ ...scanResult, website: e.target.value })}
                  />
                </div>

                <div className="form-group mb-1">
                  <label>Address</label>
                  <input
                    value={scanResult.address || ''}
                    onChange={e => setScanResult({ ...scanResult, address: e.target.value })}
                  />
                </div>

                <div className="card" style={{ marginTop: '1rem' }}>
                  <h4 className="mb-1">Emails</h4>
                  {scanResult.emails?.map((e: any, i: number) => (
                    <div key={i} className="grid-3 mb-1">
                      <input
                        value={e.email}
                        onChange={el => {
                          const emails = [...(scanResult.emails || [])];
                          emails[i] = { ...e, email: el.target.value };
                          setScanResult({ ...scanResult, emails });
                        }}
                      />
                      <select
                        value={e.type}
                        onChange={el => {
                          const emails = [...(scanResult.emails || [])];
                          emails[i] = { ...e, type: el.target.value };
                          setScanResult({ ...scanResult, emails });
                        }}
                      >
                        {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          const emails = scanResult.emails?.filter((_: any, idx: number) => idx !== i) || [];
                          setScanResult({ ...scanResult, emails });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {(!scanResult.emails || scanResult.emails.length === 0) && (
                    <p className="text-sm text-gray">No emails detected</p>
                  )}
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      setScanResult({
                        ...scanResult,
                        emails: [...(scanResult.emails || []), { email: '', type: 'work' }],
                      })
                    }
                  >
                    + Add Email
                  </button>
                </div>

                <div className="card" style={{ marginTop: '1rem' }}>
                  <h4 className="mb-1">Phone Numbers</h4>
                  {scanResult.phones?.map((p: any, i: number) => (
                    <div key={i} className="grid-3 mb-1">
                      <input
                        value={p.phone}
                        onChange={el => {
                          const phones = [...(scanResult.phones || [])];
                          phones[i] = { ...p, phone: el.target.value };
                          setScanResult({ ...scanResult, phones });
                        }}
                      />
                      <select
                        value={p.type}
                        onChange={el => {
                          const phones = [...(scanResult.phones || [])];
                          phones[i] = { ...p, type: el.target.value };
                          setScanResult({ ...scanResult, phones });
                        }}
                      >
                        {PHONE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          const phones = scanResult.phones?.filter((_: any, idx: number) => idx !== i) || [];
                          setScanResult({ ...scanResult, phones });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {(!scanResult.phones || scanResult.phones.length === 0) && (
                    <p className="text-sm text-gray">No phones detected</p>
                  )}
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      setScanResult({
                        ...scanResult,
                        phones: [...(scanResult.phones || []), { phone: '', type: 'mobile' }],
                      })
                    }
                  >
                    + Add Phone
                  </button>
                </div>

                <div className="flex gap-1 mt-2">
                  <button className="btn" onClick={() => setImageData(null)}>Scan Another</button>
                  <button className="btn btn-primary" onClick={goToEditForm}>Continue to Contact Form</button>
                </div>
              </div>

              <div className="card">
                <h4 className="mb-1">Original Image</h4>
                <img src={imageData} alt="Original" style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }} />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}