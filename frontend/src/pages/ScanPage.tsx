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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pasteButtonRef = useRef<HTMLButtonElement>(null);

  // Live camera capture state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setError('');
    setCameraError('');

    // If the browser doesn't support getUserMedia (or we're not in a secure
    // context), fall back to the native mobile camera picker instead.
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    try {
      streamRef.current?.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      });
      streamRef.current = stream;
      setFacingMode(mode);
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch (err: any) {
      setCameraError('Could not access camera. You can still upload a photo instead.');
    }
  };

  const switchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(next);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) {
      setCameraError('Camera is not ready yet. Please wait a moment and try again.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Could not process the photo on this device. Please use "Upload Image" instead.');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) {
        setCameraError('Failed to capture the photo. Please try again.');
        return;
      }
      const file = new File([blob], `business-card-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      loadFile(file);
    }, 'image/jpeg', 0.92);
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // matches backend Multer limit

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please provide an image file (JPG, PNG, WEBP, or HEIC).');
      return;
    }
    if (file.size === 0) {
      setError('That image appears to be empty or corrupted. Please try another photo.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('That image is too large. Please use a photo under 10MB.');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onerror = () => setError('Could not read that image. Please try again.');
    reader.onload = (ev) => {
      setImageData(ev.target?.result as string);
      processScan(file);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    loadFile(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    loadFile(file);
  };

  const processScan = async (file: File) => {
    setScanning(true);
    setError('');

    try {
      const result = await api.scan.image(file);
      if (result?.error || result?.statusCode >= 400) {
        setError(result.detail || result.message || result.error || 'Could not read this business card.');
        return;
      }
      setScanResult(result);
    } catch (err: any) {
      setError(`OCR failed: ${err.message || 'Unknown error'}`);
    } finally {
      setScanning(false);
    }
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
            loadFile(file);
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
    const scanResultState = {
      ...scanResult,
      emails: scanResult.emails || [],
      phones: scanResult.phones || [],
      businessRelationship: scanResult.businessRelationship || 'Other',
    };
    // ContactForm reads location.state.scanResult, so it must be nested here.
    navigate('/contacts/new', { state: { scanResult: scanResultState } });
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
          loadFile(file);
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
              Take a photo, upload an image, or paste a screenshot of a business card
            </p>

            <div className="scanner-preview">
              {cameraOpen ? (
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%' }} />
              ) : (
                <div className="text-gray">
                  <div className="text-4xl mb-1">📷</div>
                  <p>or paste an image using Ctrl+V</p>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} hidden />

            {cameraError && (
              <p className="text-sm mb-1" style={{ color: 'var(--danger)' }}>{cameraError}</p>
            )}

            {cameraOpen ? (
              <div className="flex gap-1" style={{ justifyContent: 'center' }}>
                <button type="button" className="btn btn-primary" onClick={capturePhoto}>
                  📸 Capture
                </button>
                <button type="button" className="btn" onClick={switchCamera}>
                  🔄 Switch Camera
                </button>
                <button type="button" className="btn" onClick={stopCamera}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-1" style={{ justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => startCamera()}
                >
                  📸 Take Photo
                </button>
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
                {/* Fallback for browsers without getUserMedia support: opens the
                    device's native camera app directly. */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={handleCameraCapture}
                />
              </div>
            )}

            {error && <p className="text-sm mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
          </div>
        ) : scanning || !scanResult ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <img src={imageData} alt="Captured" style={{ maxWidth: '100%', borderRadius: 'var(--radius)', marginBottom: '1rem' }} />
            <p className="text-sm text-gray">Reading business card…</p>
            {error && (
              <>
                <p className="text-sm mt-1" style={{ color: 'var(--danger)' }}>{error}</p>
                <button className="btn mt-1" onClick={() => setImageData(null)}>Try Again</button>
              </>
            )}
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