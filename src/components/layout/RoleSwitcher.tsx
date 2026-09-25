import { ShieldCheck, MapPinned, ClipboardCheck } from 'lucide-react';
import { useParcels } from '../../store/parcelContext';
import type { UserRole } from '../../types/user';

const roles: { role: UserRole; label: string; icon: typeof ShieldCheck }[] = [
  { role:'ADMIN', label:'Admin', icon: ShieldCheck },
  { role:'SURVEYOR', label:'Surveyor', icon: MapPinned },
  { role:'SUPERVISOR', label:'Supervisor', icon: ClipboardCheck }
];

export function RoleSwitcher() {
  const { role, setRole } = useParcels();
  return <div className="role-switcher">
    {roles.map(({role:r,label,icon:Icon}) => <button key={r} onClick={() => setRole(r)} className={role===r?'active':''}><Icon size={15}/>{label}</button>)}
  </div>;
}
