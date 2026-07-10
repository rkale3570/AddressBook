import { DuplicateResult } from '../types';

interface Props {
  duplicates: DuplicateResult[];
  onUseExisting: (id: string) => void;
  onMerge: (existingContactId: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

export default function DuplicateDialog({ duplicates, onUseExisting, onMerge, onCreateNew, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Duplicate Contacts Detected</h3>
        <p className="text-sm text-gray mb-2">
          The following similar contacts were found. Choose how to proceed:
        </p>
        {duplicates.map((d, i) => (
          <div key={i} className="duplicate-item">
            <div>
              <strong>{d.contact.fullName}</strong>
              {(d.contact.company || d.contact.jobTitle) && (
                <p className="text-sm text-gray">
                  {[d.contact.jobTitle, d.contact.company].filter(Boolean).join(' at ')}
                </p>
              )}
              <p className="text-sm text-gray">{d.matchReason}</p>
              {(d.contact.emails?.length ?? 0) > 0 && (
                <div className="mt-1">
                  {d.contact.emails?.map((e, j) => (
                    <span key={`e-${j}`} className="tag">{e.email}</span>
                  ))}
                </div>
              )}
              {(d.contact.phones?.length ?? 0) > 0 && (
                <div className="mt-1">
                  {d.contact.phones?.map((p, j) => (
                    <span key={`p-${j}`} className="tag">{p.phone}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <button className="btn btn-sm btn-primary" onClick={() => onUseExisting(d.contact.id)}>
                Use Existing
              </button>
              <button className="btn btn-sm btn-success" onClick={() => onMerge(d.contact.id)}>
                Merge
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-1 mt-2">
          <button className="btn btn-primary" onClick={onCreateNew}>
            Create New Anyway
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
