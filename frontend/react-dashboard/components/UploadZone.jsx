import { useRef, useState } from 'react';

const ALLOWED = ['application/pdf','image/png','image/jpeg','image/tiff','image/webp'];
const MAX_MB  = 20;

function validate(file) {
  if (!ALLOWED.includes(file.type))
    return 'Unsupported format. Upload a PDF or image (PNG, JPG, TIFF, WEBP).';
  if (file.size / 1024 / 1024 > MAX_MB)
    return `File too large. Max size is ${MAX_MB} MB.`;
  return null;
}

function fmtSize(b) {
  return b < 1024 * 1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(2)} MB`;
}

export default function UploadZone({ file, onFileSelect, onFileRemove }) {
  const inputRef = useRef(null);
  const [dragging,    setDragging]    = useState(false);
  const [valError,    setValError]    = useState('');
  const [imgPreview,  setImgPreview]  = useState(null);

  function handleFile(raw) {
    setValError('');
    const err = validate(raw);
    if (err) { setValError(err); return; }
    if (raw.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setImgPreview(e.target.result);
      reader.readAsDataURL(raw);
    } else {
      setImgPreview(null);
    }
    onFileSelect(raw);
  }

  function handleRemove() {
    setImgPreview(null);
    setValError('');
    if (inputRef.current) inputRef.current.value = '';
    onFileRemove();
  }

  const isPdf = file?.type === 'application/pdf';

  return (
    <div style={{ marginTop: 32 }}>
      {!file ? (
        <div
          style={{
            border: `2px dashed ${dragging ? 'var(--border2)' : 'var(--border)'}`,
            borderRadius: 14, padding: '48px 24px', textAlign: 'center',
            cursor: 'pointer', background: dragging ? 'var(--surface2)' : 'var(--surface)',
            transition: 'all .15s',
          }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <svg style={{ width:32, height:32, color:'var(--ink-4)', marginBottom:14 }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p style={{ fontSize:15, fontWeight:600, color:'var(--ink-2)', marginBottom:6 }}>
            {dragging ? 'Drop it here' : 'Drop your medical report here'}
          </p>
          <p style={{ fontSize:13, color:'var(--ink-3)', marginBottom:10 }}>
            or <span style={{ color:'var(--ink)', textDecoration:'underline', cursor:'pointer' }}>browse files</span>
          </p>
          <p style={{ fontSize:11, color:'var(--ink-4)', fontFamily:"'JetBrains Mono',monospace", letterSpacing:'.04em' }}>
            PDF · PNG · JPG · TIFF · WEBP — max {MAX_MB} MB
          </p>
          <input ref={inputRef} type="file" accept=".pdf,image/*" style={{ display:'none' }}
            onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="fade-up" style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'14px 16px', background:'var(--surface)',
          border:'1px solid var(--border)', borderRadius:12,
        }}>
          {/* Type badge */}
          <div style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'5px 10px', borderRadius:7, flexShrink:0,
            fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:500,
            background: isPdf ? 'var(--red-bg)' : 'var(--green-bg)',
            color:       isPdf ? 'var(--red)'    : 'var(--green)',
          }}>
            {isPdf ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            )}
            {file.name.split('.').pop()?.toUpperCase()}
          </div>

          {/* Name + size */}
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
              title={file.name}>{file.name}</div>
            <div style={{ fontSize:11.5, color:'var(--ink-4)', fontFamily:"'JetBrains Mono',monospace", marginTop:2 }}>
              {fmtSize(file.size)}
            </div>
          </div>

          {/* Remove */}
          <button onClick={handleRemove} style={{
            background:'none', border:'none', cursor:'pointer',
            color:'var(--ink-4)', padding:6, borderRadius:7,
            display:'flex', alignItems:'center', flexShrink:0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Image preview */}
      {imgPreview && (
        <div className="fade-up" style={{ marginTop:12, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', background:'var(--surface)' }}>
          <img src={imgPreview} alt="preview" style={{ width:'100%', maxHeight:200, objectFit:'contain', display:'block' }} />
        </div>
      )}

      {/* Validation error */}
      {valError && (
        <p className="fade-up" style={{
          marginTop:10, display:'flex', alignItems:'center', gap:6,
          fontSize:12.5, color:'var(--red)',
          background:'var(--red-bg)', border:'1px solid #fecaca',
          padding:'8px 12px', borderRadius:8,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {valError}
        </p>
      )}
    </div>
  );
}