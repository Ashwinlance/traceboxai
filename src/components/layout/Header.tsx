import { Bell, Building2, RotateCcw } from 'lucide-react';
import { RoleSwitcher } from './RoleSwitcher';
import { useParcels } from '../../store/parcelContext';

export function Header() {
  const { resetDemo, activeUser, role, verificationRequests } = useParcels();
  const pendingRequests = verificationRequests.filter((request) => request.status === 'NEW' || request.status === 'OPENED');
  const newRequests = verificationRequests.filter((request) => request.status === 'NEW').length;
  return <header className="topbar">
    <div className="brand"><div className="brand-icon"><Building2 size={20}/></div><div><strong>TraceBox AI</strong><span>Map · Verify · Trace · Approve</span></div></div>
    <div className="topbar-actions">
      {role==='SUPERVISOR' && <div className={`request-indicator ${newRequests ? 'has-new' : ''}`} title="Surveyor verification requests"><Bell size={16}/><span>{pendingRequests.length} request{pendingRequests.length===1?'':'s'}</span>{newRequests>0&&<b>{newRequests}</b>}</div>}
      <div className="session-chip"><small>Demo role session</small><strong>{activeUser.name} · {activeUser.role}</strong></div><RoleSwitcher/><button className="icon-button" onClick={resetDemo} title="Reset demo"><RotateCcw size={16}/></button>
    </div>
  </header>;
}
